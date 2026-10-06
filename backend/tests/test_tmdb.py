import respx
from httpx import Response

from app.models.enums import MediaType
from app.services.tmdb import TMDBClient

MOVIE_SEARCH = {
    "results": [
        {
            "id": 27205,
            "title": "Inception",
            "overview": "A thief...",
            "release_date": "2010-07-16",
            "poster_path": "/poster.jpg",
        }
    ]
}
TV_SEARCH = {
    "results": [
        {
            "id": 1399,
            "name": "Game of Thrones",
            "first_air_date": "2011-04-17",
            "poster_path": None,
        }
    ]
}
MOVIE_DETAIL = {
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
            },
            "US": {"buy": [{"provider_name": "Amazon Video"}]},
        }
    },
}
TV_DETAIL = {
    "id": 1399,
    "name": "Game of Thrones",
    "original_name": "Game of Thrones",
    "overview": "Nine noble families.",
    "first_air_date": "2011-04-17",
    "genres": [{"name": "Drama"}],
    "episode_run_time": [57],
    "number_of_episodes": 73,
    "number_of_seasons": 8,
    "credits": {"cast": []},
    "watch/providers": {"results": {}},
}


@respx.mock
async def test_search_movie(cache):
    route = respx.get("https://api.themoviedb.org/3/search/movie").mock(
        return_value=Response(200, json=MOVIE_SEARCH)
    )
    client = TMDBClient(api_key="test-key", cache=cache)
    items = await client.search(MediaType.MOVIE, "Inception")

    assert route.called
    assert len(items) == 1
    item = items[0]
    assert item.source_id == "27205"
    assert item.title == "Inception"
    assert item.year == 2010
    assert item.poster_url == "https://image.tmdb.org/t/p/w500/poster.jpg"
    assert item.source.value == "tmdb"


@respx.mock
async def test_search_tv_uses_name_field(cache):
    respx.get("https://api.themoviedb.org/3/search/tv").mock(
        return_value=Response(200, json=TV_SEARCH)
    )
    client = TMDBClient(api_key="test-key", cache=cache)
    items = await client.search(MediaType.TV, "Game of Thrones")
    assert items[0].title == "Game of Thrones"
    assert items[0].year == 2011
    assert items[0].poster_url is None


@respx.mock
async def test_detail_movie_with_providers_and_cast(cache):
    respx.get("https://api.themoviedb.org/3/movie/27205").mock(
        return_value=Response(200, json=MOVIE_DETAIL)
    )
    client = TMDBClient(api_key="test-key", cache=cache)
    detail = await client.detail(MediaType.MOVIE, "27205")

    assert detail.title == "Inception"
    assert detail.release_date is not None and detail.release_date.year == 2010
    assert detail.genres == ["Action"]
    assert detail.runtime_minutes == 148
    assert detail.cast[0].name == "Leonardo DiCaprio"
    providers = {(p.country, p.provider_name, p.offer_type.value) for p in detail.providers}
    assert ("IN", "Netflix", "stream") in providers
    assert ("IN", "Apple TV", "rent") in providers
    assert ("US", "Amazon Video", "buy") in providers
    assert detail.external_ids == {"tmdb": "27205"}


@respx.mock
async def test_detail_tv_uses_tv_fields(cache):
    respx.get("https://api.themoviedb.org/3/tv/1399").mock(
        return_value=Response(200, json=TV_DETAIL)
    )
    client = TMDBClient(api_key="test-key", cache=cache)
    detail = await client.detail(MediaType.TV, "1399")
    assert detail.season_count == 8
    assert detail.episode_count == 73
    assert detail.runtime_minutes == 57


@respx.mock
async def test_season_maps_episode_description_and_thumbnail(cache):
    respx.get("https://api.themoviedb.org/3/tv/1399/season/1").mock(
        return_value=Response(
            200,
            json={
                "episodes": [
                    {
                        "id": 101,
                        "episode_number": 1,
                        "name": "Winter Is Coming",
                        "air_date": "2011-04-17",
                        "overview": "A noble family receives an ominous warning.",
                        "still_path": "/winter.jpg",
                    }
                ]
            },
        )
    )
    client = TMDBClient(api_key="test-key", cache=cache)
    episodes = await client.season("1399", 1)
    assert episodes == [
        {
            "number": 1,
            "name": "Winter Is Coming",
            "air_date": "2011-04-17",
            "description": "A noble family receives an ominous warning.",
            "thumbnail_url": "https://image.tmdb.org/t/p/w500/winter.jpg",
        }
    ]


@respx.mock
async def test_detail_cached_second_call_skips_http(cache):
    route = respx.get("https://api.themoviedb.org/3/movie/27205").mock(
        return_value=Response(200, json=MOVIE_DETAIL)
    )
    client = TMDBClient(api_key="test-key", cache=cache)
    await client.detail(MediaType.MOVIE, "27205")
    await client.detail(MediaType.MOVIE, "27205")
    assert route.call_count == 1
    assert cache.hits == 1


async def test_search_ignores_game_media_type(cache):
    client = TMDBClient(api_key="test-key", cache=cache)
    assert await client.search(MediaType.GAME, "elden") == []


async def test_detail_rejects_game_media_type(cache):
    import pytest

    client = TMDBClient(api_key="test-key", cache=cache)
    with pytest.raises(ValueError):
        await client.detail(MediaType.GAME, "1")
