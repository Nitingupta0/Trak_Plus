import redis.asyncio as redis

from app.core.config import get_settings


def get_redis() -> redis.Redis:
    """Create a Redis client from settings. Cached responses (Phase 1) share one pool."""
    settings = get_settings()
    return redis.from_url(
        settings.redis_url,
        decode_responses=True,
        socket_connect_timeout=2,
        socket_timeout=2,
    )
