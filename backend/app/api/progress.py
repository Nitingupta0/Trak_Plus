"""Episode/chapter progress tracking. Idempotent mark/unmark; per-entry watched
counts. All entry access is ownership-scoped (data isolation)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.library import _get_owned_entry
from app.core.db import get_db
from app.models import Episode, Progress, User
from app.schemas.library import ProgressSummary

router = APIRouter(prefix="/library/{entry_id}/progress", tags=["progress"])


async def _validate_episode_belongs_to_entry(
    entry_title_id: uuid.UUID, episode_id: uuid.UUID, session: AsyncSession
) -> None:
    episode = (
        await session.execute(
            select(Episode).where(Episode.id == episode_id, Episode.title_id == entry_title_id)
        )
    ).scalar_one_or_none()
    if episode is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="episode not found for this title",
        )


async def _summary(entry, session: AsyncSession) -> ProgressSummary:
    watched_ids = (
        (
            await session.execute(
                select(Progress.episode_id).where(Progress.library_entry_id == entry.id)
            )
        )
        .scalars()
        .all()
    )
    total = (
        await session.execute(
            select(func.count()).select_from(Episode).where(Episode.title_id == entry.title_id)
        )
    ).scalar_one()
    return ProgressSummary(
        library_entry_id=entry.id,
        watched_count=len(watched_ids),
        total_episodes=total if total > 0 else None,
        watched_episode_ids=list(watched_ids),
    )


@router.post("/{episode_id}", response_model=ProgressSummary)
async def mark_watched(
    entry_id: uuid.UUID,
    episode_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ProgressSummary:
    entry = await _get_owned_entry(entry_id, user, session)
    await _validate_episode_belongs_to_entry(entry.title_id, episode_id, session)
    existing = (
        await session.execute(
            select(Progress).where(
                Progress.library_entry_id == entry.id, Progress.episode_id == episode_id
            )
        )
    ).scalar_one_or_none()
    if existing is None:
        session.add(Progress(library_entry_id=entry.id, episode_id=episode_id))
        await session.commit()
    return await _summary(entry, session)


@router.delete("/{episode_id}", response_model=ProgressSummary)
async def unmark_watched(
    entry_id: uuid.UUID,
    episode_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ProgressSummary:
    entry = await _get_owned_entry(entry_id, user, session)
    await session.execute(
        delete(Progress).where(
            Progress.library_entry_id == entry.id, Progress.episode_id == episode_id
        )
    )
    await session.commit()
    return await _summary(entry, session)


@router.get("", response_model=ProgressSummary)
async def get_progress(
    entry_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ProgressSummary:
    entry = await _get_owned_entry(entry_id, user, session)
    return await _summary(entry, session)
