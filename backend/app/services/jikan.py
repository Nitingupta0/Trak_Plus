"""Jikan client — unofficial MAL REST API. Used only as fallback / MAL-ID
cross-reference (design.md §4) and respects the informal ~3 req/sec limit with
basic exponential backoff on 429s (todos.md Phase 1)."""

import asyncio
import logging
from datetime import date

import httpx

from app.models.enums import ExternalSource, MediaType
from app.schemas import SearchItem, TitleDetail
from app.services.base import BaseClient

logger = logging.getLogger(__name__)

TTL_24H = 24 * 3600
MAX_ATTEMPTS = 3
INITIAL_BACKOFF_SECONDS = 1.0


class JikanClient(BaseClient):
    base_url = "https://api.jikan.moe/v4"
    source = ExternalSource.JIKAN

    async def _get_with_backoff(self, path: str, **params):
        delay = INITIAL_BACKOFF_SECONDS
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                return await self._get_json(path, **params)
            except httpx.HTTPStatusError as exc:
                status = exc.response.status_code
                if status == 429 and attempt < MAX_ATTEMPTS:
                    logger.warning(
                        "jikan rate-limited (attempt %d/%d); backing off %.1fs",
                        attempt,
                        MAX_ATTEMPTS,
                        delay,
                    )
                    await asyncio.sleep(delay)
                    delay *= 2
                    continue
                raise
        raise RuntimeError("unreachable")

    async def search(self, query: str) -> list[SearchItem]:
        async def fetch() -> list[dict]:
            data = await self._get_with_backoff("anime", q=query, limit=10, sfw="true")
            return [self._to_search_item(r).model_dump() for r in data.get("data", [])[:10]]

        key = f"trakplus:jikan:search:{query.strip().lower()}"
        payload = await self._cached(key, TTL_24H, fetch)
        return [SearchItem.model_validate(p) for p in payload]

    async def detail(self, external_id: str) -> TitleDetail:
        async def fetch() -> dict:
            data = await self._get_with_backoff(f"anime/{external_id}/full")
            return self._to_detail(data.get("data") or {}).model_dump()

        key = f"trakplus:jikan:detail:{external_id}"
        payload = await self._cached(key, TTL_24H, fetch)
        return TitleDetail.model_validate(payload)

    def _to_search_item(self, raw: dict) -> SearchItem:
        return SearchItem(
            source=self.source,
            source_id=str(raw["mal_id"]),
            media_type=MediaType.ANIME,
            title=raw.get("title") or raw.get("title_english") or "",
            year=raw.get("year"),
            poster_url=((raw.get("images") or {}).get("jpg") or {}).get("large_image_url"),
            overview=raw.get("synopsis") or None,
        )

    def _to_detail(self, data: dict) -> TitleDetail:
        aired_from = (data.get("aired") or {}).get("from")
        duration_raw = str(data.get("duration") or "").split()
        runtime = int(duration_raw[0]) if duration_raw and duration_raw[0].isdigit() else None
        return TitleDetail(
            source=self.source,
            source_id=str(data["mal_id"]),
            media_type=MediaType.ANIME,
            title=data.get("title") or data.get("title_english") or "",
            original_title=data.get("title_japanese"),
            synopsis=data.get("synopsis") or None,
            release_date=date.fromisoformat(aired_from[:10]) if aired_from else None,
            genres=[g["name"] for g in data.get("genres", []) if "name" in g],
            poster_url=((data.get("images") or {}).get("jpg") or {}).get("large_image_url"),
            backdrop_url=(data.get("trailer") or {}).get("images", {}).get("maximum_image_url"),
            runtime_minutes=runtime,
            episode_count=data.get("episodes"),
            external_ids={"mal": str(data["mal_id"])},
        )
