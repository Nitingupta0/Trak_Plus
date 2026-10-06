"""Per-IP fixed-window rate limiting for auth endpoints (design.md §5b).

Counts attempts per client IP in Redis; when the limit is exceeded the
endpoint returns 429 with a Retry-After header. Redis outages fail open —
an unavailable limiter must never block legitimate logins (same philosophy
as CacheLayer: Redis may degrade, the request path may not).
"""

import logging
import time
from collections.abc import Callable
from typing import Any

import redis.asyncio as redis
from fastapi import Depends, HTTPException, Request, status

from app.core.config import get_settings
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

_limiter: "RateLimiter | None" = None


class RateLimiter:
    """Fixed-window INCR/EXPIRE counter keyed by (scope, client IP)."""

    def __init__(
        self,
        redis_client: redis.Redis,
        *,
        limit_per_minute: int,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self.redis = redis_client
        self.limit = limit_per_minute
        self.clock = clock

    async def check(self, scope: str, ip: str) -> tuple[bool, int]:
        """Register one attempt; return (allowed, retry_after_seconds)."""
        if self.limit <= 0:  # disabled via AUTH_RATE_LIMIT_PER_MINUTE=0
            return True, 0
        now = int(self.clock())
        bucket = now // 60
        key = f"ratelimit:{scope}:{ip}:{bucket}"
        try:
            pipe = self.redis.pipeline()
            pipe.incr(key)
            pipe.expire(key, 60)
            count, _ = await pipe.execute()
        except Exception:  # noqa: BLE001 - limiter must never break a request
            logger.warning("rate limiter redis unavailable; failing open")
            return True, 0
        if int(count) > self.limit:
            return False, 60 - (now % 60)
        return True, 0


def client_ip(request: Request) -> str:
    """Best-effort client IP.

    Behind Caddy (Lightsail) the backend only ever sees proxy traffic, and
    Caddy appends the real client address to X-Forwarded-For — so the last
    entry is the trustworthy one. Direct access (local dev) has no XFF and
    falls back to the socket peer.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


def get_limiter() -> RateLimiter:
    """Singleton limiter shared across requests (tests override this dependency)."""
    global _limiter
    if _limiter is None:
        settings = get_settings()
        _limiter = RateLimiter(get_redis(), limit_per_minute=settings.auth_rate_limit_per_minute)
    return _limiter


async def enforce(request: Request, limiter: RateLimiter, scope: str) -> None:
    """Raise 429 when the caller exceeds the scoped limit."""
    settings = get_settings()
    allowed, retry_after = await limiter.check(scope, client_ip(request))
    if not allowed:
        logger.warning(
            "rate limit hit: scope=%s ip=%s limit=%d/min",
            scope,
            client_ip(request),
            settings.auth_rate_limit_per_minute,
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="too many attempts, try again shortly",
            headers={"Retry-After": str(max(retry_after, 1))},
        )


def make_scope_dependency(scope: str) -> Callable[..., Any]:
    """FastAPI dependency factory enforcing a per-endpoint limit."""

    async def dependency(request: Request, limiter: RateLimiter = Depends(get_limiter)) -> None:
        await enforce(request, limiter, scope)

    return dependency
