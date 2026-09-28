"""Library import — parses Trakt JSON / generic CSV, resolves titles via
external API clients, and upserts library entries (design.md §6)."""

import csv
import io
import json
import logging
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.titles import fetch_detail
from app.models import LibraryEntry, Title
from app.models.enums import ExternalSource, LibraryStatus, MediaType
from app.schemas.import_export import ImportResult
from app.services.title_store import SOURCE_ATTR, upsert_title

logger = logging.getLogger(__name__)

# Trakt type → our media type (best-effort mapping)
TRAKT_TYPE_MAP = {
    "movie": MediaType.MOVIE,
    "show": MediaType.TV,
    "episode": MediaType.TV,
    "anime": MediaType.ANIME,
    "game": MediaType.GAME,
    "manga": MediaType.MANGA,
}

# Our media type → Trakt type (for re-export round-trip)
OUR_TYPE_TO_TRAKT = {v: k for k, v in TRAKT_TYPE_MAP.items()}


async def _resolve_title(
    session: AsyncSession,
    source: str,
    external_id: str,
    media_type: str | None,
) -> Title | None:
    """Resolve a title by source+external_id, fetching from upstream if needed."""
    try:
        source_enum = ExternalSource(source)
    except ValueError:
        return None

    # Try DB lookup first
    attr = SOURCE_ATTR.get(source_enum)
    if attr:
        stmt = select(Title).where(getattr(Title, attr) == external_id)
        existing = (await session.execute(stmt)).scalar_one_or_none()
        if existing is not None:
            return existing

    # Not in DB — fetch from upstream
    try:
        detail = await fetch_detail(source_enum, external_id, media_type)
        title = await upsert_title(session, detail)
        logger.info("import: fetched and cached title %s/%s", source, external_id)
        return title
    except httpx.HTTPError as exc:
        logger.warning("import: failed to fetch %s/%s: %s", source, external_id, exc)
        return None
    except Exception as exc:  # noqa: BLE001
        logger.warning("import: unexpected error for %s/%s: %s", source, external_id, exc)
        return None


async def import_trakt_json(
    content: str,
    session: AsyncSession,
    user_id: str,
) -> ImportResult:
    """Import a Trakt-style JSON export and create library entries."""
    result = ImportResult()
    data = json.loads(content)

    # Trakt exports are arrays or objects with history/ratings/watchlist keys
    items: list[dict[str, Any]] = []
    if isinstance(data, list):
        items = data
    elif isinstance(data, dict):
        # Precedence matters: ratings first (→ completed), then history (→ watching),
        # watchlist last (→ plan_to). A title in multiple arrays is created once by
        # the highest-priority one; later rows are skipped as duplicates.
        items.extend(data.get("ratings", []))
        items.extend(data.get("history", []))
        items.extend(data.get("watchlist", []))

    for item in items:
        trakt_type = item.get("type", "")
        media_type = TRAKT_TYPE_MAP.get(trakt_type)
        content_obj = item.get("movie") or item.get("show") or item.get("episode") or {}
        ids = (content_obj.get("ids") or {}) if isinstance(content_obj, dict) else {}

        source, external_id = _find_first_id(ids)
        if source is None:
            result.errors.append({"row": item, "reason": "no recognised external ID"})
            result.skipped += 1
            continue

        inferred_media = _infer_media_type(source, trakt_type, media_type)
        title = await _resolve_title(session, source, external_id, inferred_media)
        if title is None:
            reason = f"could not resolve {source}/{external_id}"
            result.errors.append({"row": item, "reason": reason})
            result.skipped += 1
            continue

        # Determine status
        if "rating" in item and item["rating"] is not None:
            item_status = LibraryStatus.COMPLETED
        elif "watched_at" in item or item.get("action") == "watch":
            item_status = LibraryStatus.WATCHING
        else:
            item_status = LibraryStatus.PLAN_TO

        # Check duplicate
        dup = (
            await session.execute(
                select(LibraryEntry).where(
                    LibraryEntry.user_id == user_id,
                    LibraryEntry.title_id == title.id,
                )
            )
        ).scalar_one_or_none()

        if dup is not None:
            result.skipped += 1
            continue

        rating_val = item.get("rating")
        entry = LibraryEntry(
            user_id=user_id,
            title_id=title.id,
            status=item_status,
            rating=rating_val if isinstance(rating_val, int) else None,
        )
        session.add(entry)
        result.created += 1

    await session.commit()
    logger.info(
        "import_trakt: +%d created, %d skipped, %d errors",
        result.created,
        result.skipped,
        len(result.errors),
    )
    return result


async def import_csv(
    content: str,
    session: AsyncSession,
    user_id: str,
) -> ImportResult:
    """Import a generic CSV file and create library entries."""
    result = ImportResult()
    reader = csv.DictReader(io.StringIO(content))

    for row_num, row in enumerate(reader, start=2):  # 1-indexed, header is row 1
        source = (row.get("source") or "").strip()
        external_id = (row.get("external_id") or "").strip()
        status_raw = (row.get("status") or "plan_to").strip().lower()
        media_type = (row.get("media_type") or "").strip().lower()
        rating_raw = row.get("rating") or ""

        if not source or not external_id:
            result.errors.append({"row": row_num, "reason": "missing source or external_id"})
            result.skipped += 1
            continue

        inferred_media = media_type or _infer_media_type(source, media_type, None)
        title = await _resolve_title(session, source, external_id, inferred_media)
        if title is None:
            reason = f"could not resolve {source}/{external_id}"
            result.errors.append({"row": row_num, "reason": reason})
            result.skipped += 1
            continue

        # Parse status
        try:
            item_status = LibraryStatus(status_raw)
        except ValueError:
            result.errors.append({"row": row_num, "reason": f"invalid status '{status_raw}'"})
            result.skipped += 1
            continue

        # Check duplicate
        dup = (
            await session.execute(
                select(LibraryEntry).where(
                    LibraryEntry.user_id == user_id,
                    LibraryEntry.title_id == title.id,
                )
            )
        ).scalar_one_or_none()

        if dup is not None:
            result.skipped += 1
            continue

        rating = None
        if rating_raw:
            try:
                rating = int(rating_raw)
                if rating < 1 or rating > 10:
                    rating = None
            except ValueError:
                rating = None

        entry = LibraryEntry(
            user_id=user_id,
            title_id=title.id,
            status=item_status,
            rating=rating,
            notes=row.get("notes") or None,
        )
        session.add(entry)
        result.created += 1

    await session.commit()
    return result


def _find_first_id(ids: dict) -> tuple[str | None, str | None]:
    """Extract the first known external ID from a Trakt ids dict."""
    for key, src in [
        ("tmdb", "tmdb"),
        ("anilist", "anilist"),
        ("mal", "mal"),
        ("mangadex", "mangadex"),
        ("rawg", "rawg"),
    ]:
        value = ids.get(key)
        if value is not None:
            return src, str(value)
    return None, None


def _infer_media_type(source: str, trakt_type: str, media_type: MediaType | None) -> str | None:
    if media_type:
        return media_type.value
    if source == "tmdb":
        return trakt_type if trakt_type in ("movie", "show") else None
    if source == "rawg":
        return "game"
    if source in ("anilist", "mal"):
        return "anime"
    if source == "mangadex":
        return "manga"
    return None
