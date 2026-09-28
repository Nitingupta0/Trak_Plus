import respx
from httpx import Response
from sqlalchemy import select

from app.models import Title
from app.services import registry
from app.services.tmdb import TMDBClient

TMDB_DETAIL = {
    "id": 27205,
    "title": "Inception",
    "original_title": "Inception",
    "overview": "A thief who steals secrets.",
    "release_date": "2010-07-16",
    "genres": [{"id": 28, "name": "Action"}],
    "poster_path": "/poster.jpg",
    "backdrop_path": "/backdrop.jpg",
    "runtime": 148,
    "credits": {
        "cast": [{"name": "Leonardo DiCaprio", "character": "Cobb", "profile_path": "/leo.jpg"}]
    },
    "watch/providers": {
        "results": {
            "IN": {
                "flatrate": [{"provider_name": "Netflix"}],
                "rent": [{"provider_name": "Apple TV"}],
            }
        }
    },
}


def _enable_tmdb(cache, monkeypatch) -> None:
    monkeypatch.setattr(registry, "get_tmdb", lambda: TMDBClient("test-key", cache))


@respx.mock
async def test_titles_endpoint_upserts(db_session, api_client, cache, monkeypatch):
    """GET /titles/tmdb/27205?media_type=movie → 200 + Title row persisted."""
    _enable_tmdb(cache, monkeypatch)
    respx.get("https://api.themoviedb.org/3/movie/27205").mock(
        return_value=Response(200, json=TMDB_DETAIL)
    )

    resp = await api_client.get("/titles/tmdb/27205", params={"media_type": "movie"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["source"] == "tmdb"
    assert data["source_id"] == "27205"
    assert data["media_type"] == "movie"
    assert data["title"] == "Inception"
    assert data["synopsis"] == "A thief who steals secrets."
    assert data["release_date"] == "2010-07-16"
    assert data["genres"] == ["Action"]
    assert data["runtime_minutes"] == 148
    assert data["poster_url"] == "https://image.tmdb.org/t/p/w500/poster.jpg"
    assert data["backdrop_url"] == "https://image.tmdb.org/t/p/w500/backdrop.jpg"
    assert data["cast"][0]["name"] == "Leonardo DiCaprio"
    assert any(
        p["country"] == "IN" and p["provider_name"] == "Netflix" and p["offer_type"] == "stream"
        for p in data["providers"]
    )

    row = (await db_session.execute(select(Title).where(Title.tmdb_id == "27205"))).scalar_one()
    assert row.media_type.value == "movie"
    assert row.title == "Inception"
    assert row.synopsis == "A thief who steals secrets."
    assert row.raw_metadata["synopsis"] == "A thief who steals secrets."
    assert row.raw_metadata["source_id"] == "27205"


@respx.mock
async def test_titles_upsert_updates_existing_row(db_session, api_client, cache, monkeypatch):
    """Second call with changed data updates the same row (no duplicate)."""
    _enable_tmdb(cache, monkeypatch)
    route = respx.get("https://api.themoviedb.org/3/movie/27205").mock(
        return_value=Response(200, json=TMDB_DETAIL)
    )
    await api_client.get("/titles/tmdb/27205", params={"media_type": "movie"})

    changed = dict(TMDB_DETAIL)
    changed["title"] = "Inception (Updated)"
    route.mock(return_value=Response(200, json=changed))
    # Detail responses are cached for 24h — bust the cache to exercise the update path.
    await cache.redis.delete("trakplus:tmdb:detail:movie:27205")
    await api_client.get("/titles/tmdb/27205", params={"media_type": "movie"})

    rows = (await db_session.execute(select(Title).where(Title.tmdb_id == "27205"))).scalars().all()
    assert len(rows) == 1
    assert rows[0].title == "Inception (Updated)"


async def test_titles_missing_media_type_errors(api_client):
    resp = await api_client.get("/titles/tmdb/27205")
    assert resp.status_code == 400
    assert "tmdb requires" in resp.json()["detail"]


async def test_titles_bad_source_returns_422(api_client):
    resp = await api_client.get("/titles/invalid/123")
    assert resp.status_code == 422


async def test_titles_source_disabled_returns_503(api_client, monkeypatch):
    monkeypatch.setattr(registry, "get_tmdb", lambda: None)
    resp = await api_client.get("/titles/tmdb/123", params={"media_type": "movie"})
    assert resp.status_code == 503
    assert "disabled" in resp.json()["detail"]


@respx.mock
async def test_titles_upstream_error_returns_502(api_client, cache, monkeypatch):
    _enable_tmdb(cache, monkeypatch)
    respx.get("https://api.themoviedb.org/3/movie/27205").mock(return_value=Response(500))
    resp = await api_client.get("/titles/tmdb/27205", params={"media_type": "movie"})
    assert resp.status_code == 502
    assert "upstream" in resp.json()["detail"].lower()
