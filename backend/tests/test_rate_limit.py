"""Tests for per-IP auth rate limiting (design.md §5b hardening)."""

import pytest

from app.core.rate_limit import RateLimiter, client_ip, get_limiter
from app.main import app


class FixedClock:
    def __init__(self) -> None:
        self.t = 1_000_000.0

    def __call__(self) -> float:
        return self.t


@pytest.fixture
def clock() -> FixedClock:
    return FixedClock()


@pytest.fixture
def limiter(fake_redis, clock) -> RateLimiter:
    return RateLimiter(fake_redis, limit_per_minute=3, clock=clock)


async def test_allows_up_to_limit_then_blocks(limiter) -> None:
    for _ in range(3):
        allowed, _ = await limiter.check("auth:login", "1.2.3.4")
        assert allowed
    allowed, retry_after = await limiter.check("auth:login", "1.2.3.4")
    assert not allowed
    assert 0 < retry_after <= 60


async def test_scopes_and_ips_count_independently(limiter) -> None:
    for _ in range(3):
        await limiter.check("auth:login", "1.2.3.4")
    # Different scope: separate bucket.
    allowed, _ = await limiter.check("auth:register", "1.2.3.4")
    assert allowed
    # Different IP: separate bucket.
    allowed, _ = await limiter.check("auth:login", "5.6.7.8")
    assert allowed


async def test_window_rolls_over(limiter, clock) -> None:
    for _ in range(3):
        await limiter.check("auth:login", "1.2.3.4")
    clock.t += 61  # next fixed window
    allowed, _ = await limiter.check("auth:login", "1.2.3.4")
    assert allowed


async def test_redis_outage_fails_open(clock) -> None:
    class BrokenRedis:
        def pipeline(self):  # noqa: ANN202
            raise ConnectionError("redis down")

    limiter = RateLimiter(BrokenRedis(), limit_per_minute=1, clock=clock)
    allowed, retry_after = await limiter.check("auth:login", "1.2.3.4")
    assert allowed
    assert retry_after == 0


async def test_zero_limit_disables(limiter, fake_redis) -> None:
    disabled = RateLimiter(fake_redis, limit_per_minute=0, clock=FixedClock())
    for _ in range(50):
        allowed, _ = await disabled.check("auth:login", "1.2.3.4")
        assert allowed


async def test_client_ip_prefers_last_xff_hop() -> None:
    class FakeRequest:
        headers = {"x-forwarded-for": "203.0.113.9, 10.0.0.2"}
        client = None

    assert client_ip(FakeRequest()) == "10.0.0.2"  # type: ignore[arg-type]


async def test_client_ip_falls_back_to_socket() -> None:
    class FakeRequest:
        headers = {}
        client = None

    assert client_ip(FakeRequest()) == "unknown"  # type: ignore[arg-type]


async def test_endpoint_returns_429_with_retry_after(api_client, fake_redis) -> None:
    """Full-stack: 11th login attempt from one IP in a window gets 429."""
    from app.core.rate_limit import RateLimiter as RL

    app.dependency_overrides[get_limiter] = lambda: RL(fake_redis, limit_per_minute=10)
    try:
        for i in range(10):
            resp = await api_client.post(
                "/auth/login",
                data={"username": f"u{i}@test.dev", "password": "wrong"},
            )
            assert resp.status_code == 401
        resp = await api_client.post(
            "/auth/login", data={"username": "u@test.dev", "password": "wrong"}
        )
        assert resp.status_code == 429
        assert "retry-after" in {k.lower() for k in resp.headers}
    finally:
        app.dependency_overrides[get_limiter] = lambda: RL(fake_redis, limit_per_minute=0)


async def test_register_isolated_from_login_limit(api_client, fake_redis) -> None:
    """Register hammering must not lock out login from the same IP."""
    from app.core.rate_limit import RateLimiter as RL

    app.dependency_overrides[get_limiter] = lambda: RL(fake_redis, limit_per_minute=2)
    try:
        for i in range(2):
            resp = await api_client.post(
                "/auth/register",
                json={"email": f"x{i}@test.dev", "password": "supersecret123"},
            )
            assert resp.status_code == 201
        assert (
            await api_client.post(
                "/auth/register", json={"email": "x3@test.dev", "password": "supersecret123"}
            )
        ).status_code == 429
        # login scope untouched
        resp = await api_client.post(
            "/auth/login", data={"username": "x0@test.dev", "password": "supersecret123"}
        )
        assert resp.status_code == 200
    finally:
        app.dependency_overrides[get_limiter] = lambda: RL(fake_redis, limit_per_minute=0)
