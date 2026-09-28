"""Persist normalized title details into the `titles` table (design.md §3).

Acts as the internal title cache: /titles/{source}/{id} upserts the row so
library entries and progress can reference a stable internal UUID even though
the underlying metadata comes from external sources."""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Title
from app.models.enums import ExternalSource
from app.schemas import TitleDetail

logger = logging.getLogger(__name__)

SOURCE_ATTR = {
    ExternalSource.TMDB: "tmdb_id",
    ExternalSource.RAWG: "rawg_id",
    ExternalSource.ANILIST: "anilist_id",
    ExternalSource.JIKAN: "mal_id",
    ExternalSource.MAL: "mal_id",
    ExternalSource.MANGADEX: "mangadex_id",
}


async def upsert_title(session: AsyncSession, detail: TitleDetail) -> Title:
    attr = SOURCE_ATTR[detail.source]
    stmt = select(Title).where(getattr(Title, attr) == detail.source_id)
    title = (await session.execute(stmt)).scalar_one_or_none()

    fields = dict(
        media_type=detail.media_type,
        title=detail.title,
        original_title=detail.original_title,
        synopsis=detail.synopsis,
        release_date=detail.release_date,
        genres=detail.genres,
        poster_url=detail.poster_url,
        backdrop_url=detail.backdrop_url,
        raw_metadata=detail.model_dump(mode="json"),
    )

    if title is None:
        title = Title(**fields, **{attr: detail.source_id})
        session.add(title)
    else:
        for key, value in fields.items():
            setattr(title, key, value)

    for source, external_id in detail.external_ids.items():
        try:
            other_attr = SOURCE_ATTR[ExternalSource(source)]
        except KeyError:
            continue
        if getattr(title, other_attr) is None:
            setattr(title, other_attr, external_id)

    await session.commit()
    await session.refresh(title)
    logger.info("upserted title %s (%s/%s)", title.id, detail.source.value, detail.source_id)
    return title
