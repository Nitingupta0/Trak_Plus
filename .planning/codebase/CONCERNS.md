# Codebase Concerns

**Analysis Date:** 2026-08-31

## Tech Debt

**No version control active (highest-impact item):**
- Issue: The repo is not a git repository yet. `docs/todos.md` line 15 lists "git init + GitHub push" as the remaining Phase 0 action, blocked on user approval. All source, including 83 passing tests and 3 Alembic migrations, exists in exactly one place.
- Files: repo root (`.gitignore` is ready but unused; `docs/todos.md`, `docs/progress.md` record the pending decision)
- Impact: No backup, no history, no rollback, no CI possible, no PR flow. Any accidental deletion or bad refactor is unrecoverable.
- Fix approach: `git init` + initial commit + GitHub push (user approval already flagged as the only blocker). Do this before any further phase work.

**Frontend is an untouched Next.js scaffold:**
- Issue: `frontend/src/app/page.tsx` is the default Next 16 starter page (renders `next.svg`). No API client, no auth flow, no library UI exists. `NEXT_PUBLIC_API_URL` is set in `docker-compose.yml:62` but consumed by nothing.
- Files: `frontend/src/app/page.tsx`, `frontend/src/app/layout.tsx`, `docker-compose.yml`
- Impact: Phase 3 is entirely greenfield; backend endpoints have no consumer, so integration gaps (CORS, cookie/BFF token handling per `docs/progress.md:23`) remain untested end-to-end.
- Fix approach: Implement Phase 3 per `docs/todos.md` — start with an API client module and auth flow, not UI polish.

**Terraform modules are empty placeholders:**
- Issue: All six module files are 5-6 line stubs (comment headers only). Remote state block is prepared but commented out. Provider binaries from a local `terraform init` sit in `infra/.terraform/` and `infra/environments/*/.terraform/`.
- Files: `infra/modules/{ecr,eks,elasticache,iam,network,rds}/main.tf`, `infra/main.tf`, `infra/backend.tf`, `infra/environments/prod/backend.hcl`, `infra/environments/staging/backend.hcl`
- Impact: No deployable infra. The `terraform validate` green state gives false confidence — nothing real is validated.
- Fix approach: Blocked on AWS credentials (bootstrap guide in `infra/README.md`); fill modules per `docs/design.md` §7 in the deploy phase.

**CI is not set up:**
- Issue: `.github/workflows/` contains only `.gitkeep`. Tests have never run in a clean container (Phase 1 note, `docs/progress.md:35` and `docs/todos.md:53`).
- Files: `.github/workflows/.gitkeep`, `backend/Dockerfile`
- Impact: Local-only verification; regressions can merge silently once git+GitHub exist. The Dockerfile test path is unverified.
- Fix approach: Phase 5 — GitHub Actions workflow running `pytest` + `ruff check .` inside the backend container image.

**Source-client singletons cache "disabled" state forever:**
- Issue: `registry.py` getters are `@lru_cache`d. If `TMDB_API_KEY`/`RAWG_API_KEY` is empty at first call, `None` is cached permanently — adding a key requires a process restart, even though `Settings` is env-driven. There is no runtime re-registration path.
- Files: `backend/app/services/registry.py:26-61`, `backend/app/core/config.py:41-43`
- Impact: Config changes (new API keys, rotated keys) need container restarts; operators may add a key and see "source disabled" with no explanation beyond one startup-time log line.
- Fix approach: Either accept restart-required behavior and document it, or replace `lru_cache` with an explicit lifecycle manager that re-reads settings.

**Cross-module private-symbol imports:**
- Issue: `episode_sync.py` imports `_parse_date` (private) from the TMDB client; `progress.py` imports `_get_owned_entry` (private) from the library API module.
- Files: `backend/app/services/episode_sync.py:19`, `backend/app/api/progress.py:11`
- Impact: Refactoring `tmdb.py` or `library.py` internals silently breaks other layers; private helpers are effectively public API with no contract.
- Fix approach: Move `_parse_date` to a shared `app/services/` or `app/core/` util module; move `_get_owned_entry` into `app/api/deps.py`.

**RAWG class-level mutable counter:**
- Issue: `RAWGClient.total_requests` is a class attribute mutated on every request — global mutable state shared across instances and tests, reset per process, invisible in multi-worker deployments.
- Files: `backend/app/services/rawg.py:21,29-36`
- Impact: The request counter (meant for tracking the 20k/mo free-tier budget per `docs/design.md` §4) is inaccurate under multiple workers; also couples tests to execution order.
- Fix approach: Track per-instance only, or persist the counter to Redis if the budget matters.

**Cache metrics are in-memory only:**
- Issue: `CacheLayer.hits/misses` counters exist on the instance but are never read, exported, or reset; design.md §9's Grafana cache-hit-ratio dashboard has no data source yet.
- Files: `backend/app/services/cache.py:21-22`, `backend/app/main.py` (no metrics middleware)
- Impact: No observability into cache effectiveness; dead code in the hot path.
- Fix approach: Expose via a `/metrics` endpoint or log-structured metric when Phase 5 observability work starts.

**Sync endpoint loads all episode IDs to compute a count:**
- Issue: After inserting new episodes, `sync_episodes` selects every `Episode.id` for the title just to return `total` — instead of `SELECT count(*)`.
- Files: `backend/app/services/episode_sync.py:104-106`
- Impact: Unnecessary memory/IO proportional to episode count (e.g., 220+ rows for NARUTO) on every sync call.
- Fix approach: Replace with `select(func.count()).select_from(Episode).where(Episode.title_id == title.id)`.

**Dev-friendly defaults in config:**
- Issue: `debug: bool = True` and the dev JWT secret are code defaults; only `docker-compose.yml` overrides `DEBUG: "false"`. A bare `uvicorn` run from `backend/` gets debug mode + insecure JWT.
- Files: `backend/app/core/config.py:17,27`, `docker-compose.yml:37-38`
- Impact: Drift between local runs and containerized runs; risk of shipping debug defaults if deployment config is forgotten.
- Fix approach: Add a startup guard that refuses to boot with the dev JWT secret when `environment != "local"`.

**Anime episodes are flat stubs (season 0):**
- Issue: AniList/Jikan/MAL syncs create placeholder episodes `1..N` with no names/dates under `season=0`; `season_count` is not populated for anime (AniList `season` enum ≠ count — flagged in `docs/progress.md:35` and never mapped).
- Files: `backend/app/services/episode_sync.py:24-25,69-73`, `backend/app/services/anilist.py` (`DETAIL_QUERY` omits a usable season count)
- Impact: Anime progress tracking works but carries no episode metadata; frontend cannot render per-season views for anime.
- Fix approach: Map AniList `season` to metadata separately from episode count, or leave documented as a v2 gap.

**Compose runs production builds instead of dev servers:**
- Issue: Intentional trade-off (`docs/progress.md:47`) to avoid Windows bind-mount file-watching problems — frontend/backend have no hot-reload under compose.
- Files: `docker-compose.yml:33-67`, `frontend/next.config.*` (standalone output)
- Impact: Slower inner loop for Phase 3 frontend work; revisit explicitly when UI work starts.
- Fix approach: Add a dev-mode compose override (`docker-compose.dev.yml`) in Phase 5.

## Known Bugs

**API key leakage in upstream-error passthrough:**
- Symptoms: When TMDB (v3 key mode) or RAWG returns a 4xx/5xx, the endpoint returns HTTP 502 with `detail=f"upstream request failed: {exc}"`. `httpx.HTTPStatusError.__str__` embeds the full request URL — which contains `?api_key=...` (TMDB, `tmdb.py:51`) or `?key=...` (RAWG, `rawg.py:37`). The secret key lands in the API response body and downstream client logs.
- Files: `backend/app/api/titles.py:66-69,82-85`, `backend/app/services/rawg.py:37`, `backend/app/services/tmdb.py:51`
- Trigger: Request any title with an invalid/malformed `external_id` (or when upstream is down with an error status) while TMDB/RAWG keys are configured.
- Workaround: None currently. TMDB/RAWG are disabled (no keys) today, which incidentally masks the bug.
- Fix approach: Return a generic `502 upstream request failed` without interpolating `exc`; log the exception server-side instead.

**Check-then-insert races cause unhandled 500s (IntegrityError):**
- Symptoms: Uniqueness is enforced at the DB level (`uq_user_title`, `uq_entry_episode`, `uq_episode_number`, unique `titles.*_id` columns), but the app does read-then-write without catching `IntegrityError`. Two concurrent identical requests → one gets an unhandled 500 instead of the intended 409/idempotent behavior.
- Files: `backend/app/services/title_store.py:28-47` (title upsert), `backend/app/api/library.py:63-83` (`add_entry` duplicate check), `backend/app/api/progress.py:62-71` (`mark_watched`), `backend/app/services/episode_sync.py:79-102` (concurrent syncs), constraints in `backend/app/models/library_entry.py:27`, `backend/app/models/progress.py:14`, `backend/app/models/episode.py:19`, `backend/app/models/title.py:28-32`
- Trigger: Duplicate concurrent requests (double-click, retry storms). Tests pass because they are sequential.
- Workaround: Client retries.
- Fix approach: Catch `sqlalchemy.exc.IntegrityError` at each site and translate to 409 / idempotent no-op, or use `INSERT ... ON CONFLICT DO NOTHING` for episode/progress rows.

**AniList GraphQL errors are swallowed and cached:**
- Symptoms: `_graphql` logs `errors` from a 200 response but returns `data.get("data") or {}` — an error-only response normalizes to empty results, then `search`/`detail` cache that emptiness for 24h.
- Files: `backend/app/services/anilist.py:58-62`, cache wrap at `backend/app/services/anilist.py` (search/detail `_cached` calls), `backend/app/services/cache.py:24-51`
- Trigger: AniList rate-limit/complexity errors that arrive as GraphQL errors with HTTP 200 (e.g., exceeding ~90 req/min during a burst of searches).
- Workaround: Cache TTL expiry (24h).
- Fix approach: Raise on non-empty `errors` when `data` is null so the fetch result is never cached; treat as a per-source failure like `search.py` already does.

**Episode sync N+1 season fetches for TV:**
- Symptoms: `_tmdb_rows` loops seasons and awaits one TMDB `season()` HTTP call per season sequentially — a 20-season show performs 20 sequential round trips (each with 10s timeout) on first sync.
- Files: `backend/app/services/episode_sync.py:28-41`, `backend/app/services/tmdb.py:84-101`
- Trigger: `POST /titles/tmdb/{id}/episodes/sync` on a multi-season TV title not yet in cache.
- Workaround: 24h per-season caching makes repeat syncs cheap (`tmdb.py:100`).
- Fix approach: Fan out season fetches with `asyncio.gather` (bounded with a semaphore to respect TMDB limits).

**JWT_SECRET_KEY insecure dev default (and compose never injects a real one):**
- Symptoms: `jwt_secret_key` defaults to `"dev-insecure-change-me-0123456789abcdef"` (`config.py:27`). Additionally, `docker-compose.yml` passes only `TMDB_API_KEY`/`RAWG_API_KEY` through to the backend container — `JWT_SECRET_KEY` and `GOOGLE_CLIENT_ID` are absent from the `environment:` block, so even a correctly filled root `.env` never reaches the container.
- Files: `backend/app/core/config.py:27`, `docker-compose.yml:36-43`, `.env.example:11`
- Trigger: Running the compose stack with tokens issued before a config change — all tokens remain valid across secret "changes" because the default never changes.
- Workaround: None for compose; run backend locally with a real `.env` instead.
- Fix approach: Add `JWT_SECRET_KEY: ${JWT_SECRET_KEY:-}` and `GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}` to `docker-compose.yml`, plus the startup guard described under Tech Debt.

## Security Considerations

**No rate limiting on auth endpoints (documented deferral):**
- Risk: `/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/google` can be brute-forced without limit; bcrypt cost slows but does not stop credential stuffing.
- Files: `backend/app/api/auth.py:39-140`, `docs/design.md:61` (v2 hardening backlog: per-IP rate limiting, token revocation/denylist via Redis, refresh-token rotation with reuse detection), `docs/progress.md:23`
- Current mitigation: None. Redis is already in the stack for a future limiter.
- Recommendations: Implement per-IP + per-account limits before any internet-facing deployment; the design doc already scopes it to Redis.

**Stateless refresh tokens with no revocation or rotation:**
- Risk: Refresh tokens are valid 7 days (`config.py:30`), reusable indefinitely, unrevocable — logout, password change, or account compromise cannot invalidate an issued token. No `jti`, no reuse detection.
- Files: `backend/app/core/security.py:33-63`, `backend/app/api/auth.py:74-89`
- Current mitigation: `type` claim prevents refresh-as-access confusion (`security.py:57-63`) — good. Denial documented in `docs/design.md:61`.
- Recommendations: Add Redis denylist + rotation with reuse detection per the v2 backlog before multi-user deployment.

**Unauthenticated DB-writing endpoints:**
- Risk: `GET /titles/{source}/{external_id}` upserts into the `titles` table (`titles.py:71`) and `POST /titles/{source}/{external_id}/episodes/sync` writes `episodes` rows — both with no `get_current_user` dependency. Anyone can trigger upstream fetches and unbounded DB growth. `/search` (public) caches arbitrary user-controlled query strings into Redis (`search.py:23`, key building in each client) — unbounded key cardinality.
- Files: `backend/app/api/titles.py:53-87`, `backend/app/api/search.py:21-62`
- Current mitigation: Input length/pattern validation on query params; upstream data is normalized before insert.
- Recommendations: Decide whether browse-before-login is a product requirement; if so, add per-IP limits on these routes, cap `external_id` to the expected formats (numeric for TMDB/RAWG/MAL/AniList, UUID for MangaDex).

**Local infra has default/no credentials:**
- Risk: Postgres uses hardcoded `trakplus:trakplus` (`docker-compose.yml:8-10`); Redis is published on host port 6379 with no password (`docker-compose.yml:25-26`). Fine for localhost, but these values must never propagate to staging/prod modules.
- Files: `docker-compose.yml:8-10,25-26`, `backend/app/core/config.py:21-22`, `.env.example:6`
- Current mitigation: Local-only scope; Terraform RDS/ElastiCache modules are empty placeholders.
- Recommendations: When filling `infra/modules/rds` and `infra/modules/elasticache`, source credentials from AWS Secrets Manager, never from tfvars.

**`.gitignore` env coverage gap (matters once git init happens):**
- Risk: Patterns cover `.env`, `.env.local`, `.env.*.local` but not `.env.<environment>` variants (e.g., `.env.production`, `.env.staging`) — exactly the names a multi-env setup is likely to create. Also un-ignored: `.coverage` (exists at repo root and `backend/`), `.planning/` if it should stay local. Verified today: no `.env` exists at root or in `backend/`.
- Files: `.gitignore:19-21`, stray `.coverage` at repo root and `backend/.coverage`
- Current mitigation: No real env files exist yet.
- Recommendations: Broaden to `.env.*` with `!.env.example` before the first commit; add `.coverage` and decide on `.planning/` handling.

**Solid foundations already present (for balance):**
- Password hashing via bcrypt (`security.py:17`), JWT decode pinned to a single algorithm with a `type` claim check (`security.py:57-63`), Google id_token verified with JWKS + iss/aud + `email_verified` (`security.py:66-80`, `auth.py:119-122`), all user-scoped queries filtered by token-derived `user.id` (`deps.py:25-42`, `library.py`, `progress.py`), CORS allow-list from settings (`main.py:31-37`). CORS uses `allow_credentials=True` with explicit origins — keep it that way; do not switch to `allow_origins=["*"]`.

## Performance Bottlenecks

**Sequential per-season TMDB fetches:** covered under Known Bugs (episode sync N+1). Worst-case first sync latency scales linearly with season count.

**Cache stampede on shared keys:**
- Problem: `CacheLayer.get_or_set_json` has no single-flight locking — concurrent misses for the same key each hit upstream. `/search` fans out to up to 5 sources per request, so a burst of identical queries can multiply against AniList's ~90 req/min and Jikan's ~3 req/sec informal limits (limits tracked in `docs/design.md:38-40`).
- Files: `backend/app/services/cache.py:24-51`, `backend/app/api/search.py:50`
- Cause: Plain get/set with no lock or request de-duplication; only Jikan has 429 backoff (`jikan.py:26-44`). TMDB/RAWG/AniList have none.
- Improvement path: Add per-key asyncio lock (in-process) or a short "fetching" marker in Redis; add backoff to AniList and RAWG.

**Unbounded Redis key cardinality from user queries:**
- Problem: Cache keys embed raw lowercased user queries (`tmdb.py:63`, `rawg.py:44`, `anilist.py` search key, `jikan.py:51`, `mangadex.py`), 1-200 chars each (`search.py:23`). Each unique string creates a 24h key — a bot hammering random queries fills Redis.
- Files: `backend/app/api/search.py:23`, client cache-key builders listed above
- Cause: No key-count or eviction budget; default Redis eviction policy.
- Improvement path: Cap distinct search keys (e.g., short TTL for search vs detail), or rate-limit `/search` per IP.

**N+1 title loads on library listing:**
- Problem: `LibraryEntry.title` uses `lazy="selectin"` (`library_entry.py:48-49`) — every `GET /library` runs a second query for all referenced titles. Correct (async sessions can't lazy-load) and fine at personal scale; becomes notable past hundreds of entries.
- Files: `backend/app/models/library_entry.py:48-49`, `backend/app/api/library.py:38-48`
- Improvement path: None needed now; revisit with pagination (which `list_library` also lacks).

**Progress summary materializes full watched-ID list:**
- Problem: `_summary` loads every `Progress.episode_id` into Python to count and return them (`progress.py:35-50`).
- Files: `backend/app/api/progress.py:34-50`
- Cause: The response schema includes `watched_episode_ids` — by design, but unbounded for large titles.
- Improvement path: Add `?include_ids=false` or a count-only mode when the frontend needs only counts.

## Fragile Areas

**`registry.py` singleton lifecycle:**
- Files: `backend/app/services/registry.py`, shutdown wiring at `backend/app/main.py:18-22`
- Why fragile: Adding a new external client requires synchronized edits in four places (import, `@lru_cache` getter, `_track` wrapper, `aclose_all` cache-clear list). Forgetting `_track` leaks an unclosed `httpx.AsyncClient` on shutdown; forgetting `cache_clear` resurrects stale clients after tests. `_instances` order vs `cache_clear` order is load-bearing.
- Safe modification: When adding a client, mirror the exact TMDB getter pattern (getter + `_track` + clear in `aclose_all`); add a test asserting `aclose_all()` empties `_instances`.
- Test coverage: Client behavior is tested (`backend/tests/test_tmdb.py`, `test_rawg.py`, `test_anilist.py`, `test_jikan.py`, `test_mangadex.py`, `test_cache.py`), but there is no test for the registry lifecycle itself.

**Cache-shape coupling (24h stale-schema hazard):**
- Files: all clients' `_cached` calls (`tmdb.py:64,81,101`, `rawg.py:45,54`, `anilist.py`, `jikan.py:52,61`, `mangadex.py`), `backend/app/services/cache.py`
- Why fragile: Clients cache normalized `model_dump()` payloads for 24h and re-validate with `SearchItem.model_validate`/`TitleDetail.model_validate` on read. Changing a Pydantic schema field name/type makes warm-cache entries fail validation at request time → 500s for up to 24h post-deploy. Cache keys have no schema-version component.
- Safe modification: Bump the cache-key prefix (e.g., `trakplus:v2:tmdb:...`) on any schema change, or flush Redis on deploy.
- Test coverage: `backend/tests/test_cache.py` covers cache mechanics, not versioned invalidation.

**Alembic migration `13f74a4c16e8` manual enum DROP:**
- Files: `backend/alembic/versions/13f74a4c16e8_initial_schema.py`, `backend/alembic/env.py`
- Why fragile: The downgrade contains a hand-written `DROP TYPE` that autogenerate omits (documented in `docs/progress.md:31`); forgetting it on future enum-touching migrations breaks the downgrade→upgrade cycle. All three migrations must stay a clean linear chain.
- Safe modification: When altering the `media_type`/`library_status`/`offer_type` enums, hand-write both `DROP TYPE` and `CREATE TYPE ... AS` steps.
- Test coverage: Round-trip verified manually once (`docs/progress.md:33`); no automated migration test.

**Redis-failure degradation paths:**
- Files: `backend/app/services/cache.py:32-34,47-50`, `backend/app/api/health.py:55-62`
- Why fragile: The "cache must never break a request" contract is enforced by broad exception handlers; correctness depends on them staying broad. Also, `_check_redis` builds a brand-new Redis client per readiness probe and closes it — diverging from the shared-pool design (`redis.py:7` docstring) and churning connections under frequent probes.
- Safe modification: Any change to `CacheLayer` must preserve the try/except-around-both-GET-and-SET shape; consider reusing the registry's `cache_layer()` client in health checks.
- Test coverage: `backend/tests/test_cache.py` covers Redis failure/fall-through — good; health-probe client churn untested.

**Windows-specific dev environment assumptions:**
- Files: `docker-compose.yml:12-13` (host port 5433 because native Postgres owns 5432), `backend/app/core/config.py:20-22` (default URL points at 5433)
- Why fragile: The committed default `database_url` encodes this machine's port conflict. A fresh clone on a machine where 5433 is free still works, but a machine with something on 5433 fails opaquely; conversely docs/AGENTS assume 5433 everywhere.
- Safe modification: Keep `.env` as the single source of truth for the URL; treat the code default as documentation.

## Scaling Limits

**Single-process, personal-scale design:**
- Current capacity: One uvicorn process, async Postgres pool (default pool size), one shared Redis pool. 105 tests,  81% coverage (`docs/progress.md`).
- Limit: In-memory counters (RAWG request counter, cache hits/misses) silently fragment across workers; no per-IP rate limiting means an internet-facing deployment has no backpressure. Library list and progress endpoints lack pagination.
- Scaling path: Multi-worker is fine for stateless request handling; move counters to Redis, add rate limiting (v2 backlog), add pagination before any real user base.

**External API free-tier budgets:**
- Current capacity: RAWG 20k req/mo, AniList ~90 req/min, Jikan ~3 req/sec informal (recorded in `docs/design.md:38-40`); 24h cache-aside is the primary mitigation.
- Limit: A cache-stampede burst (see Performance) can blow through AniList/Jikan limits in seconds; RAWG's 429 handling is absent (only Jikan backs off).
- Scaling path: Backoff on all clients + single-flight caching; monitor via the request counters once they are exported.

## Dependencies at Risk

**passlib 1.7.4:**
- Risk: Unmaintained since 2020; the project pins `bcrypt==4.0.1` (`backend/requirements.txt`) specifically because passlib breaks against bcrypt ≥ 4.1 (removed `__about__` attribute). This pin is invisible magic — upgrading bcrypt naively breaks password hashing.
- Impact: Password verification failures at runtime if someone bumps bcrypt; also blocks getting bcrypt security patches.
- Migration plan: Replace `passlib.context.CryptContext` with direct `bcrypt` calls (or switch to `argon2-cffi`) in `backend/app/core/security.py:17,25-30`; hashes are self-describing (`$2b$...`) so existing users migrate transparently.

**Jikan (unofficial MAL API):**
- Risk: No SLA, community-run; availability/permanent rate-limit changes break the MAL cross-reference path.
- Impact: `/search` degrades gracefully (per-source error isolation at `search.py:50-56`); `source=mal|jikan` detail fetches fail.
- Migration plan: Keep as fallback-only per `docs/design.md` §4; the AniList `idMal` field already provides MAL IDs without Jikan.

## Missing Critical Features

**Version control + CI:** No git repo, no GitHub Actions (`.github/workflows/.gitkeep` only). Blocks rollback, collaboration, and the Phase 5 passing criterion (`docs/todos.md:53`).

**TMDB/RAWG API keys:** Sources are auto-disabled (`registry.py:32-46`); movies and games are entirely absent from `/search`, and the API-key-leak bug (Known Bugs) stays masked. Registered manually per `docs/plan.md` Phase 0; `scripts/check_apis.py` exists to validate once keys arrive.

**Remote Terraform state:** `infra/backend.tf` remote block commented out; blocked on the S3+DynamoDB bootstrap (`infra/README.md`). Until then, state is local-only — losing the workstation loses infra state (moot until modules are filled).

**Auth hardening:** Rate limiting, token revocation, refresh rotation — all scoped in `docs/design.md:61` as v2 backlog; treat as mandatory before public deployment, optional for local demo.

**Frontend application:** Everything in Phase 3 (`docs/todos.md:78`): auth flow, search UI, detail pages, library dashboard, progress tracker. Currently zero product UI exists.

## Test Coverage Gaps

**Registry lifecycle:** No test asserts `aclose_all()` closes tracked clients and clears all caches (`backend/app/services/registry.py:64-76`). Risk: silent httpx connection leaks on shutdown after refactors. Priority: Medium.

**Upstream error translation in `titles.py`:** The 502 passthrough (including the API-key leak path) for `GET /titles/...` and the sync endpoint is untested with real HTTPStatusError objects; `backend/tests/test_titles_api.py` covers happy paths and disabled-source 503s. Priority: High (it guards a security-relevant fix).

**Concurrent-write behavior:** No tests exercise IntegrityError races on `add_entry`, `mark_watched`, or double `episodes/sync`. Priority: Medium (bugs are real but low-severity at current scale).

**Migration chain in CI:** Alembic downgrade→upgrade round-trip verified manually once (`docs/progress.md:33`); not automated. Priority: Medium — becomes high once CI exists.

**Live TMDB/RAWG clients:** Tests use respx mocks; no live smoke test has ever run for these two sources (no keys). Priority: Low until keys exist; then run `scripts/check_apis.py`.

**Frontend:** Zero tests; zero frontend code beyond scaffold. Expected for current phase.

---

*Concerns audit: 2026-08-31*
