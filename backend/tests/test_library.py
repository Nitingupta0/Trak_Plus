"""library_entries CRUD (todos.md Phase 2): add with status, update to another
status, persist across requests."""

import uuid

import pytest

from app.models import Title
from app.models.enums import MediaType


async def _make_title(db_session) -> Title:
    title = Title(
        media_type=MediaType.MOVIE,
        tmdb_id=str(uuid.uuid4().int % 10**8),
        title="Test Movie",
        synopsis="A test.",
    )
    db_session.add(title)
    await db_session.commit()
    await db_session.refresh(title)
    return title


@pytest.fixture
async def title(db_session) -> Title:
    return await _make_title(db_session)


async def test_add_and_list_entry(api_client, user_a_headers, title):
    resp = await api_client.post(
        "/library",
        json={"title_id": str(title.id), "status": "plan_to", "rating": 7},
        headers=user_a_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "plan_to"
    assert body["rating"] == 7
    assert body["title"]["title"] == "Test Movie"
    assert body["title"]["media_type"] == "movie"

    listing = await api_client.get("/library", headers=user_a_headers)
    assert listing.status_code == 200
    entries = listing.json()
    assert len(entries) == 1
    assert entries[0]["id"] == body["id"]


async def test_update_status_persists(api_client, user_a_headers, title):
    created = (
        await api_client.post(
            "/library",
            json={"title_id": str(title.id), "status": "plan_to"},
            headers=user_a_headers,
        )
    ).json()
    entry_id = created["id"]

    updated = await api_client.patch(
        f"/library/{entry_id}",
        json={"status": "watching", "notes": "loving it"},
        headers=user_a_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "watching"
    assert updated.json()["notes"] == "loving it"

    # persists across requests
    again = await api_client.get("/library", headers=user_a_headers)
    assert again.json()[0]["status"] == "watching"


async def test_update_partial_fields(api_client, user_a_headers, title):
    created = (
        await api_client.post(
            "/library",
            json={"title_id": str(title.id), "status": "plan_to", "rating": 5},
            headers=user_a_headers,
        )
    ).json()
    updated = await api_client.patch(
        f"/library/{created['id']}", json={"rating": 9}, headers=user_a_headers
    )
    assert updated.status_code == 200
    assert updated.json()["rating"] == 9
    assert updated.json()["status"] == "plan_to"  # untouched


async def test_add_duplicate_title_409(api_client, user_a_headers, title):
    payload = {"title_id": str(title.id), "status": "watching"}
    first = await api_client.post("/library", json=payload, headers=user_a_headers)
    assert first.status_code == 201
    second = await api_client.post("/library", json=payload, headers=user_a_headers)
    assert second.status_code == 409


async def test_add_unknown_title_404(api_client, user_a_headers):
    resp = await api_client.post(
        "/library",
        json={"title_id": str(uuid.uuid4()), "status": "watching"},
        headers=user_a_headers,
    )
    assert resp.status_code == 404


async def test_delete_entry(api_client, user_a_headers, title):
    created = (
        await api_client.post(
            "/library",
            json={"title_id": str(title.id), "status": "dropped"},
            headers=user_a_headers,
        )
    ).json()
    deleted = await api_client.delete(f"/library/{created['id']}", headers=user_a_headers)
    assert deleted.status_code == 204
    listing = await api_client.get("/library", headers=user_a_headers)
    assert listing.json() == []


async def test_rating_out_of_range_422(api_client, user_a_headers, title):
    resp = await api_client.post(
        "/library",
        json={"title_id": str(title.id), "status": "watching", "rating": 11},
        headers=user_a_headers,
    )
    assert resp.status_code == 422


async def test_library_requires_auth(api_client):
    resp = await api_client.get("/library")
    assert resp.status_code == 401
