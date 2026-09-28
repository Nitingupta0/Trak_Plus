"""TMDB client — movies + TV, with credits and watch providers in one detail call.

Uses `append_to_response=credits,watch/providers` so detail fetches cast and
providers without N+1 calls (design.md §4). Auth supports both the v3 key
(query param) and the v4 read-access token (Bearer header).
"""

import logging
from datetime import date
from typing import Any

import httpx

from app.core.config import get_settings
from app.models.enums import ExternalSource, MediaType, OfferType
from app.schemas import CastMember, ProviderOffer, SearchItem, TitleDetail
from app.services.base import BaseClient

logger = logging.getLogger(__name__)

IMAGE_BASE = "https://image.tmdb.org/t/p/w500"
TTL_24H = 24 * 3600


def _parse_date(value: Any) -> date | None:
    if isinstance(value, str) and value:
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None
    return None


class TMDBClient(BaseClient):
    base_url = "https://api.themoviedb.org/3"
    source = ExternalSource.TMDB

    def __init__(
        self,
        api_key: str,
        cache=None,
        http: httpx.AsyncClient | None = None,
    ) -> None:
        self.api_key = api_key
        self._bearer = api_key.startswith("eyJ")
        if http is None:
            headers = {"Authorization": f"Bearer {api_key}"} if self._bearer else None
            http = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=10.0,
                headers=headers,
                verify=get_settings().external_api_verify_ssl,
            )
        super().__init__(cache, http)

    def _auth_params(self) -> dict[str, str]:
        return {} if self._bearer else {"api_key": self.api_key}

    async def search(self, media_type: MediaType, query: str) -> list[SearchItem]:
        if media_type not in (MediaType.MOVIE, MediaType.TV):
            return []
        path = "search/movie" if media_type == MediaType.MOVIE else "search/tv"

        async def fetch() -> list[dict]:
            data = await self._get_json(path, **self._auth_params(), query=query, page=1)
            raw_items = data.get("results", [])[:10]
            return [self._to_search_item(r, media_type).model_dump() for r in raw_items]

        key = f"trakplus:tmdb:search:{media_type.value}:{query.strip().lower()}"
        payload = await self._cached(key, TTL_24H, fetch)
        return [SearchItem.model_validate(p) for p in payload]

    async def detail(self, media_type: MediaType, external_id: str) -> TitleDetail:
        if media_type not in (MediaType.MOVIE, MediaType.TV):
            raise ValueError(f"TMDBClient only handles movie/tv, got {media_type}")
        path = f"{'movie' if media_type == MediaType.MOVIE else 'tv'}/{external_id}"

        async def fetch() -> dict:
            data = await self._get_json(
                path,
                **self._auth_params(),
                append_to_response="credits,watch/providers",
            )
            return self._to_detail(data, media_type).model_dump()

        key = f"trakplus:tmdb:detail:{media_type.value}:{external_id}"
        payload = await self._cached(key, TTL_24H, fetch)
        return TitleDetail.model_validate(payload)

    async def season(self, tv_id: str, season_number: int) -> list[dict]:
        """Episodes of one TV season (cached). Used by the episode sync service."""

        async def fetch() -> list[dict]:
            data = await self._get_json(f"tv/{tv_id}/season/{season_number}", **self._auth_params())
            return [
                {
                    "number": e.get("episode_number"),
                    "name": e.get("name"),
                    "air_date": e.get("air_date"),
                    "description": e.get("overview") or None,
                    "thumbnail_url": (
                        f"{IMAGE_BASE}{e['still_path']}" if e.get("still_path") else None
                    ),
                }
                for e in data.get("episodes", [])
            ]

        key = f"trakplus:tmdb:season:{tv_id}:{season_number}"
        return await self._cached(key, TTL_24H, fetch)

    @staticmethod
    def _title_of(data: dict) -> str:
        return data.get("title") or data.get("name") or ""

    @staticmethod
    def _date_of(data: dict) -> date | None:
        return _parse_date(data.get("release_date") or data.get("first_air_date"))

    @staticmethod
    def _year_of(data: dict) -> int | None:
        parsed = TMDBClient._date_of(data)
        return parsed.year if parsed else None

    def _to_search_item(self, raw: dict, media_type: MediaType) -> SearchItem:
        poster_path = raw.get("poster_path")
        return SearchItem(
            source=self.source,
            source_id=str(raw["id"]),
            media_type=media_type,
            title=self._title_of(raw),
            year=self._year_of(raw),
            poster_url=f"{IMAGE_BASE}{poster_path}" if poster_path else None,
            overview=raw.get("overview") or None,
        )

    def _providers(self, data: dict) -> list[ProviderOffer]:
        results = (data.get("watch/providers") or {}).get("results") or {}
        offers: list[ProviderOffer] = []
        for country, grouped in results.items():
            for offer_type, key in (
                (OfferType.STREAM, "flatrate"),
                (OfferType.RENT, "rent"),
                (OfferType.BUY, "buy"),
            ):
                for provider in grouped.get(key) or []:
                    offers.append(
                        ProviderOffer(
                            country=country,
                            provider_name=provider["provider_name"],
                            offer_type=offer_type,
                        )
                    )
        return offers

    def _to_detail(self, data: dict, media_type: MediaType) -> TitleDetail:
        cast_raw = ((data.get("credits") or {}).get("cast")) or []
        cast = [
            CastMember(
                name=c.get("name") or "",
                character=c.get("character"),
                profile_url=f"{IMAGE_BASE}{c['profile_path']}" if c.get("profile_path") else None,
            )
            for c in cast_raw[:15]
        ]
        episode_run_times = data.get("episode_run_time") or []
        return TitleDetail(
            source=self.source,
            source_id=str(data["id"]),
            media_type=media_type,
            title=self._title_of(data),
            original_title=data.get("original_title") or data.get("original_name"),
            synopsis=data.get("overview") or None,
            release_date=self._date_of(data),
            genres=[g["name"] for g in data.get("genres", []) if "name" in g],
            poster_url=f"{IMAGE_BASE}{data['poster_path']}" if data.get("poster_path") else None,
            backdrop_url=(
                f"{IMAGE_BASE}{data['backdrop_path']}" if data.get("backdrop_path") else None
            ),
            runtime_minutes=(
                data.get("runtime")
                if media_type == MediaType.MOVIE
                else (episode_run_times[0] if episode_run_times else None)
            ),
            episode_count=data.get("number_of_episodes"),
            season_count=data.get("number_of_seasons"),
            cast=cast,
            providers=self._providers(data),
            external_ids={"tmdb": str(data["id"])},
        )
