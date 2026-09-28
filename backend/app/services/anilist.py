"""AniList client — anime via GraphQL. Search and detail are single round trips
(fields batched per query, no N+1) per todos.md Phase 1 passing criteria."""

import logging
from datetime import date
from typing import Any

from app.models.enums import ExternalSource, MediaType
from app.schemas import SearchItem, TitleDetail
from app.services.base import BaseClient

logger = logging.getLogger(__name__)

TTL_24H = 24 * 3600

SEARCH_QUERY = """
query ($search: String) {
  Page(page: 1, perPage: 10) {
    media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
      id
      idMal
      title { romaji english }
      coverImage { large }
      startDate { year }
      genres
      description(asHtml: false)
      episodes
    }
  }
}
"""

DETAIL_QUERY = """
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    idMal
    title { romaji english native }
    coverImage { large }
    bannerImage
    startDate { year month day }
    endDate { year month day }
    genres
    description(asHtml: false)
    episodes
    duration
    season
    studios(isMain: true) { nodes { name } }
  }
}
"""


class AniListClient(BaseClient):
    base_url = "https://graphql.anilist.co"
    source = ExternalSource.ANILIST

    async def _graphql(self, query: str, variables: dict[str, Any]) -> dict:
        data = await self._post_json("/", {"query": query, "variables": variables})
        if data.get("errors"):
            logger.warning("anilist graphql errors: %s", data["errors"])
        return data.get("data") or {}

    async def search(self, query: str) -> list[SearchItem]:
        async def fetch() -> list[dict]:
            data = await self._graphql(SEARCH_QUERY, {"search": query})
            media_list = ((data.get("Page") or {}).get("media")) or []
            return [self._to_search_item(m).model_dump() for m in media_list[:10]]

        key = f"trakplus:anilist:search:{query.strip().lower()}"
        payload = await self._cached(key, TTL_24H, fetch)
        return [SearchItem.model_validate(p) for p in payload]

    async def detail(self, external_id: str) -> TitleDetail:
        async def fetch() -> dict:
            data = await self._graphql(DETAIL_QUERY, {"id": int(external_id)})
            return self._to_detail(data.get("Media") or {}).model_dump()

        key = f"trakplus:anilist:detail:{external_id}"
        payload = await self._cached(key, TTL_24H, fetch)
        return TitleDetail.model_validate(payload)

    @staticmethod
    def _name_of(media: dict) -> str:
        title = media.get("title") or {}
        return title.get("romaji") or title.get("english") or ""

    def _to_search_item(self, media: dict) -> SearchItem:
        start = media.get("startDate") or {}
        return SearchItem(
            source=self.source,
            source_id=str(media["id"]),
            media_type=MediaType.ANIME,
            title=self._name_of(media),
            year=start.get("year"),
            poster_url=(media.get("coverImage") or {}).get("large"),
            overview=media.get("description") or None,
        )

    @staticmethod
    def _start_date(media: dict) -> date | None:
        sd = media.get("startDate") or {}
        if sd.get("year") and sd.get("month") and sd.get("day"):
            return date(sd["year"], sd["month"], sd["day"])
        return None

    def _to_detail(self, media: dict) -> TitleDetail:
        title = media.get("title") or {}
        external_ids = {"anilist": str(media["id"])}
        if media.get("idMal"):
            external_ids["mal"] = str(media["idMal"])
        return TitleDetail(
            source=self.source,
            source_id=str(media["id"]),
            media_type=MediaType.ANIME,
            title=title.get("romaji") or title.get("english") or "",
            original_title=title.get("native"),
            synopsis=media.get("description") or None,
            release_date=self._start_date(media),
            genres=[g["name"] for g in media.get("genres", []) if "name" in g],
            poster_url=(media.get("coverImage") or {}).get("large"),
            backdrop_url=media.get("bannerImage"),
            runtime_minutes=media.get("duration"),
            episode_count=media.get("episodes"),
            external_ids=external_ids,
        )
