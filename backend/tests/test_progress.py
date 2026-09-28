"""Progress CRUD (todos.md Phase 2): marking episode 5 doesn't touch 1-4;
watched counts are correct; episodes of another title are rejected."""

import uuid

import pytest

from app.models import Episode, Title
from app.models.enums import MediaType


@pytest.fixture
async def tv_title_with_episodes(db_session) -> tuple[Title, list[Episode]]:
    title = Title(media_type=MediaType.TV, title="Progress Show")
    db_session.add(title)
    await db_session.flush()
    episodes = [
        Episode(title_id=title.id, number=n, season=1, name=f"Ep {n}") for n in range(1, 11)
    ]
    db_session.add_all(episodes)
    await db_session.commit()
    for e in episodes:
        await db_session.refresh(e)
    await db_session.refresh(title)
    return title, episodes


@pytest.fixture
async def movie_title(db_session) -> Title:
    title = Title(media_type=MediaType.MOVIE, title="Other Movie")
    db_session.add(title)
    await db_session.commit()
    await db_session.refresh(title)
    return title


async def _entry(api_client, headers, title_id: str) -> str:
    resp = await api_client.post(
        "/library", json={"title_id": title_id, "status": "watching"}, headers=headers
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def test_mark_episode_updates_count_without_touching_others(
    api_client, user_a_headers, tv_title_with_episodes
):
    title, episodes = tv_title_with_episodes
    entry_id = await _entry(api_client, user_a_headers, str(title.id))

    # mark episode 5
    resp = await api_client.post(
        f"/library/{entry_id}/progress/{episodes[4].id}", headers=user_a_headers
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["watched_count"] == 1
    assert body["watched_episode_ids"] == [str(episodes[4].id)]
    assert body["total_episodes"] == 10

    # episodes 1-4 state unaffected (not in watched list)
    assert str(episodes[0].id) not in body["watched_episode_ids"]

    # mark 3 more
    for idx in (0, 1, 2):
        r = await api_client.post(
            f"/library/{entry_id}/progress/{episodes[idx].id}", headers=user_a_headers
        )
        assert r.status_code == 200

    summary = await api_client.get(f"/library/{entry_id}/progress", headers=user_a_headers)
    assert summary.json()["watched_count"] == 4


async def test_mark_is_idempotent(api_client, user_a_headers, tv_title_with_episodes):
    title, episodes = tv_title_with_episodes
    entry_id = await _entry(api_client, user_a_headers, str(title.id))
    for _ in range(3):
        r = await api_client.post(
            f"/library/{entry_id}/progress/{episodes[6].id}", headers=user_a_headers
        )
        assert r.status_code == 200
    summary = await api_client.get(f"/library/{entry_id}/progress", headers=user_a_headers)
    assert summary.json()["watched_count"] == 1


async def test_unmark_episode(api_client, user_a_headers, tv_title_with_episodes):
    title, episodes = tv_title_with_episodes
    entry_id = await _entry(api_client, user_a_headers, str(title.id))
    await api_client.post(f"/library/{entry_id}/progress/{episodes[8].id}", headers=user_a_headers)
    resp = await api_client.delete(
        f"/library/{entry_id}/progress/{episodes[8].id}", headers=user_a_headers
    )
    assert resp.status_code == 200
    assert resp.json()["watched_count"] == 0


async def test_cannot_mark_episode_of_other_title(
    api_client, user_a_headers, db_session, tv_title_with_episodes, movie_title
):
    title, episodes = tv_title_with_episodes
    entry_id = await _entry(api_client, user_a_headers, str(title.id))

    # an episode that exists but belongs to a different title
    other_ep = Episode(title_id=movie_title.id, number=99, season=0)
    db_session.add(other_ep)
    await db_session.commit()
    await db_session.refresh(other_ep)

    resp = await api_client.post(
        f"/library/{entry_id}/progress/{other_ep.id}", headers=user_a_headers
    )
    assert resp.status_code == 404
    assert "episode not found" in resp.json()["detail"]

    # unknown random episode id → also 404
    resp = await api_client.post(
        f"/library/{entry_id}/progress/{uuid.uuid4()}", headers=user_a_headers
    )
    assert resp.status_code == 404


async def test_progress_requires_auth(api_client, tv_title_with_episodes):
    title, _ = tv_title_with_episodes
    resp = await api_client.get(f"/library/{uuid.uuid4()}/progress")
    assert resp.status_code == 401


async def test_b_cannot_touch_a_progress(
    api_client, user_a_headers, user_b_headers, tv_title_with_episodes
):
    title, episodes = tv_title_with_episodes
    entry_id = await _entry(api_client, user_a_headers, str(title.id))
    resp = await api_client.post(
        f"/library/{entry_id}/progress/{episodes[0].id}", headers=user_b_headers
    )
    assert resp.status_code == 404  # entry belongs to A → invisible to B
