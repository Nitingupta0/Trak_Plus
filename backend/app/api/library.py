"""Library CRUD — all queries scoped by the token's user_id (data isolation)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models import LibraryEntry, Title, User
from app.schemas.library import LibraryEntryCreate, LibraryEntryRead, LibraryEntryUpdate, TitleBrief

router = APIRouter(prefix="/library", tags=["library"])


def _serialize_entry(entry: LibraryEntry) -> LibraryEntryRead:
    """Explicit mapping — Pydantic's from_attributes skips Python properties on
    SQLAlchemy instances (source/source_id are computed properties, not columns)."""
    return LibraryEntryRead(
        id=entry.id,
        status=entry.status,
        rating=entry.rating,
        notes=entry.notes,
        playtime_minutes=entry.playtime_minutes,
        added_at=entry.added_at,
        updated_at=entry.updated_at,
        title=TitleBrief(
            id=entry.title.id,
            title=entry.title.title,
            media_type=entry.title.media_type,
            release_date=entry.title.release_date,
            poster_url=entry.title.poster_url,
            source=entry.title.primary_source,
            source_id=entry.title.primary_source_id,
        ),
    )


async def _get_owned_entry(entry_id: uuid.UUID, user: User, session: AsyncSession) -> LibraryEntry:
    entry = (
        await session.execute(
            select(LibraryEntry).where(LibraryEntry.id == entry_id, LibraryEntry.user_id == user.id)
        )
    ).scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="library entry not found")
    return entry


async def _refetch_entry(entry_id: uuid.UUID, session: AsyncSession) -> LibraryEntry:
    """Re-select after commit so the eager-loaded title relationship is fresh."""
    stmt = select(LibraryEntry).where(LibraryEntry.id == entry_id)
    return (await session.execute(stmt)).scalar_one()


@router.get("", response_model=list[LibraryEntryRead])
async def list_library(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[LibraryEntryRead]:
    result = await session.execute(
        select(LibraryEntry)
        .where(LibraryEntry.user_id == user.id)
        .order_by(LibraryEntry.added_at.desc())
    )
    return [_serialize_entry(entry) for entry in result.scalars().all()]


@router.post("", response_model=LibraryEntryRead, status_code=status.HTTP_201_CREATED)
async def add_entry(
    payload: LibraryEntryCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> LibraryEntry:
    title = (
        await session.execute(select(Title).where(Title.id == payload.title_id))
    ).scalar_one_or_none()
    if title is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="title not found")

    duplicate = (
        await session.execute(
            select(LibraryEntry).where(
                LibraryEntry.user_id == user.id, LibraryEntry.title_id == payload.title_id
            )
        )
    ).scalar_one_or_none()
    if duplicate is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="title already in library")

    entry = LibraryEntry(
        user_id=user.id,
        title_id=payload.title_id,
        status=payload.status,
        rating=payload.rating,
        notes=payload.notes,
    )
    session.add(entry)
    await session.commit()
    return _serialize_entry(await _refetch_entry(entry.id, session))


@router.patch("/{entry_id}", response_model=LibraryEntryRead)
async def update_entry(
    entry_id: uuid.UUID,
    payload: LibraryEntryUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> LibraryEntry:
    entry = await _get_owned_entry(entry_id, user, session)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)
    await session.commit()
    return _serialize_entry(await _refetch_entry(entry.id, session))


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
    entry_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    entry = await _get_owned_entry(entry_id, user, session)
    await session.delete(entry)
    await session.commit()
