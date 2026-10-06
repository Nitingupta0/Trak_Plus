"""Unified cross-source search (design.md §4): fans out across all enabled
sources concurrently, normalizes into common shapes, returns merged results."""

import asyncio
import logging
from collections.abc import Coroutine

from fastapi import APIRouter, Query

from app.models.enums import MediaType
from app.schemas import SearchItem
from app.services import registry

logger = logging.getLogger(__name__)

router = APIRouter(tags=["search"])

VALID_TYPES = {"all", "movie", "tv", "game", "anime", "manga"}


@router.get("/search")
async def search(
    q: str = Query(..., min_length=1, max_length=200),
    type: str = Query("all", pattern="^(all|movie|tv|game|anime|manga)$"),  # noqa: A002
) -> dict:
    wanted = VALID_TYPES - {"all"} if type == "all" else {type}
    tasks: list[Coroutine] = []
    labels: list[str] = []

    tmdb_client = registry.get_tmdb()
    if tmdb_client:
        for mt, label in ((MediaType.MOVIE, "movie"), (MediaType.TV, "tv")):
            if label in wanted:
                tasks.append(tmdb_client.search(mt, q))
                labels.append(label)

    rawg_client = registry.get_rawg()
    if rawg_client and "game" in wanted:
        tasks.append(rawg_client.search(q))
        labels.append("game")

    if "anime" in wanted:
        tasks.append(registry.get_anilist().search(q))
        labels.append("anime")

    if "manga" in wanted:
        tasks.append(registry.get_mangadex().search(q))
        labels.append("manga")

    gathered = await asyncio.gather(*tasks, return_exceptions=True)
    results: list[SearchItem] = []
    for label, outcome in zip(labels, gathered, strict=True):
        if isinstance(outcome, BaseException):
            logger.warning("search source %s failed: %s", label, outcome.__class__.__name__)
            continue
        results.extend(outcome)

    return {
        "query": q,
        "count": len(results),
        "results": [r.model_dump(mode="json") for r in results],
    }
