import respx
from httpx import Response

from app.services.mangadex import MangaDexClient

SEARCH = {
    "data": [
        {
            "id": "a1c7d8e9-0123-4567-89ab-cdef01234567",
            "type": "manga",
            "attributes": {
                "title": {"en": "One Piece"},
                "description": {"en": "Epic pirate adventure."},
                "year": 1997,
                "tags": [],
            },
            "relationships": [
                {"id": "cover1", "type": "cover_art", "attributes": {"fileName": "cover.jpg"}}
            ],
        }
    ]
}
DETAIL = {
    "data": {
        "attributes": {
            "title": {"en": "One Piece"},
            "altTitles": {"en": ["One Piece"]},
            "description": {"en": "Epic pirate adventure."},
            "year": 1997,
            "tags": [
                {"id": "1", "type": "tag", "attributes": {"name": {"en": "Adventure"}}},
                {"id": "2", "type": "tag", "attributes": {"name": {"en": "Shounen"}}},
            ],
        },
        "relationships": [
            {"id": "cover1", "type": "cover_art", "attributes": {"fileName": "cover.jpg"}}
        ],
    }
}
CHAPTERS = {
    "total": 2,
    "data": [
        {
            "id": "ch1",
            "type": "chapter",
            "attributes": {
                "chapter": "1",
                "title": "Romance Dawn",
                "publishAt": "2018-01-01T00:00:00+00:00",
            },
        },
        {
            "id": "ch2",
            "type": "chapter",
            "attributes": {
                "chapter": "2",
                "title": None,
                "publishAt": "2018-01-08T00:00:00+00:00",
            },
        },
    ],
}


@respx.mock
async def test_search(cache):
    route = respx.get("https://api.mangadex.org/manga").mock(
        return_value=Response(200, json=SEARCH)
    )
    client = MangaDexClient(cache=cache)
    items = await client.search("one piece")

    assert route.called
    assert len(items) == 1
    item = items[0]
    assert item.source_id == "a1c7d8e9-0123-4567-89ab-cdef01234567"
    assert item.title == "One Piece"
    assert item.year == 1997
    assert (
        item.poster_url
        == "https://uploads.mangadex.org/covers/a1c7d8e9-0123-4567-89ab-cdef01234567/cover.jpg"
    )
    assert item.overview == "Epic pirate adventure."


@respx.mock
async def test_detail(cache):
    respx.get("https://api.mangadex.org/manga/a1c7d8e9-0123-4567-89ab-cdef01234567").mock(
        return_value=Response(200, json=DETAIL)
    )
    client = MangaDexClient(cache=cache)
    detail = await client.detail("a1c7d8e9-0123-4567-89ab-cdef01234567")

    assert detail.title == "One Piece"
    assert detail.synopsis == "Epic pirate adventure."
    assert detail.release_date.year == 1997
    assert detail.genres == ["Adventure", "Shounen"]
    assert (
        detail.poster_url
        == "https://uploads.mangadex.org/covers/a1c7d8e9-0123-4567-89ab-cdef01234567/cover.jpg"
    )


@respx.mock
async def test_chapters(cache):
    respx.get("https://api.mangadex.org/manga/a1c7d8e9-0123-4567-89ab-cdef01234567/feed").mock(
        return_value=Response(200, json=CHAPTERS)
    )
    client = MangaDexClient(cache=cache)
    chapters = await client.chapters("a1c7d8e9-0123-4567-89ab-cdef01234567")

    assert chapters.total == 2
    assert len(chapters.chapters) == 2
    assert chapters.chapters[0].number == 1.0
    assert chapters.chapters[0].title == "Romance Dawn"
    assert chapters.chapters[1].number == 2.0
    assert chapters.chapters[1].title is None
