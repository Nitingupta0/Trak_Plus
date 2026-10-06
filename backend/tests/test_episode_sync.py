"""Episode sync (Phase 2 enabler for progress tracking): TMDB per-season fetches,
AniList stub episodes, MangaDex chapters — idempotent re-syncs."""

import respx
from httpx import Response
from sqlalchemy import delete, select

from app.models import Episode, Title
from app.services import registry
from app.services.anilist import AniListClient
from app.services.mangadex import MangaDexClient
from app.services.tmdb import TMDBClient

TV_ID = "1399"
TV_DETAIL = {
    "id": 1399,
    "name": "Game of Thrones",
    "overview": "Nine noble families.",
    "first_air_date": "2011-04-17",
    "genres": [{"name": "Drama"}],
    "episode_run_time": [57],
    "number_of_episodes": 2,
    "number_of_seasons": 1,
    "credits": {"cast": []},
    "watch/providers": {"results": {}},
}
SEASON_1 = {
    "episodes": [
        {
            "episode_number": 1,
            "name": "Winter Is Coming",
            "air_date": "2011-04-17",
            "overview": "A noble family receives an ominous warning.",
            "still_path": "/winter.jpg",
        },
        {"episode_number": 2, "name": "The Kingsroad", "air_date": "2011-04-24"},
    ]
}


def _enable_tmdb(cache, monkeypatch) -> None:
    monkeypatch.setattr(registry, "get_tmdb", lambda: TMDBClient("test-key", cache))


@respx.mock
async def test_episodes_listing_after_sync(db_session, api_client, cache, monkeypatch):
    """GET /titles/{source}/{id}/episodes returns synced rows; 404 when title never cached."""
    _enable_tmdb(cache, monkeypatch)
    respx.get(f"https://api.themoviedb.org/3/tv/{TV_ID}").mock(
        return_value=Response(200, json=TV_DETAIL)
    )
    respx.get(f"https://api.themoviedb.org/3/tv/{TV_ID}/season/1").mock(
        return_value=Response(200, json=SEASON_1)
    )

    # before any sync → 404 (title not cached)
    pre = await api_client.get(f"/titles/tmdb/{TV_ID}/episodes")
    assert pre.status_code == 404

    await api_client.post(f"/titles/tmdb/{TV_ID}/episodes/sync", params={"media_type": "tv"})

    listing = await api_client.get(f"/titles/tmdb/{TV_ID}/episodes")
    assert listing.status_code == 200
    rows = listing.json()
    assert [r["number"] for r in rows] == [1, 2]
    assert rows[0]["name"] == "Winter Is Coming"
    assert rows[0]["season"] == 1
    assert rows[0]["description"] == "A noble family receives an ominous warning."
    assert rows[0]["thumbnail_url"] == "https://image.tmdb.org/t/p/w500/winter.jpg"


@respx.mock
async def test_detail_includes_internal_id(db_session, api_client, cache, monkeypatch):
    _enable_tmdb(cache, monkeypatch)
    respx.get(f"https://api.themoviedb.org/3/tv/{TV_ID}").mock(
        return_value=Response(200, json=TV_DETAIL)
    )
    resp = await api_client.get(f"/titles/tmdb/{TV_ID}", params={"media_type": "tv"})
    assert resp.status_code == 200
    internal_id = resp.json()["id"]
    import uuid as _uuid

    _uuid.UUID(internal_id)  # valid UUID


@respx.mock
async def test_tmdb_tv_sync_creates_episodes(db_session, api_client, cache, monkeypatch):
    _enable_tmdb(cache, monkeypatch)
    respx.get(f"https://api.themoviedb.org/3/tv/{TV_ID}").mock(
        return_value=Response(200, json=TV_DETAIL)
    )
    respx.get(f"https://api.themoviedb.org/3/tv/{TV_ID}/season/1").mock(
        return_value=Response(200, json=SEASON_1)
    )

    resp = await api_client.post(f"/titles/tmdb/{TV_ID}/episodes/sync", params={"media_type": "tv"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["created"] == 2
    assert body["total"] == 2

    # idempotent re-sync
    resp2 = await api_client.post(
        f"/titles/tmdb/{TV_ID}/episodes/sync", params={"media_type": "tv"}
    )
    assert resp2.json() == {"created": 0, "total": 2}


@respx.mock
async def test_existing_tmdb_rows_are_updated_with_episode_metadata(
    db_session, api_client, cache, monkeypatch
):
    _enable_tmdb(cache, monkeypatch)
    initial_season = {"episodes": [{"episode_number": 1, "name": "Old title", "air_date": None}]}
    updated_season = {
        "episodes": [
            {
                "episode_number": 1,
                "name": "New title",
                "air_date": "2011-04-17",
                "overview": "New description",
                "still_path": "/new.jpg",
            }
        ]
    }
    respx.get(f"https://api.themoviedb.org/3/tv/{TV_ID}").mock(
        return_value=Response(200, json={**TV_DETAIL, "number_of_episodes": 1})
    )
    season_route = respx.get(f"https://api.themoviedb.org/3/tv/{TV_ID}/season/1")
    season_route.side_effect = [
        Response(200, json=initial_season),
        Response(200, json=updated_season),
    ]

    first = await api_client.post(
        f"/titles/tmdb/{TV_ID}/episodes/sync", params={"media_type": "tv"}
    )
    assert first.json()["created"] == 1
    await cache.redis.flushall()
    second = await api_client.post(
        f"/titles/tmdb/{TV_ID}/episodes/sync", params={"media_type": "tv"}
    )
    assert second.json() == {"created": 0, "total": 1}

    listing = (await api_client.get(f"/titles/tmdb/{TV_ID}/episodes")).json()
    assert listing[0]["name"] == "New title"
    assert listing[0]["air_date"] == "2011-04-17"
    assert listing[0]["description"] == "New description"
    assert listing[0]["thumbnail_url"] == "https://image.tmdb.org/t/p/w500/new.jpg"


@respx.mock
async def test_anilist_anime_stub_episodes(db_session, api_client, cache, monkeypatch):
    monkeypatch.setattr(registry, "get_anilist", lambda: AniListClient(cache))
    anime_id = "2020"
    title_id = (
        await db_session.execute(select(Title.id).where(Title.anilist_id == anime_id))
    ).scalar_one_or_none()
    if title_id is not None:
        await db_session.execute(delete(Episode).where(Episode.title_id == title_id))
        await db_session.execute(delete(Title).where(Title.id == title_id))
        await db_session.commit()
    media = {
        "id": 2020,
        "idMal": 2020,
        "title": {"romaji": "NARUTO"},
        "coverImage": {"large": None},
        "startDate": {"year": 2002, "month": 10, "day": 3},
        "genres": [],
        "description": None,
        "episodes": 3,
        "duration": 23,
    }
    respx.post("https://graphql.anilist.co").mock(
        return_value=Response(200, json={"data": {"Media": media}})
    )

    resp = await api_client.post(f"/titles/anilist/{anime_id}/episodes/sync")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["created"] == 3
    assert body["total"] == 3


@respx.mock
async def test_mangadex_chapter_sync(db_session, api_client, cache, monkeypatch):
    monkeypatch.setattr(registry, "get_mangadex", lambda: MangaDexClient(cache))
    manga_id = "a1c7d8e9-0123-4567-89ab-cdef01234567"
    detail = {
        "data": {
            "attributes": {
                "title": {"en": "One Piece"},
                "description": {"en": "d"},
                "year": 1997,
                "tags": [],
            },
            "relationships": [],
        }
    }
    chapters = {
        "total": 2,
        "data": [
            {
                "id": "c1",
                "attributes": {
                    "chapter": "1",
                    "title": "Romance Dawn",
                    "publishAt": "2018-01-01T00:00:00+00:00",
                },
            },
            {
                "id": "c2",
                "attributes": {
                    "chapter": "2",
                    "title": None,
                    "publishAt": "2018-01-08T00:00:00+00:00",
                },
            },
        ],
    }
    respx.get(f"https://api.mangadex.org/manga/{manga_id}").mock(
        return_value=Response(200, json=detail)
    )
    respx.get(f"https://api.mangadex.org/manga/{manga_id}/feed").mock(
        return_value=Response(200, json=chapters)
    )

    resp = await api_client.post(f"/titles/mangadex/{manga_id}/episodes/sync")
    assert resp.status_code == 200
    assert resp.json() == {"created": 2, "total": 2}


@respx.mock
async def test_sync_movie_is_noop(api_client, cache, monkeypatch):
    """Movies/games have no episodes — sync is a clean noop, not an error."""
    _enable_tmdb(cache, monkeypatch)
    movie_detail = {
        "id": 500,
        "title": "Some Movie",
        "overview": None,
        "release_date": "2020-01-01",
        "genres": [],
        "runtime": 100,
        "credits": {"cast": []},
        "watch/providers": {"results": {}},
    }
    respx.get("https://api.themoviedb.org/3/movie/500").mock(
        return_value=Response(200, json=movie_detail)
    )
    resp = await api_client.post("/titles/tmdb/500/episodes/sync", params={"media_type": "movie"})
    assert resp.status_code == 200
    assert resp.json()["created"] == 0
