"""RAWG client — games. Requests are counted and logged (todos.md Phase 1)."""

import logging
from datetime import date

import httpx

from app.models.enums import ExternalSource, MediaType
from app.schemas import SearchItem, TitleDetail
from app.services.base import BaseClient

logger = logging.getLogger(__name__)

TTL_24H = 24 * 3600


class RAWGClient(BaseClient):
    base_url = "https://api.rawg.io/api"
    source = ExternalSource.RAWG

    total_requests = 0

    def __init__(self, api_key: str, cache=None, http: httpx.AsyncClient | None = None) -> None:
        self.api_key = api_key
        self.instance_requests = 0
        super().__init__(cache, http)

    async def _get(self, path: str, **params):
        RAWGClient.total_requests += 1
        self.instance_requests += 1
        logger.info(
            "RAWG request (class total #%d, client instance #%d): GET %s",
            RAWGClient.total_requests,
            self.instance_requests,
            path,
        )
        return await self._get_json(path, key=self.api_key, **params)

    async def search(self, query: str) -> list[SearchItem]:
        async def fetch() -> list[dict]:
            data = await self._get("games", search=query, page_size=10)
            return [self._to_search_item(r).model_dump() for r in data.get("results", [])[:10]]

        key = f"trakplus:rawg:search:{query.strip().lower()}"
        payload = await self._cached(key, TTL_24H, fetch)
        return [SearchItem.model_validate(p) for p in payload]

    async def detail(self, external_id: str) -> TitleDetail:
        async def fetch() -> dict:
            data = await self._get(f"games/{external_id}")
            return self._to_detail(data).model_dump()

        key = f"trakplus:rawg:detail:{external_id}"
        payload = await self._cached(key, TTL_24H, fetch)
        return TitleDetail.model_validate(payload)

    def _to_search_item(self, raw: dict) -> SearchItem:
        released = raw.get("released")
        poster = raw.get("background_image")
        if poster and poster.startswith("/"):
            poster = f"https://api.rawg.io/media{poster}"
        return SearchItem(
            source=self.source,
            source_id=str(raw["id"]),
            media_type=MediaType.GAME,
            title=raw.get("name") or "",
            year=int(released[:4]) if released and released[:4].isdigit() else None,
            poster_url=poster,
            overview=None,
        )

    def _to_detail(self, data: dict) -> TitleDetail:
        released = data.get("released")
        poster = data.get("background_image")
        if poster and poster.startswith("/"):
            poster = f"https://api.rawg.io/media{poster}"
        return TitleDetail(
            source=self.source,
            source_id=str(data["id"]),
            media_type=MediaType.GAME,
            title=data.get("name") or "",
            original_title=None,
            synopsis=data.get("description_raw") or None,
            release_date=date.fromisoformat(released) if released else None,
            genres=[g["name"] for g in data.get("genres", []) if "name" in g],
            poster_url=poster,
            backdrop_url=None,
            runtime_minutes=data.get("playtime") or None,
            external_ids={"rawg": str(data["id"])},
        )
