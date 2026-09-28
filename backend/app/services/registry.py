"""Client singletons + lifecycle. Key-gated sources (TMDB, RAWG) are disabled
(None) until keys are configured — /search simply skips them."""

import logging
from functools import lru_cache

from app.core.config import get_settings
from app.core.redis import get_redis
from app.services.anilist import AniListClient
from app.services.cache import CacheLayer
from app.services.jikan import JikanClient
from app.services.mangadex import MangaDexClient
from app.services.rawg import RAWGClient
from app.services.tmdb import TMDBClient

logger = logging.getLogger(__name__)

_instances: list = []


def _track(client):
    _instances.append(client)
    return client


@lru_cache
def cache_layer() -> CacheLayer:
    return CacheLayer(get_redis())


@lru_cache
def get_tmdb() -> TMDBClient | None:
    api_key = get_settings().tmdb_api_key
    if not api_key:
        logger.warning("TMDB_API_KEY not set — TMDB source disabled")
        return None
    return _track(TMDBClient(api_key, cache_layer()))


@lru_cache
def get_rawg() -> RAWGClient | None:
    api_key = get_settings().rawg_api_key
    if not api_key:
        logger.warning("RAWG_API_KEY not set — RAWG source disabled")
        return None
    return _track(RAWGClient(api_key, cache_layer()))


@lru_cache
def get_anilist() -> AniListClient:
    return _track(AniListClient(cache_layer()))


@lru_cache
def get_jikan() -> JikanClient:
    return _track(JikanClient(cache_layer()))


@lru_cache
def get_mangadex() -> MangaDexClient:
    return _track(MangaDexClient(cache_layer()))


async def aclose_all() -> None:
    for client in _instances:
        try:
            await client.aclose()
        except Exception:  # noqa: BLE001 - shutdown must not raise
            logger.warning("failed closing client %r", client)
    _instances.clear()
    get_tmdb.cache_clear()
    get_rawg.cache_clear()
    get_anilist.cache_clear()
    get_jikan.cache_clear()
    get_mangadex.cache_clear()
    cache_layer.cache_clear()
