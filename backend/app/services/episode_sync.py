"""Populate the `episodes` table for a title (design.md §3).

- TV (TMDB): per-season fetches (cached 24h in the client).
- Anime (AniList/Jikan): flat stub episodes 1..episode_count (no episode metadata).
- Manga (MangaDex): chapter feed with titles and publish dates.

Re-syncs are idempotent while refreshing any metadata supplied by the source."""

import logging
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Episode, Title
from app.models.enums import ExternalSource, MediaType
from app.schemas import TitleDetail
from app.services import registry
from app.services.tmdb import _parse_date

logger = logging.getLogger(__name__)


def _stub_rows(title_id: str, count: int) -> list[dict]:
    return [
        {
            "number": n,
            "season": 0,
            "name": None,
            "air_date": None,
            "description": None,
            "thumbnail_url": None,
        }
        for n in range(1, count + 1)
    ]


async def _tmdb_rows(external_id: str, season_count: int) -> list[dict]:
    client = registry.get_tmdb()
    rows: list[dict] = []
    for season in range(1, (season_count or 0) + 1):
        for e in await client.season(external_id, season):
            rows.append(
                {
                    "number": e["number"],
                    "season": season,
                    "name": e.get("name"),
                    "air_date": _parse_date(e.get("air_date")),
                    "description": e.get("description"),
                    "thumbnail_url": e.get("thumbnail_url"),
                }
            )
    return rows


async def _mangadex_rows(external_id: str) -> list[dict]:
    feed = await registry.get_mangadex().chapters(external_id)
    rows: list[dict] = []
    for ch in feed.chapters:
        published: date | None = None
        if ch.published_at:
            published = (
                ch.published_at.date() if isinstance(ch.published_at, datetime) else ch.published_at
            )
        rows.append(
            {
                "number": int(ch.number) if ch.number is not None else None,
                "season": 0,
                "name": ch.title,
                "air_date": published,
                "description": None,
                "thumbnail_url": None,
            }
        )
    return [r for r in rows if r["number"] is not None]


async def sync_episodes(
    session: AsyncSession, source: ExternalSource, title: Title, detail: TitleDetail
) -> dict:
    if source == ExternalSource.TMDB and title.media_type == MediaType.TV:
        rows = await _tmdb_rows(detail.source_id, detail.season_count or 0)
    elif (
        source in (ExternalSource.ANILIST, ExternalSource.JIKAN, ExternalSource.MAL)
        and title.media_type == MediaType.ANIME
    ):
        rows = _stub_rows(title.id, detail.episode_count or 0)
    elif source == ExternalSource.MANGADEX and title.media_type == MediaType.MANGA:
        rows = await _mangadex_rows(detail.source_id)
    else:
        return {"created": 0, "total": 0, "message": "media type has no episodes"}

    existing_rows = {
        (episode.season, episode.number): episode
        for episode in (
            await session.execute(select(Episode).where(Episode.title_id == title.id))
        ).scalars()
    }
    created = 0
    for row in rows:
        key = (row["season"], row["number"])
        episode = existing_rows.get(key)
        if episode is None:
            episode = Episode(
                title_id=title.id,
                number=row["number"],
                season=row["season"],
            )
            session.add(episode)
            existing_rows[key] = episode
            created += 1

        # Do not erase metadata when a provider has no value for a field. This
        # lets TMDB backfill old rows while keeping provider-specific nulls.
        for field in ("name", "air_date", "description", "thumbnail_url"):
            value = row.get(field)
            if value is not None:
                setattr(episode, field, value)
    await session.commit()

    total = (
        (await session.execute(select(Episode.id).where(Episode.title_id == title.id)))
        .scalars()
        .all()
    )
    logger.info(
        "episode sync %s/%s: +%d created, %d total",
        source.value,
        detail.source_id,
        created,
        len(total),
    )
    return {"created": created, "total": len(total)}
