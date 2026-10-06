"""Title detail endpoint: /titles/{source}/{external_id} returns a fully
normalized title regardless of source and upserts it into the `titles` table
(the `id` is a composite `{source}/{external_id}` reference — see design.md §2)."""

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models import Episode, Title
from app.models.enums import ExternalSource, MediaType
from app.schemas import TitleDetail
from app.schemas.library import EpisodeRead
from app.services import registry
from app.services.episode_sync import sync_episodes
from app.services.title_store import SOURCE_ATTR, upsert_title

router = APIRouter(tags=["titles"])


async def fetch_detail(
    source: ExternalSource,
    external_id: str,
    media_type: str | None,
) -> TitleDetail:
    if source == ExternalSource.TMDB:
        if media_type not in (MediaType.MOVIE.value, MediaType.TV.value):
            raise HTTPException(
                status_code=400,
                detail="tmdb requires ?media_type=movie|tv",
            )
        client = registry.get_tmdb()
        if client is None:
            raise HTTPException(status_code=503, detail="TMDB source disabled (no API key)")
        return await client.detail(MediaType(media_type), external_id)

    if source == ExternalSource.RAWG:
        client = registry.get_rawg()
        if client is None:
            raise HTTPException(status_code=503, detail="RAWG source disabled (no API key)")
        return await client.detail(external_id)

    if source == ExternalSource.MANGADEX:
        return await registry.get_mangadex().detail(external_id)

    if source in (ExternalSource.JIKAN, ExternalSource.MAL):
        return await registry.get_jikan().detail(external_id)

    if source == ExternalSource.ANILIST:
        return await registry.get_anilist().detail(external_id)

    raise HTTPException(status_code=400, detail=f"unsupported source: {source}")


@router.get("/titles/{source}/{external_id}")
async def get_title(
    source: ExternalSource,
    external_id: str,
    media_type: str | None = Query(None, pattern="^(movie|tv|game|anime|manga)$"),
    country: str = Query(
        "IN",
        min_length=2,
        max_length=2,
        description="ISO country code for watch-provider filtering",
    ),
    session: AsyncSession = Depends(get_db),
) -> TitleDetail:
    try:
        detail = await fetch_detail(source, external_id, media_type)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"upstream request failed: {exc}") from exc
    detail.providers = [p for p in detail.providers if p.country == country.upper()]
    title = await upsert_title(session, detail)
    detail.id = str(title.id)
    return detail


@router.get("/titles/{source}/{external_id}/episodes", response_model=list[EpisodeRead])
async def list_title_episodes(
    source: ExternalSource,
    external_id: str,
    session: AsyncSession = Depends(get_db),
) -> list[Episode]:
    """Episodes/chapters already synced for this title (DB-only — no external calls).

    Returns 404 if the title was never fetched/synced; returns [] for synced
    titles that simply have no episodes (e.g. movies)."""
    attr = SOURCE_ATTR[source]
    title = (
        await session.execute(select(Title).where(getattr(Title, attr) == external_id))
    ).scalar_one_or_none()
    if title is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="title not in library cache — fetch /titles/{source}/{id} first",
        )
    result = await session.execute(
        select(Episode).where(Episode.title_id == title.id).order_by(Episode.season, Episode.number)
    )
    return list(result.scalars().all())


@router.post("/titles/{source}/{external_id}/episodes/sync")
async def sync_title_episodes(
    source: ExternalSource,
    external_id: str,
    media_type: str | None = Query(None, pattern="^(movie|tv|game|anime|manga)$"),
    session: AsyncSession = Depends(get_db),
) -> dict:
    try:
        detail = await fetch_detail(source, external_id, media_type)
        title = await upsert_title(session, detail)
        return await sync_episodes(session, source, title, detail)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="upstream episode request failed") from exc
