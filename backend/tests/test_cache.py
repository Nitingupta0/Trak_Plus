import pytest

from app.services.cache import CacheLayer


async def test_get_or_set_miss_then_hit(cache: CacheLayer):
    calls = []

    async def factory():
        calls.append(1)
        return {"value": 42}

    first = await cache.get_or_set_json("k", 60, factory)
    second = await cache.get_or_set_json("k", 60, factory)

    assert first == {"value": 42}
    assert second == {"value": 42}
    assert len(calls) == 1
    assert cache.misses == 1
    assert cache.hits == 1


async def test_distinct_keys_both_fetch(cache: CacheLayer):
    async def factory():
        return "x"

    await cache.get_or_set_json("a", 60, factory)
    await cache.get_or_set_json("b", 60, factory)
    assert cache.misses == 2
    assert cache.hits == 0


async def test_redis_outage_degrades_to_fetch(fake_redis):
    await fake_redis.aclose()  # simulate dead redis
    cache = CacheLayer(fake_redis)
    calls = []

    async def factory():
        calls.append(1)
        return {"ok": True}

    value = await cache.get_or_set_json("k", 60, factory)
    assert value == {"ok": True}
    assert len(calls) == 1


async def test_bad_json_in_cache_treated_as_miss(fake_redis):
    await fake_redis.set("broken", "not-json{")
    cache = CacheLayer(fake_redis)
    calls = []

    async def factory():
        calls.append(1)
        return {"fresh": True}

    value = await cache.get_or_set_json("broken", 60, factory)
    assert value == {"fresh": True}
    assert len(calls) == 1


@pytest.mark.parametrize("ttl", [1, 3600])
async def test_ttl_values_accepted(cache: CacheLayer, ttl: int):
    async def factory():
        return {"ttl": ttl}

    assert (await cache.get_or_set_json(f"k{ttl}", ttl, factory)) == {"ttl": ttl}
