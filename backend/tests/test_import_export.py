"""Import/export tests (todos.md Phase 4).

Covers: JSON + CSV export shape, round-trip re-import, generic CSV import,
and the required edge cases — malformed row, unknown external ID, duplicate
entries, empty file.
"""

import io
import json

import respx
from httpx import Response
from sqlalchemy import select

from app.models import LibraryEntry, Title
from app.models.enums import LibraryStatus, MediaType
from app.services import registry
from app.services.anilist import AniListClient

# ── fixtures ────────────────────────────────────────────────────────────────


async def _seed_title(
    db_session, *, media_type=MediaType.MOVIE, tmdb_id="27205", anilist_id=None
) -> Title:
    title = Title(
        media_type=media_type,
        tmdb_id=tmdb_id,
        anilist_id=anilist_id,
        title="Inception" if media_type == MediaType.MOVIE else "Death Note",
        synopsis="A thief who steals secrets from dreams.",
        release_date=None,
        genres=["Action", "Sci-Fi"],
    )
    db_session.add(title)
    await db_session.commit()
    await db_session.refresh(title)
    return title


async def _add_entry(
    db_session, user_headers_id: str, title: Title, status: LibraryStatus, rating=None
) -> LibraryEntry:
    # Resolve a real user id — the user_a_headers/user_b_headers fixtures register one.
    from app.models import User

    user = (await db_session.execute(select(User))).scalars().first()
    entry = LibraryEntry(user_id=user.id, title_id=title.id, status=status, rating=rating)
    db_session.add(entry)
    await db_session.commit()
    await db_session.refresh(entry)
    return entry


# ── export ──────────────────────────────────────────────────────────────────


async def test_export_json_shape(db_session, api_client, user_a_headers):
    title = await _seed_title(db_session, tmdb_id="27205")
    await _add_entry(db_session, None, title, LibraryStatus.COMPLETED, rating=9)

    resp = await api_client.get(
        "/library/export", params={"format": "json"}, headers=user_a_headers
    )
    assert resp.status_code == 200
    assert "application/json" in resp.headers["content-type"]
    body = resp.json()

    assert set(body.keys()) == {"history", "ratings", "watchlist"}
    # completed + rated → in both history and ratings
    assert len(body["history"]) == 1
    assert len(body["ratings"]) == 1
    assert body["ratings"][0]["rating"] == 9
    assert body["history"][0]["type"] == "movie"
    assert body["history"][0]["movie"]["ids"]["tmdb"] == "27205"
    assert body["watchlist"] == []


async def test_export_json_plan_to_goes_to_watchlist(db_session, api_client, user_a_headers):
    title = await _seed_title(db_session, tmdb_id="27205")
    await _add_entry(db_session, None, title, LibraryStatus.PLAN_TO)

    resp = await api_client.get(
        "/library/export", params={"format": "json"}, headers=user_a_headers
    )
    body = resp.json()
    assert body["history"] == []
    assert body["ratings"] == []
    assert len(body["watchlist"]) == 1


async def test_export_csv_shape(db_session, api_client, user_a_headers):
    title = await _seed_title(db_session, tmdb_id="27205")
    await _add_entry(db_session, None, title, LibraryStatus.WATCHING)

    resp = await api_client.get("/library/export", params={"format": "csv"}, headers=user_a_headers)
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    lines = resp.text.strip().splitlines()
    assert lines[0] == "source,external_id,media_type,title,status,rating,notes,added_at,updated_at"
    assert "tmdb,27205,movie,Inception,watching" in lines[1]


async def test_export_requires_auth(api_client):
    resp = await api_client.get("/library/export", params={"format": "json"})
    assert resp.status_code == 401


async def test_export_template(api_client, user_a_headers):
    resp = await api_client.get("/library/export/template", headers=user_a_headers)
    assert resp.status_code == 200
    assert "source,external_id,media_type,status,rating,notes" in resp.text


# ── import: JSON (Trakt style) ───────────────────────────────────────────────


async def test_import_trakt_json_creates_entries(db_session, api_client, user_a_headers):
    await _seed_title(db_session, tmdb_id="27205")

    payload = {
        "history": [
            {
                "watched_at": "2024-01-01T00:00:00Z",
                "action": "watch",
                "type": "movie",
                "movie": {"title": "Inception", "ids": {"tmdb": 27205}},
            }
        ],
        "ratings": [
            {
                "rated_at": "2024-01-02T00:00:00Z",
                "rating": 9,
                "type": "movie",
                "movie": {"title": "Inception", "ids": {"tmdb": 27205}},
            }
        ],
        "watchlist": [],
    }
    resp = await api_client.post(
        "/library/import",
        headers=user_a_headers,
        files={
            "file": (
                "trakt.json",
                io.BytesIO(json.dumps(payload).encode()),
                "application/json",
            )
        },
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["created"] == 1  # history + ratings reference the same title → one entry
    assert result["errors"] == []

    entries = (await db_session.execute(select(LibraryEntry))).scalars().all()
    assert len(entries) == 1
    assert entries[0].status == LibraryStatus.COMPLETED  # has a rating
    assert entries[0].rating == 9


async def test_import_duplicate_skipped(db_session, api_client, user_a_headers):
    title = await _seed_title(db_session, tmdb_id="27205")
    await _add_entry(db_session, None, title, LibraryStatus.PLAN_TO)

    payload = {
        "watchlist": [
            {
                "listed_at": "2024-01-01T00:00:00Z",
                "type": "movie",
                "movie": {"title": "Inception", "ids": {"tmdb": 27205}},
            }
        ]
    }
    resp = await api_client.post(
        "/library/import",
        headers=user_a_headers,
        files={"file": ("t.json", io.BytesIO(json.dumps(payload).encode()), "application/json")},
    )
    result = resp.json()
    assert result["created"] == 0
    assert result["skipped"] == 1  # duplicate → not re-added


async def test_import_unknown_external_id_reports_error(
    db_session, api_client, user_a_headers, cache, monkeypatch
):
    """Unknown title must surface as a per-row error, not silently fail."""
    monkeypatch.setattr(registry, "get_anilist", lambda: AniListClient(cache))
    respx.post("https://graphql.anilist.co").mock(return_value=Response(500))

    payload = {
        "history": [
            {
                "watched_at": "2024-01-01T00:00:00Z",
                "action": "watch",
                "type": "show",
                "show": {"title": "Nope", "ids": {"anilist": 999999}},
            }
        ]
    }
    resp = await api_client.post(
        "/library/import",
        headers=user_a_headers,
        files={"file": ("t.json", io.BytesIO(json.dumps(payload).encode()), "application/json")},
    )
    result = resp.json()
    assert result["created"] == 0
    assert result["skipped"] == 1
    assert len(result["errors"]) == 1
    assert "could not resolve" in result["errors"][0]["reason"]


async def test_import_malformed_json_returns_400(api_client, user_a_headers):
    resp = await api_client.post(
        "/library/import",
        headers=user_a_headers,
        files={"file": ("bad.json", io.BytesIO(b"{not valid json"), "application/json")},
    )
    assert resp.status_code == 400
    assert "invalid JSON" in resp.json()["detail"]


async def test_import_empty_file_returns_400(api_client, user_a_headers):
    resp = await api_client.post(
        "/library/import",
        headers=user_a_headers,
        files={"file": ("empty.csv", io.BytesIO(b""), "text/csv")},
    )
    assert resp.status_code == 400
    assert "empty" in resp.json()["detail"]


# ── import: CSV ──────────────────────────────────────────────────────────────


async def test_import_csv_creates_entries(db_session, api_client, user_a_headers):
    await _seed_title(db_session, tmdb_id="27205")

    csv_content = (
        "source,external_id,media_type,status,rating,notes\ntmdb,27205,movie,completed,9,Loved it\n"
    )
    resp = await api_client.post(
        "/library/import",
        headers=user_a_headers,
        files={"file": ("library.csv", io.BytesIO(csv_content.encode()), "text/csv")},
    )
    result = resp.json()
    assert result["created"] == 1
    assert result["errors"] == []

    entries = (await db_session.execute(select(LibraryEntry))).scalars().all()
    assert entries[0].status == LibraryStatus.COMPLETED
    assert entries[0].rating == 9
    assert entries[0].notes == "Loved it"


async def test_import_csv_malformed_row_reported(db_session, api_client, user_a_headers):
    """A row with an invalid status is reported per-row, others still import."""
    await _seed_title(db_session, tmdb_id="27205")
    await _seed_title(db_session, tmdb_id="99999")  # second title we can reference

    csv_content = (
        "source,external_id,media_type,status,rating,notes\n"
        "tmdb,27205,movie,completed,9,Fine\n"
        "tmdb,99999,movie,bogus_status,,Bad\n"
    )
    resp = await api_client.post(
        "/library/import",
        headers=user_a_headers,
        files={"file": ("library.csv", io.BytesIO(csv_content.encode()), "text/csv")},
    )
    result = resp.json()
    assert result["created"] == 1
    assert result["skipped"] == 1
    assert len(result["errors"]) == 1
    assert "invalid status" in result["errors"][0]["reason"]


async def test_import_csv_duplicate_skipped(db_session, api_client, user_a_headers):
    title = await _seed_title(db_session, tmdb_id="27205")
    await _add_entry(db_session, None, title, LibraryStatus.PLAN_TO)

    csv_content = "source,external_id,media_type,status,rating,notes\n"
    csv_content += "tmdb,27205,movie,watching,,\n"
    resp = await api_client.post(
        "/library/import",
        headers=user_a_headers,
        files={"file": ("library.csv", io.BytesIO(csv_content.encode()), "text/csv")},
    )
    result = resp.json()
    assert result["created"] == 0
    assert result["skipped"] == 1


# ── round-trip ───────────────────────────────────────────────────────────────


async def test_export_then_import_round_trip(
    db_session, api_client, user_a_headers, user_b_headers
):
    """Export user A's library as JSON, then import it as user B — clean re-import."""
    title = await _seed_title(db_session, tmdb_id="27205")
    await _add_entry(db_session, None, title, LibraryStatus.WATCHING)

    # User A exports
    export = await api_client.get(
        "/library/export", params={"format": "json"}, headers=user_a_headers
    )
    assert export.status_code == 200

    # User B imports the exact file
    resp = await api_client.post(
        "/library/import",
        headers=user_b_headers,
        files={"file": ("trakplus-library.json", io.BytesIO(export.content), "application/json")},
    )
    result = resp.json()
    assert result["created"] == 1
    assert result["errors"] == []

    # User B now has the title
    b_entries = (await db_session.execute(select(LibraryEntry))).scalars().all()
    assert len(b_entries) == 2  # A's + B's
