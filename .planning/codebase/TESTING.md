# Testing Patterns

**Analysis Date:** 2026-08-31

## Test Framework

**Runner:**
- pytest 9.1.1 (pinned in `backend/requirements.txt`; floor `pytest>=8.0` in `backend/requirements-dev.txt`)
- Config: `backend/pyproject.toml` `[tool.pytest.ini_options]` — `testpaths = ["tests"]`, `asyncio_mode = "auto"`
- pytest-asyncio 1.4.0 in **auto mode** — write plain `async def test_*` with no `@pytest.mark.asyncio` marker
- Plugins: `respx` (HTTP mocking), `fakeredis` (in-memory Redis), `pytest-mock`, `pytest-cov`

**Assertion Library:**
- Plain `assert` statements (no unittest assertions)

**Run Commands:**
```bash
cd backend && .venv\Scripts\python -m pytest    # run all tests (root AGENTS.md verify step)
cd backend && ruff check .                      # lint (same verify step)
cd backend && .venv\Scripts\python -m pytest --cov=app   # coverage (pytest-cov installed)
```

**Scale:** 99 collected tests (98 `test_*` functions + parametrize expansions across 16 files in `backend/tests/`; `@pytest.mark.parametrize` in `backend/tests/test_cache.py:61-66`).

## Test File Organization

**Location:**
- Flat directory: all tests in `backend/tests/` with `backend/tests/__init__.py` — no mirrored `app/` tree

**Naming:**
- Files: `test_<module>.py` for unit tests (`test_tmdb.py`, `test_cache.py`), `test_<feature>_api.py` / `test_<feature>.py` for endpoint suites (`test_search_api.py`, `test_library.py`)
- Test names encode the expected outcome/status code: `test_register_duplicate_email_409` (`backend/tests/test_auth.py:66`), `test_rating_out_of_range_422` (`backend/tests/test_library.py:121`), `test_b_cannot_modify_a_entry` (`backend/tests/test_isolation.py:42`)

**Structure:**
```
backend/tests/
├── conftest.py            # shared fixtures (redis, cache, db, api_client, auth headers)
├── test_cache.py          # CacheLayer unit tests
├── test_health.py         # sync TestClient smoke tests
├── test_auth.py           # auth matrix (token validity, register/login/refresh/google)
├── test_isolation.py      # cross-user data isolation (critical security suite)
├── test_library.py        # library CRUD
├── test_progress.py       # episode progress
├── test_search_api.py     # /search fan-out via respx + registry monkeypatch
├── test_titles_api.py     # /titles upsert
├── test_india_filter.py   # provider country filtering
├── test_episode_sync.py   # TMDB/AniList/MangaDex episode sync
├── test_tmdb.py, test_rawg.py, test_anilist.py, test_jikan.py, test_mangadex.py  # per-source clients
```

## Test Structure

**Suite Organization (`backend/tests/test_tmdb.py:66-80`):**
```python
@respx.mock
async def test_search_movie(cache):
    route = respx.get("https://api.themoviedb.org/3/search/movie").mock(
        return_value=Response(200, json=MOVIE_SEARCH)
    )
    client = TMDBClient(api_key="test-key", cache=cache)
    items = await client.search(MediaType.MOVIE, "Inception")

    assert route.called
    assert len(items) == 1
    assert item.source_id == "27205"
```

**Patterns:**
- Expected upstream JSON payloads are module-level UPPERCASE constants: `MOVIE_SEARCH`, `TV_DETAIL` (`backend/tests/test_tmdb.py:7-63`), `ANILIST_SEARCH` (`backend/tests/test_search_api.py:23-38`)
- Docstrings on tests explain intent and reference the phase plan: `"""One source failing (500) must not break the merged response."""` (`backend/tests/test_search_api.py:69`)
- Section dividers group suites: `# --- register ---`, `# --- login ---` (`backend/tests/test_auth.py:34,86`)
- Assertion messages attach the response body for debuggability: `assert resp.status_code == 201, resp.text` (`backend/tests/conftest.py:85`)
- Exception-type checks use `pytest.raises(ValueError)` (`backend/tests/test_tmdb.py:149-150`) or try/except + `raise AssertionError` when asserting the error type matters (`backend/tests/test_auth.py:47-51`)
- Teardown is handled inside fixtures (`yield` + cleanup), not in test bodies

## Fixtures and Fixtures/Conftest (`backend/tests/conftest.py`)

**`fake_redis`** — in-memory Redis, no server needed (`backend/tests/conftest.py:15-19`):
```python
@pytest.fixture
async def fake_redis():
    client = FakeAsyncRedis(decode_responses=True)
    yield client
    await client.aclose()
```

**`cache`** — CacheLayer over fakeredis; carries `hits`/`misses` counters used in assertions (`backend/tests/conftest.py:22-24`, asserted in `backend/tests/test_cache.py:19-20` and `backend/tests/test_tmdb.py:137`):
```python
@pytest.fixture
async def cache(fake_redis):
    return CacheLayer(fake_redis)
```

**`db_engine` / `db_session`** — integration DB against the compose Postgres (`localhost:5433`, database `trakplus_test`). Creates the DB via an asyncpg admin connection if missing, then `drop_all`/`create_all` (deliberately NOT Alembic — the migration chain is verified separately, see docstring at `backend/tests/conftest.py:29-33`). Drops native enum types first to clear leftovers (`backend/tests/conftest.py:48-49`).

**`api_client`** — HTTPX `AsyncClient` with `ASGITransport(app=app)` and FastAPI dependency override of `get_db` to the test session; clears `app.dependency_overrides` on teardown (`backend/tests/conftest.py:63-75`).

**`user_a_headers` / `user_b_headers`** — real register + login round-trip through `_register_and_login()`, returning `{"Authorization": f"Bearer {token}"}`. Emails are uuid-suffixed (`f"user-a-{uuid.uuid4().hex[:8]}@test.dev"`) so every test gets isolated users (`backend/tests/conftest.py:78-105`).

**Local per-file fixtures:** e.g. `title` fixture in `backend/tests/test_isolation.py:12-18` and `backend/tests/test_library.py:25-27`, `tv_title_with_episodes` in `backend/tests/test_progress.py` — small model-level factories that `db_session.add()` + `commit()` + `refresh()`.

## Mocking

**Framework:** `respx` for HTTP, `monkeypatch` (pytest builtin) for everything else; `pytest-mock` is installed but `mocker` is not used in current tests.

**HTTP mocking (respx) — three patterns:**
1. Simple response: `respx.get(url).mock(return_value=Response(200, json=...))` (`backend/tests/test_tmdb.py:84-88`)
2. Sequential responses for retry logic: `route.mock(side_effect=[Response(429), Response(200, json=SEARCH)])` asserts backoff-then-success (`backend/tests/test_jikan.py:73-88`)
3. Call verification: `assert route.called`, `assert route.call_count == 1` for cache-skip assertions (`backend/tests/test_tmdb.py:129-137`), and `assert not anilist_route.called` for negative fan-out (`backend/tests/test_search_api.py:100`)

**Registry monkeypatching** — swap singleton getters on `app.services.registry` to inject test clients or disable sources (`backend/tests/test_search_api.py:51-53`):
```python
monkeypatch.setattr(registry, "get_tmdb", lambda: TMDBClient("test-key", cache))
monkeypatch.setattr(registry, "get_rawg", lambda: None)          # key-gated source disabled
monkeypatch.setattr(registry, "get_anilist", lambda: AniListClient(cache))
```

**Settings/function monkeypatching** (`backend/tests/test_auth.py:217-231`):
```python
monkeypatch.setattr(get_settings(), "google_client_id", "test-client-id")
monkeypatch.setattr(auth_module, "verify_google_id_token", fake_verify)
# NOTE: must be a plain sync function — the endpoint runs it via run_in_threadpool.
```

**JWT forging for negative token tests** — hand-encode expired/wrong-secret tokens with pyjwt using `get_settings()` (`backend/tests/test_auth.py:24-31,129-162`).

**What to Mock:**
- All outbound HTTP (every external API call goes through respx — no live network in tests)
- Registry singletons and settings values via `monkeypatch`
- Redis via `FakeAsyncRedis` (real CacheLayer logic runs)

**What NOT to Mock:**
- The database — endpoint tests run against the real compose Postgres (`trakplus_test`)
- The app's own service/model code — only transport and config are faked
- Password hashing/JWT in auth flow tests (only `verify_google_id_token` is stubbed)

## Test Types

**Unit Tests:**
- Service clients tested in isolation with only the `cache` fixture: `test_tmdb.py`, `test_rawg.py`, `test_anilist.py`, `test_jikan.py`, `test_mangadex.py`, `test_cache.py` — no DB, no app import
- `backend/tests/test_health.py` uses the sync `fastapi.testclient.TestClient` directly (no DB override) for smoke tests

**Integration Tests:**
- Endpoint suites (`test_auth`, `test_library`, `test_isolation`, `test_progress`, `test_titles_api`, `test_india_filter`, `test_episode_sync`) go through the real FastAPI app via `api_client` against real Postgres, exercising auth, upserts, and cross-request persistence

**E2E Tests:**
- Not used (no Playwright/Cypress; frontend has no test framework — gates are `npm run lint` + `npm run build` per root `AGENTS.md`)

## Coverage

**Requirements:** None enforced (no `--cov-fail-under` or `fail_under` in config); pytest-cov 7.1.0 installed and a `.coverage` file exists at repo root, so coverage has been run manually

**View Coverage:**
```bash
cd backend && .venv\Scripts\python -m pytest --cov=app --cov-report=term-missing
```

## Common Patterns

**Async Testing:**
```python
# No markers needed — asyncio_mode = "auto" (backend/pyproject.toml)
async def test_refresh_flow_issues_new_tokens(api_client):
    ...
```
Sync `def` tests are equally valid in auto mode (`backend/tests/test_health.py:8`).

**Error/Status Testing:**
```python
async def test_register_duplicate_email_409(api_client):
    await _register(api_client, "dupe@test.dev")
    resp = await _register(api_client, "dupe@test.dev")
    assert resp.status_code == 409
```
The auth suite is the canonical negative-case matrix: expired / malformed / missing / wrong-secret / type-confused tokens all asserted to 401 (`backend/tests/test_auth.py:129-206`).

**Security Testing:**
- Cross-user isolation is a dedicated suite: user B must get 404 (not 403 — no existence leak) when touching user A's entries, with the "unchanged from A's view" state re-verified after each attempt (`backend/tests/test_isolation.py`)
- Every mutating endpoint has a `test_*_requires_auth` case (`backend/tests/test_library.py:130`, `backend/tests/test_progress.py:125`) — replicate this for any new authenticated route

**Degradation Testing:**
- Fault-injection via fakeredis: close the client to simulate a dead Redis and assert the fetcher still succeeds (`backend/tests/test_cache.py:33-44`); corrupt JSON treated as a miss (`backend/tests/test_cache.py:47-58`)

---

*Testing analysis: 2026-08-31*
