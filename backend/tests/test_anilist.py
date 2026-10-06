import respx
from httpx import Response

from app.services.anilist import AniListClient

SEARCH = {
    "data": {
        "Page": {
            "media": [
                {
                    "id": 1535,
                    "idMal": 30,
                    "title": {"romaji": "Death Note", "english": "Death Note"},
                    "coverImage": {"large": "https://example.com/large.jpg"},
                    "startDate": {"year": 2006},
                    "genres": [{"id": 1, "name": "Mystery"}],
                    "description": "A brilliant student",
                    "episodes": 37,
                }
            ]
        }
    }
}
DETAIL = {
    "data": {
        "Media": {
            "id": 1535,
            "idMal": 30,
            "title": {"romaji": "Death Note", "english": "Death Note", "native": "デスノート"},
            "coverImage": {"large": "https://example.com/large.jpg"},
            "bannerImage": "https://example.com/banner.jpg",
            "startDate": {"year": 2006, "month": 4, "day": 1},
            "endDate": {"year": 2007, "month": 10, "day": 12},
            "genres": [{"id": 1, "name": "Mystery"}],
            "description": "A brilliant student who...",
            "episodes": 37,
            "duration": 1440,
            "season": 1,
            "studios": {"isMain": True, "nodes": [{"name": "Madhouse"}]},
        }
    }
}


@respx.mock
async def test_search(cache):
    route = respx.post("https://graphql.anilist.co").mock(return_value=Response(200, json=SEARCH))
    client = AniListClient(cache=cache)
    items = await client.search("death note")

    assert route.called
    assert len(items) == 1
    item = items[0]
    assert item.source_id == "1535"
    assert item.title == "Death Note"
    assert item.year == 2006
    assert item.poster_url == "https://example.com/large.jpg"
    assert item.overview == "A brilliant student"
    assert item.source.value == "anilist"


@respx.mock
async def test_detail(cache):
    respx.post("https://graphql.anilist.co").mock(return_value=Response(200, json=DETAIL))
    client = AniListClient(cache=cache)
    detail = await client.detail("1535")

    assert detail.title == "Death Note"
    assert detail.synopsis == "A brilliant student who..."
    assert detail.release_date.year == 2006
    assert detail.genres == ["Mystery"]
    assert detail.poster_url == "https://example.com/large.jpg"
    assert detail.backdrop_url == "https://example.com/banner.jpg"
    assert detail.runtime_minutes == 1440
    assert detail.episode_count == 37
    # AniList's `season` is a release-season enum (WINTER/SPRING...), not a
    # season count — intentionally not mapped to season_count.
    assert detail.season_count is None
    assert detail.external_ids == {"anilist": "1535", "mal": "30"}
