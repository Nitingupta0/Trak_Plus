"""Schedule endpoint tests — upcoming/backlog unwatched episodes across a library."""

import uuid
from datetime import date, timedelta

from app.models import Episode, Title


async def _make_title_with_episodes(
    db_session, poster: str | None = "https://example.com/p.jpg", *, dated: bool = True
) -> Title:
    title = Title(media_type="tv", title="Test Show", tmdb_id=str(uuid.uuid4()), poster_url=poster)
    db_session.add(title)
    await db_session.flush()
    base = date.today()
    for number in range(1, 4):
        db_session.add(
            Episode(
                title_id=title.id,
                number=number,
                season=1,
                name=f"Episode {number}",
                air_date=base + timedelta(days=number if dated else 0),
            )
        )
    await db_session.commit()
    await db_session.refresh(title)
    return title


class TestSchedule:
    async def test_empty_library(self, api_client, user_a_headers):
        resp = await api_client.get("/schedule", headers=user_a_headers)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["upcoming"] == []
        assert body["backlog"] == []

    async def test_upcoming_unwatched_episodes(self, api_client, user_a_headers, db_session):
        title = await _make_title_with_episodes(db_session)
        resp = await api_client.post(
            "/library",
            headers=user_a_headers,
            json={"title_id": str(title.id), "status": "watching"},
        )
        assert resp.status_code == 201, resp.text
        entry_id = resp.json()["id"]

        resp = await api_client.get("/schedule", headers=user_a_headers)
        assert resp.status_code == 200
        body = resp.json()
        # Episodes dated today+1..3 are all upcoming; none watched yet.
        assert len(body["upcoming"]) == 3
        assert body["backlog"] == []
        first = body["upcoming"][0]
        assert first["entry_id"] == entry_id
        assert first["title"] == "Test Show"
        assert first["episode_number"] == 1
        assert first["poster_url"] == "https://example.com/p.jpg"
        # Sorted by air_date ascending
        dates = [e["air_date"] for e in body["upcoming"]]
        assert dates == sorted(dates)

    async def test_watched_episodes_excluded(self, api_client, user_a_headers, db_session):
        title = await _make_title_with_episodes(db_session)
        resp = await api_client.post(
            "/library",
            headers=user_a_headers,
            json={"title_id": str(title.id), "status": "watching"},
        )
        entry_id = resp.json()["id"]

        # Watch episode 1 (dated today+1)
        episodes = (
            await api_client.get(f"/titles/tmdb/{title.tmdb_id}/episodes", headers=user_a_headers)
        ).json()
        ep1 = next(e for e in episodes if e["number"] == 1)
        resp = await api_client.post(
            f"/library/{entry_id}/progress/{ep1['id']}", headers=user_a_headers
        )
        assert resp.status_code == 200, resp.text

        resp = await api_client.get("/schedule", headers=user_a_headers)
        body = resp.json()
        numbers = [e["episode_number"] for e in body["upcoming"]]
        assert 1 not in numbers
        assert len(body["upcoming"]) == 2

    async def test_aired_unwatched_is_backlog(self, api_client, user_a_headers, db_session):
        # Past-dated episode (air_date today-2 via undated=off trick: build manually)
        title = Title(media_type="tv", title="Old Show", anilist_id=str(uuid.uuid4()))
        db_session.add(title)
        await db_session.flush()
        db_session.add(
            Episode(
                title_id=title.id,
                number=1,
                season=0,
                name="Old ep",
                air_date=date.today() - timedelta(days=2),
            )
        )
        await db_session.commit()

        resp = await api_client.post(
            "/library",
            headers=user_a_headers,
            json={"title_id": str(title.id), "status": "watching"},
        )
        assert resp.status_code == 201

        resp = await api_client.get("/schedule", headers=user_a_headers)
        body = resp.json()
        assert len(body["backlog"]) == 1
        assert body["backlog"][0]["title"] == "Old Show"

    async def test_completed_entries_excluded(self, api_client, user_a_headers, db_session):
        title = await _make_title_with_episodes(db_session)
        resp = await api_client.post(
            "/library",
            headers=user_a_headers,
            json={"title_id": str(title.id), "status": "completed"},
        )
        assert resp.status_code == 201

        resp = await api_client.get("/schedule", headers=user_a_headers)
        body = resp.json()
        assert body["upcoming"] == []
        assert body["backlog"] == []

    async def test_planned_movie_and_game_events(self, api_client, user_a_headers, db_session):
        today = date.today()
        movie = Title(
            media_type="movie",
            title="Planned Movie",
            tmdb_id=str(uuid.uuid4()),
            release_date=today + timedelta(days=2),
        )
        game = Title(
            media_type="game",
            title="Planned Game",
            rawg_id=str(uuid.uuid4()),
            release_date=today + timedelta(days=1),
        )
        db_session.add_all([movie, game])
        await db_session.commit()

        for title in (movie, game):
            resp = await api_client.post(
                "/library",
                headers=user_a_headers,
                json={"title_id": str(title.id), "status": "plan_to"},
            )
            assert resp.status_code == 201, resp.text

        resp = await api_client.get("/schedule", headers=user_a_headers)
        assert resp.status_code == 200, resp.text
        events = resp.json()["upcoming"]
        assert [event["kind"] for event in events] == ["title", "title"]
        assert [event["title"] for event in events] == ["Planned Game", "Planned Movie"]
        assert all(event["episode_id"] is None for event in events)
        assert [event["scheduled_date"] for event in events] == sorted(
            event["scheduled_date"] for event in events
        )

    async def test_mixed_title_and_episode_events_are_chronological(
        self, api_client, user_a_headers, db_session
    ):
        today = date.today()
        planned = Title(
            media_type="movie",
            title="Planned Movie",
            tmdb_id=str(uuid.uuid4()),
            release_date=today + timedelta(days=2),
        )
        episodic = await _make_title_with_episodes(db_session)
        db_session.add(planned)
        await db_session.commit()

        for title_id, status in ((planned.id, "plan_to"), (episodic.id, "watching")):
            resp = await api_client.post(
                "/library",
                headers=user_a_headers,
                json={"title_id": str(title_id), "status": status},
            )
            assert resp.status_code == 201, resp.text

        resp = await api_client.get("/schedule", headers=user_a_headers)
        assert resp.status_code == 200, resp.text
        events = resp.json()["upcoming"]
        assert [event["kind"] for event in events] == ["episode", "title", "episode", "episode"]
        assert [event["scheduled_date"] for event in events] == sorted(
            event["scheduled_date"] for event in events
        )
        assert events[0]["title"] == "Test Show"
        assert events[1]["title"] == "Planned Movie"
        assert events[1]["episode_id"] is None
        assert events[2]["episode_id"] is not None

    async def test_data_isolation(self, api_client, user_a_headers, user_b_headers, db_session):
        title = await _make_title_with_episodes(db_session)
        resp = await api_client.post(
            "/library",
            headers=user_a_headers,
            json={"title_id": str(title.id), "status": "watching"},
        )
        assert resp.status_code == 201, resp.text
        entry_a_id = resp.json()["id"]

        # B adds the same title to their own library
        resp = await api_client.post(
            "/library",
            headers=user_b_headers,
            json={"title_id": str(title.id), "status": "watching"},
        )
        assert resp.status_code == 201, resp.text

        # A watches episode 1 — must not affect B's schedule
        episodes = (
            await api_client.get(f"/titles/tmdb/{title.tmdb_id}/episodes", headers=user_a_headers)
        ).json()
        await api_client.post(
            f"/library/{entry_a_id}/progress/{episodes[0]['id']}", headers=user_a_headers
        )

        resp = await api_client.get("/schedule", headers=user_b_headers)
        numbers = [e["episode_number"] for e in resp.json()["upcoming"]]
        assert 1 in numbers, f"B's schedule missing episode 1 (isolation leak): {numbers}"
        assert len(resp.json()["upcoming"]) == 3
