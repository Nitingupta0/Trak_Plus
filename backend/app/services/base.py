"""Shared plumbing for external API clients (design.md §2: one client per source)."""

from typing import Any

import httpx

from app.core.config import get_settings
from app.core.metrics import external_api_calls
from app.services.cache import CacheLayer

DEFAULT_TIMEOUT_SECONDS = 10.0


class BaseClient:
    base_url: str
    source: str = "unknown"

    def __init__(
        self,
        cache: CacheLayer | None = None,
        http: httpx.AsyncClient | None = None,
    ) -> None:
        self._cache = cache
        self._http = http or httpx.AsyncClient(
            base_url=self.base_url,
            timeout=DEFAULT_TIMEOUT_SECONDS,
            verify=get_settings().external_api_verify_ssl,
        )

    async def _get_json(self, path: str, **params: Any) -> Any:
        external_api_calls.labels(self.source).inc()
        response = await self._http.get(path, params=params)
        response.raise_for_status()
        return response.json()

    async def _post_json(self, path: str, payload: dict[str, Any]) -> Any:
        external_api_calls.labels(self.source).inc()
        response = await self._http.post(path, json=payload)
        response.raise_for_status()
        return response.json()

    async def aclose(self) -> None:
        await self._http.aclose()

    async def _cached(self, key: str, ttl_seconds: int, factory):
        if self._cache is None:
            return await factory()
        return await self._cache.get_or_set_json(key, ttl_seconds, factory)
