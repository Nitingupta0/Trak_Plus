"""India watch-provider filtering (todos.md Phase 2): /titles/{...} returns only
the requested country's providers, split by stream/rent/buy."""

import respx
from httpx import Response

from app.services import registry
from app.services.tmdb import TMDBClient

MOVIE_DETAIL = {
    "id": 27205,
    "title": "Inception",
    "overview": "A thief who steals secrets.",
    "release_date": "2010-07-16",
    "genres": [{"name": "Action"}],
    "runtime": 148,
    "credits": {"cast": []},
    "watch/providers": {
        "results": {
            "IN": {
                "flatrate": [{"provider_name": "Netflix"}],
                "rent": [{"provider_name": "Apple TV"}],
                "buy": [{"provider_name": "Apple TV"}],
            },
            "US": {"flatrate": [{"provider_name": "HBO Max"}]},
            "GB": {"rent": [{"provider_name": "Sky Store"}]},
        }
    },
}


@respx.mock
async def test_india_filtering_default(api_client, cache, monkeypatch):
    monkeypatch.setattr(registry, "get_tmdb", lambda: TMDBClient("test-key", cache))
    respx.get("https://api.themoviedb.org/3/movie/27205").mock(
        return_value=Response(200, json=MOVIE_DETAIL)
    )

    resp = await api_client.get("/titles/tmdb/27205", params={"media_type": "movie"})
    assert resp.status_code == 200
    providers = resp.json()["providers"]
    countries = {p["country"] for p in providers}
    assert countries == {"IN"}  # default country=IN filters out US/GB
    by_type = {p["offer_type"]: p["provider_name"] for p in providers}
    assert by_type == {"stream": "Netflix", "rent": "Apple TV", "buy": "Apple TV"}


@respx.mock
async def test_country_query_param(api_client, cache, monkeypatch):
    monkeypatch.setattr(registry, "get_tmdb", lambda: TMDBClient("test-key", cache))
    respx.get("https://api.themoviedb.org/3/movie/27205").mock(
        return_value=Response(200, json=MOVIE_DETAIL)
    )

    resp = await api_client.get(
        "/titles/tmdb/27205", params={"media_type": "movie", "country": "US"}
    )
    providers = resp.json()["providers"]
    assert {p["country"] for p in providers} == {"US"}
    assert providers[0]["provider_name"] == "HBO Max"
