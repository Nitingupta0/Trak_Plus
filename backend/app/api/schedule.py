"""Schedule — upcoming/recent unwatched, dated episodes across the user's library.

Joins library_entries → episodes (with air_date), excludes already-watched
episodes, sorts by air_date. This powers the Schedule/Calendar view."""

from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models import Episode, LibraryEntry, Progress, Title, User
from app.schemas.schedule import ScheduleItem, ScheduleResponse

router = APIRouter(prefix="/schedule", tags=["schedule"])


@router.get("", response_model=ScheduleResponse)
async def get_schedule(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    days_back: int = 30,
) -> ScheduleResponse:
    """Unwatched, dated episodes across the user's library.

    `days_back` bounds how far into the past the backlog reaches (keeps the
    payload sane for shows that ended years ago)."""
    cutoff = date.today() - timedelta(days=max(0, min(days_back, 365)))

    watched_ids = (
        select(Progress.episode_id)
        .join(LibraryEntry, LibraryEntry.id == Progress.library_entry_id)
        .where(LibraryEntry.user_id == user.id)
        .scalar_subquery()
    )

    # Keep the existing episode behavior, including plan_to entries: a planned
    # serial can show its release event and any already-synced future episodes.
    episode_stmt = (
        select(Episode, LibraryEntry, Title)
        .join(LibraryEntry, LibraryEntry.title_id == Episode.title_id)
        .join(Title, Title.id == Episode.title_id)
        .where(
            LibraryEntry.user_id == user.id,
            LibraryEntry.status.in_(["watching", "playing", "reading", "plan_to", "on_hold"]),
            Episode.air_date.is_not(None),
            Episode.id.not_in(watched_ids),
            Episode.air_date >= cutoff,
        )
    )

    # A title event is the provider's title-level release/premiere date. This
    # is intentionally separate from episode events so movies and games can be
    # scheduled without inventing an episode row.
    title_stmt = (
        select(LibraryEntry, Title)
        .join(Title, Title.id == LibraryEntry.title_id)
        .where(
            LibraryEntry.user_id == user.id,
            LibraryEntry.status == "plan_to",
            Title.release_date.is_not(None),
            Title.release_date >= cutoff,
        )
    )

    episode_rows = (await session.execute(episode_stmt)).all()
    title_rows = (await session.execute(title_stmt)).all()

    def common_fields(entry: LibraryEntry, title: Title) -> dict[str, Any]:
        return {
            "entry_id": entry.id,
            "title_id": title.id,
            "title": title.title,
            "media_type": title.media_type,
            "poster_url": title.poster_url,
            "source": title.primary_source,
            "source_id": title.primary_source_id,
            "status": entry.status,
        }

    title_items = [
        ScheduleItem(
            kind="title",
            event_id=f"title:{entry.id}",
            **common_fields(entry, title),
            scheduled_date=title.release_date,
            air_date=title.release_date,
        )
        for entry, title in title_rows
        if title.release_date is not None
    ]
    episode_items = [
        ScheduleItem(
            kind="episode",
            event_id=f"episode:{episode.id}",
            **common_fields(entry, title),
            scheduled_date=episode.air_date,
            air_date=episode.air_date,
            episode_id=episode.id,
            episode_number=episode.number,
            season=episode.season,
            episode_name=episode.name,
        )
        for episode, entry, title in episode_rows
        if episode.air_date is not None
    ]

    today = date.today()

    def event_sort_key(item: ScheduleItem) -> tuple[date, int, str, int, int, str]:
        # Title events precede episode events on the same date, then preserve a
        # stable human ordering for otherwise-tied events.
        return (
            item.scheduled_date,
            0 if item.kind == "title" else 1,
            item.title.casefold(),
            item.season if item.season is not None else -1,
            item.episode_number if item.episode_number is not None else -1,
            item.event_id,
        )

    items = sorted(title_items + episode_items, key=event_sort_key)
    upcoming = [item for item in items if item.scheduled_date >= today]
    backlog = [item for item in items if item.scheduled_date < today]
    backlog.sort(key=event_sort_key, reverse=True)

    return ScheduleResponse(upcoming=upcoming, backlog=backlog)
