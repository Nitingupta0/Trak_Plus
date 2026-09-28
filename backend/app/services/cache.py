"""Redis cache-aside layer (design.md §2).

Clients hand this a key + TTL + an async fetcher; the layer returns cached
JSON when present, otherwise calls the fetcher and stores the (normalized)
result. Redis outages degrade to "no cache" instead of failing requests.
"""

import json
import logging
from collections.abc import Awaitable, Callable
from typing import Any

import redis.asyncio as redis

logger = logging.getLogger(__name__)


class CacheLayer:
    def __init__(self, redis_client: redis.Redis) -> None:
        self.redis = redis_client
        self.hits = 0
        self.misses = 0

    async def get_or_set_json(
        self,
        key: str,
        ttl_seconds: int,
        factory: Callable[[], Awaitable[Any]],
    ) -> Any:
        try:
            cached = await self.redis.get(key)
        except Exception:  # noqa: BLE001 - cache must never break a request
            logger.warning("redis GET failed for %s; fetching live", key)
            return await factory()

        if cached is not None:
            try:
                self.hits += 1
                logger.info("cache HIT %s", key)
                return json.loads(cached)
            except json.JSONDecodeError:
                logger.warning("corrupt cache entry for %s; refetching", key)

        self.misses += 1
        logger.info("cache MISS %s", key)
        value = await factory()
        try:
            await self.redis.set(key, json.dumps(value, default=str), ex=ttl_seconds)
        except Exception:  # noqa: BLE001
            logger.warning("redis SET failed for %s; serving uncached value", key)
        return value
