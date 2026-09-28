import respx
from httpx import Response

from app.services.jikan import JikanClient

SEARCH = {
    "data": [
        {
            "mal_id": 1535,
            "title": "Death Note",
            "title_english": "Death Note",
            "year": 2006,
            "synopsis": "A brilliant student",
            "images": {"jpg": {"large_image_url": "https://example.com/large.jpg"}},
            "episodes": 37,
        }
    ]
}
DETAIL_FULL = {
    "data": {
        "mal_id": 1535,
        "title": "Death Note",
        "title_japanese": "デスノート",
        "synopsis": "A brilliant student who...",
        "aired": {"from": "2006-10-04T00:00:00+00:00"},
        "genres": [{"id": 1, "name": "Mystery"}],
        "images": {"jpg": {"large_image_url": "https://example.com/large.jpg"}},
        "trailer": {"images": {"maximum_image_url": "https://example.com/max.jpg"}},
        "duration": "24 min per ep",
        "episodes": 37,
        "studios": [{"name": "Madhouse"}],
    }
}


@respx.mock
async def test_search(cache):
    route = respx.get("https://api.jikan.moe/v4/anime").mock(
        return_value=Response(200, json=SEARCH)
    )
    client = JikanClient(cache=cache)
    items = await client.search("death note")

    assert route.called
    assert len(items) == 1
    item = items[0]
    assert item.source_id == "1535"
    assert item.title == "Death Note"
    assert item.year == 2006
    assert item.poster_url == "https://example.com/large.jpg"
    assert item.source.value == "jikan"


@respx.mock
async def test_detail(cache):
    respx.get("https://api.jikan.moe/v4/anime/1535/full").mock(
        return_value=Response(200, json=DETAIL_FULL)
    )
    client = JikanClient(cache=cache)
    detail = await client.detail("1535")

    assert detail.title == "Death Note"
    assert detail.synopsis == "A brilliant student who..."
    assert detail.release_date.year == 2006
    assert detail.genres == ["Mystery"]
    assert detail.poster_url == "https://example.com/large.jpg"
    assert detail.backdrop_url == "https://example.com/max.jpg"
    assert detail.runtime_minutes == 24
    assert detail.episode_count == 37
    assert detail.external_ids == {"mal": "1535"}


@respx.mock
async def test_search_rate_limit_then_success(cache):
    """429 → backoff → success on second try."""
    route = respx.get("https://api.jikan.moe/v4/anime").mock(
        side_effect=[
            Response(429),
            Response(200, json=SEARCH),
        ]
    )
    client = JikanClient(cache=cache)
    items = await client.search("death note")

    # Should have called twice; first 429, second success
    assert route.call_count == 2
    assert len(items) == 1
    assert items[0].source_id == "1535"
