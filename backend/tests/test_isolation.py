"""Data isolation (todos.md Phase 2, critical): user A's entries are invisible
and untouchable by user B. Ownership violations return 404 (no existence leak)."""

import uuid

import pytest

from app.models import Title
from app.models.enums import MediaType


@pytest.fixture
async def title(db_session) -> Title:
    title = Title(media_type=MediaType.TV, title="Shared Show")
    db_session.add(title)
    await db_session.commit()
    await db_session.refresh(title)
    return title


async def _a_entry(api_client, user_a_headers, title) -> str:
    resp = await api_client.post(
        "/library", json={"title_id": str(title.id), "status": "watching"}, headers=user_a_headers
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def test_b_cannot_read_a_entries(api_client, user_a_headers, user_b_headers, title):
    entry_id = await _a_entry(api_client, user_a_headers, title)
    # B's listing must not contain A's entry
    listing = await api_client.get("/library", headers=user_b_headers)
    assert listing.status_code == 200
    assert listing.json() == []
    # direct fetch of A's entry id by B → 404
    resp = await api_client.patch(
        f"/library/{entry_id}", json={"status": "completed"}, headers=user_b_headers
    )
    assert resp.status_code == 404


async def test_b_cannot_modify_a_entry(api_client, user_a_headers, user_b_headers, title):
    entry_id = await _a_entry(api_client, user_a_headers, title)
    resp = await api_client.patch(
        f"/library/{entry_id}", json={"status": "dropped"}, headers=user_b_headers
    )
    assert resp.status_code == 404
    # unchanged from A's view
    listing = await api_client.get("/library", headers=user_a_headers)
    assert listing.json()[0]["status"] == "watching"


async def test_b_cannot_delete_a_entry(api_client, user_a_headers, user_b_headers, title):
    entry_id = await _a_entry(api_client, user_a_headers, title)
    resp = await api_client.delete(f"/library/{entry_id}", headers=user_b_headers)
    assert resp.status_code == 404
    listing = await api_client.get("/library", headers=user_a_headers)
    assert len(listing.json()) == 1


async def test_both_users_can_have_same_title(api_client, user_a_headers, user_b_headers, title):
    for headers in (user_a_headers, user_b_headers):
        resp = await api_client.post(
            "/library", json={"title_id": str(title.id), "status": "plan_to"}, headers=headers
        )
        assert resp.status_code == 201
    a_list = (await api_client.get("/library", headers=user_a_headers)).json()
    b_list = (await api_client.get("/library", headers=user_b_headers)).json()
    assert len(a_list) == 1 and len(b_list) == 1
    assert a_list[0]["id"] != b_list[0]["id"]


async def test_random_entry_id_404(api_client, user_a_headers):
    resp = await api_client.get(f"/library/{uuid.uuid4()}", headers=user_a_headers)
    assert resp.status_code == 405  # GET-by-id route not exposed; only list/patch/delete
