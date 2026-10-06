import respx
from httpx import ASGITransport, AsyncClient, Response

from app.main import app
from app.services import registry
from app.services.anilist import AniListClient
from app.services.tmdb import TMDBClient

TMDB_SEARCH = {
    "results": [
        {
            "id": 1,
            "title": "Foo",
            "overview": "o",
            "release_date": "2000-01-01",
            "poster_path": None,
        }
    ]
}
RAWG_SEARCH = {
    "results": [{"id": 2, "name": "Bar", "released": "2001-01-01", "background_image": None}]
}
ANILIST_SEARCH = {
    "data": {
        "Page": {
            "media": [
                {
                    "id": 3,
                    "title": {"romaji": "Baz"},
                    "coverImage": {"large": None},
                    "startDate": {"year": 2002},
                    "genres": [],
                    "description": None,
                }
            ]
        }
    }
}


async def _call(params: dict) -> dict:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/search", params=params)
    assert resp.status_code == 200
    return resp.json()


@respx.mock
async def test_search_fanout_skips_disabled_sources(cache, monkeypatch):
    """type=all hits enabled sources; key-gated disabled source is skipped."""
    monkeypatch.setattr(registry, "get_tmdb", lambda: TMDBClient("test-key", cache))
    monkeypatch.setattr(registry, "get_rawg", lambda: None)
    monkeypatch.setattr(registry, "get_anilist", lambda: AniListClient(cache))

    respx.get("https://api.themoviedb.org/3/search/movie").mock(
        return_value=Response(200, json=TMDB_SEARCH)
    )
    respx.post("https://graphql.anilist.co").mock(return_value=Response(200, json=ANILIST_SEARCH))

    data = await _call({"q": "test", "type": "all"})
    assert data["query"] == "test"
    assert data["count"] == 2
    sources = {(r["source"], r["source_id"]) for r in data["results"]}
    assert sources == {("tmdb", "1"), ("anilist", "3")}


@respx.mock
async def test_search_error_resilience(cache, monkeypatch):
    """One source failing (500) must not break the merged response."""
    monkeypatch.setattr(registry, "get_tmdb", lambda: TMDBClient("test-key", cache))
    monkeypatch.setattr(registry, "get_anilist", lambda: AniListClient(cache))
    monkeypatch.setattr(registry, "get_rawg", lambda: None)

    respx.get("https://api.themoviedb.org/3/search/movie").mock(return_value=Response(500))
    respx.post("https://graphql.anilist.co").mock(return_value=Response(200, json=ANILIST_SEARCH))

    data = await _call({"q": "test", "type": "all"})
    assert data["count"] == 1
    assert data["results"][0]["source"] == "anilist"


@respx.mock
async def test_search_type_filtering(cache, monkeypatch):
    """type=movie queries only the movie source."""
    tmdb_route = respx.get("https://api.themoviedb.org/3/search/movie").mock(
        return_value=Response(200, json=TMDB_SEARCH)
    )
    anilist_route = respx.post("https://graphql.anilist.co").mock(
        return_value=Response(200, json=ANILIST_SEARCH)
    )
    monkeypatch.setattr(registry, "get_tmdb", lambda: TMDBClient("test-key", cache))
    monkeypatch.setattr(registry, "get_rawg", lambda: None)
    monkeypatch.setattr(registry, "get_anilist", lambda: AniListClient(cache))

    data = await _call({"q": "x", "type": "movie"})

    assert data["count"] == 1
    assert data["results"][0]["source"] == "tmdb"
    assert tmdb_route.called
    assert not anilist_route.called


async def test_search_requires_query():
    from httpx import ASGITransport, AsyncClient

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/search")
    assert resp.status_code == 422
