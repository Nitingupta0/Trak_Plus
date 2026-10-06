"""MangaDex client — manga search, detail, and chapter (feed) lists.

Respects MangaDex rate-limit headers implicitly via cached responses and
modest page sizes (design.md §4)."""

import logging
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.enums import ExternalSource, MediaType
from app.schemas import SearchItem, TitleDetail
from app.services.base import BaseClient

logger = logging.getLogger(__name__)

TTL_SEARCH_DETAIL = 24 * 3600
TTL_CHAPTERS = 1 * 3600
COVER_BASE = "https://uploads.mangadex.org/covers"


class ChapterInfo(BaseModel):
    source: ExternalSource = ExternalSource.MANGADEX
    manga_id: str
    chapter_id: str
    number: float | None = None
    title: str | None = None
    published_at: datetime | None = None


class ChapterList(BaseModel):
    manga_id: str
    total: int
    chapters: list[ChapterInfo] = Field(default_factory=list)


class MangaDexClient(BaseClient):
    base_url = "https://api.mangadex.org"
    source = ExternalSource.MANGADEX

    async def search(self, query: str) -> list[SearchItem]:
        async def fetch() -> list[dict]:
            data = await self._get_json(
                "manga",
                title=query,
                limit=10,
                **{"contentRating[]": "safe", "includes[]": "cover_art"},
            )
            return [self._to_search_item(r).model_dump() for r in data.get("data", [])[:10]]

        key = f"trakplus:mangadex:search:{query.strip().lower()}"
        payload = await self._cached(key, TTL_SEARCH_DETAIL, fetch)
        return [SearchItem.model_validate(p) for p in payload]

    async def detail(self, external_id: str) -> TitleDetail:
        async def fetch() -> dict:
            full = await self._get_json(f"manga/{external_id}", **{"includes[]": "cover_art"})
            manga_obj = full.get("data") or {}
            return self._to_detail({"id": external_id, **manga_obj}).model_dump()

        key = f"trakplus:mangadex:detail:{external_id}"
        payload = await self._cached(key, TTL_SEARCH_DETAIL, fetch)
        return TitleDetail.model_validate(payload)

    async def chapters(self, manga_id: str) -> ChapterList:
        async def fetch() -> dict:
            params: dict[str, Any] = {
                "limit": 500,
                "order[chapter]": "asc",
                "contentRating[]": "safe",
            }
            data = await self._get_json(
                f"manga/{manga_id}/feed", **{"translatedLanguage[]": "en"}, **params
            )
            if not data.get("data"):
                # Many licensed manga have 0 English chapters on MangaDex — fall
                # back to any language so the user at least gets chapter numbers.
                data = await self._get_json(f"manga/{manga_id}/feed", **params)
            chapter_list = ChapterList(
                manga_id=manga_id,
                total=int(data.get("total") or 0),
                chapters=[self._to_chapter(manga_id, r) for r in data.get("data", [])],
            )
            return chapter_list.model_dump(mode="json")

        key = f"trakplus:mangadex:chapters:{manga_id}"
        payload = await self._cached(key, TTL_CHAPTERS, fetch)
        return ChapterList.model_validate(payload)

    @staticmethod
    def _localized(attributes: dict, field: str) -> str | None:
        values = attributes.get(field) or {}
        if not isinstance(values, dict):
            return None
        return values.get("en") or next(iter(values.values()), None)

    @staticmethod
    def _cover_url(manga_id: str, relationships: list[dict]) -> str | None:
        for rel in relationships or []:
            if rel.get("type") == "cover_art":
                file_name = (rel.get("attributes") or {}).get("fileName")
                if file_name:
                    return f"{COVER_BASE}/{manga_id}/{file_name}"
        return None

    def _to_search_item(self, raw: dict) -> SearchItem:
        attributes: dict[str, Any] = raw.get("attributes") or {}
        manga_id = raw["id"]
        return SearchItem(
            source=self.source,
            source_id=manga_id,
            media_type=MediaType.MANGA,
            title=self._localized(attributes, "title") or "",
            year=attributes.get("year"),
            poster_url=self._cover_url(manga_id, raw.get("relationships") or []),
            overview=self._localized(attributes, "description"),
        )

    def _to_detail(self, raw: dict) -> TitleDetail:
        attributes: dict[str, Any] = raw.get("attributes") or {}
        manga_id = raw["id"]
        year = attributes.get("year")
        tags = attributes.get("tags") or []
        genres = [
            t["attributes"]["name"]["en"]
            for t in tags
            if (t.get("attributes") or {}).get("name", {}).get("en")
        ]
        return TitleDetail(
            source=self.source,
            source_id=manga_id,
            media_type=MediaType.MANGA,
            title=self._localized(attributes, "title") or "",
            original_title=None,
            synopsis=self._localized(attributes, "description"),
            release_date=date(year, 1, 1) if year else None,
            genres=genres,
            poster_url=self._cover_url(manga_id, raw.get("relationships") or []),
            external_ids={"mangadex": manga_id},
        )

    def _to_chapter(self, manga_id: str, raw: dict) -> ChapterInfo:
        attributes = raw.get("attributes") or {}
        number_raw = attributes.get("chapter")
        published = attributes.get("publishAt")
        return ChapterInfo(
            manga_id=manga_id,
            chapter_id=raw["id"],
            number=float(number_raw) if number_raw not in (None, "") else None,
            title=attributes.get("title") or None,
            published_at=(
                datetime.fromisoformat(published.replace("Z", "+00:00")) if published else None
            ),
        )
