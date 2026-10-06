import respx
from httpx import Response

from app.services.rawg import RAWGClient

SEARCH = {
    "results": [
        {"id": 30, "name": "Elden Ring", "released": "2022-02-25", "background_image": "/img.jpg"}
    ]
}
DETAIL = {
    "id": 30,
    "name": "Elden Ring",
    "description_raw": "An epic fantasy.",
    "released": "2022-02-25",
    "background_image": "/img.jpg",
    "genres": [{"id": 10, "name": "Action"}, {"id": 5, "name": "RPG"}],
    "playtime": 120,
}


@respx.mock
async def test_search(cache):
    route = respx.get("https://api.rawg.io/api/games").mock(return_value=Response(200, json=SEARCH))
    client = RAWGClient(api_key="test", cache=cache)
    items = await client.search("elden ring")

    assert route.called
    assert len(items) == 1
    item = items[0]
    assert item.source_id == "30"
    assert item.title == "Elden Ring"
    assert item.year == 2022
    assert item.poster_url == "https://api.rawg.io/media/img.jpg"
    assert item.media_type.value == "game"


@respx.mock
async def test_detail(cache):
    respx.get("https://api.rawg.io/api/games/30").mock(return_value=Response(200, json=DETAIL))
    client = RAWGClient(api_key="test", cache=cache)
    detail = await client.detail("30")

    assert detail.title == "Elden Ring"
    assert detail.synopsis == "An epic fantasy."
    assert detail.release_date.year == 2022
    assert detail.genres == ["Action", "RPG"]
    assert detail.runtime_minutes == 120
    assert detail.external_ids == {"rawg": "30"}


@respx.mock
async def test_request_counter_increments(cache):
    respx.get("https://api.rawg.io/api/games").mock(return_value=Response(200, json=SEARCH))
    respx.get("https://api.rawg.io/api/games/1").mock(return_value=Response(200, json=DETAIL))
    RAWGClient.total_requests = 0
    client = RAWGClient(api_key="test", cache=cache)
    assert RAWGClient.total_requests == 0
    await client.search("a")
    assert RAWGClient.total_requests == 1
    await client.detail("1")
    assert RAWGClient.total_requests == 2
