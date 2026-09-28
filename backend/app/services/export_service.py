"""Library export — generates Trakt-compatible JSON and generic CSV
(design.md §6)."""

import csv
import io
import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import LibraryEntry, Title
from app.models.enums import LibraryStatus, MediaType
from app.schemas.import_export import (
    TraktExport,
    TraktHistoryItem,
    TraktIds,
    TraktMovie,
    TraktRatingItem,
    TraktShow,
    TraktWatchlistItem,
)

logger = logging.getLogger(__name__)


def _trakt_ids(title: Title) -> TraktIds:
    return TraktIds(
        tmdb=title.tmdb_id,
        rawg=title.rawg_id,
        anilist=title.anilist_id,
        mal=int(title.mal_id) if title.mal_id and title.mal_id.isdigit() else None,
        mangadex=title.mangadex_id,
    )


def _media_type_prefix(media_type: str) -> str:
    """Map our media types to Trakt's type strings."""
    if media_type in ("movie", "tv"):
        return media_type
    if media_type == "anime":
        return "show"
    return "movie"  # games and manga have no direct Trakt equivalent


async def export_trakt(session: AsyncSession, user_id: str) -> TraktExport:
    """Build a Trakt-compatible export from the user's library."""
    entries = (
        (
            await session.execute(
                select(LibraryEntry)
                .options(selectinload(LibraryEntry.title))
                .where(LibraryEntry.user_id == user_id)
                .order_by(LibraryEntry.added_at)
            )
        )
        .scalars()
        .all()
    )

    history: list[TraktHistoryItem] = []
    ratings: list[TraktRatingItem] = []
    watchlist: list[TraktWatchlistItem] = []

    for entry in entries:
        title = entry.title
        ids = _trakt_ids(title)
        year = title.release_date.year if title.release_date else None
        trakt_type = _media_type_prefix(title.media_type.value)
        trakt_movie = TraktMovie(title=title.title, year=year, ids=ids)
        is_show = title.media_type in (MediaType.TV, MediaType.ANIME)
        trakt_show = TraktShow(title=title.title, year=year, ids=ids) if is_show else None

        added_at = entry.added_at.isoformat() if entry.added_at else datetime.now(UTC).isoformat()

        # Watchlist: plan_to / on_hold statuses
        if entry.status in (LibraryStatus.PLAN_TO, LibraryStatus.ON_HOLD):
            watchlist.append(
                TraktWatchlistItem(
                    listed_at=added_at, type=trakt_type, movie=trakt_movie, show=trakt_show
                )
            )

        # Ratings: entries with a rating
        if entry.rating is not None:
            rated_at = entry.updated_at.isoformat() if entry.updated_at else added_at
            ratings.append(
                TraktRatingItem(
                    rated_at=rated_at,
                    rating=entry.rating,
                    type=trakt_type,
                    movie=trakt_movie,
                    show=trakt_show,
                )
            )

        # History: watching / completed / dropped — plus progress records
        if entry.status in (LibraryStatus.WATCHING, LibraryStatus.COMPLETED, LibraryStatus.DROPPED):
            history.append(
                TraktHistoryItem(
                    watched_at=added_at,
                    action="watch",
                    type=trakt_type,
                    movie=trakt_movie,
                    show=trakt_show,
                )
            )

    return TraktExport(history=history, ratings=ratings, watchlist=watchlist)


async def export_csv(session: AsyncSession, user_id: str) -> str:
    """Generate a CSV string from the user's library."""
    entries = (
        (
            await session.execute(
                select(LibraryEntry)
                .options(selectinload(LibraryEntry.title))
                .where(LibraryEntry.user_id == user_id)
                .order_by(LibraryEntry.added_at)
            )
        )
        .scalars()
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "source",
            "external_id",
            "media_type",
            "title",
            "status",
            "rating",
            "notes",
            "added_at",
            "updated_at",
        ]
    )

    for entry in entries:
        title = entry.title
        source = title.primary_source or ""
        source_id = title.primary_source_id or ""
        writer.writerow(
            [
                source,
                source_id,
                title.media_type.value,
                title.title,
                entry.status.value,
                entry.rating or "",
                entry.notes or "",
                entry.added_at.isoformat() if entry.added_at else "",
                entry.updated_at.isoformat() if entry.updated_at else "",
            ]
        )

    return output.getvalue()
