<!-- refreshed: 2026-08-31 -->
# Architecture

**Analysis Date:** 2026-08-31

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────┐
│                       Frontend (Next.js 16)                          │
│             `frontend/src/app/` (App Router, src/ dir)               │
│        layout.tsx / page.tsx — scaffold only, talks to API           │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ HTTP (NEXT_PUBLIC_API_URL)
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     API Layer (FastAPI, async)                       │
│  `backend/app/api/` — health, auth, search, titles, library, progress│
│         `backend/app/api/deps.py` — get_current_user guard           │
└──────────┬──────────────────────┬─────────────────────────┬──────────┘
           │ Depends(get_db)      │ registry.get_*()        │ Depends
           ▼                      ▼                         ▼
┌──────────────────────┐ ┌───────────────────────┐ ┌──────────────────────┐
│  Persistence         │ │  Service Layer        │ │  Core                │
│  `backend/app/models/`│ │  `backend/app/services/`│ │  `backend/app/core/` │
│  SQLAlchemy 2 async  │ │  TMDB/RAWG/AniList/   │ │  config, db, redis,  │
│  via `core/db.py`    │ │  Jikan/MangaDex       │ │  security (JWT/bcrypt)│
└──────────┬───────────┘ │  + cache-aside,       │ └──────────┬───────────┘
           │             │  title_store, ep_sync │            │
           ▼             └──────────┬────────────┘            │
┌──────────────────────┐            │ httpx.AsyncClient       ▼
│  PostgreSQL 17       │            ▼              ┌──────────────────────┐
│  (asyncpg, Alembic)  │ ┌───────────────────────┐ │  Redis 7             │
│  `backend/alembic/`  │ │  External APIs        │ │  `services/cache.py` │
└──────────────────────┘ │  TMDB/RAWG/AniList/   │ │  JSON cache-aside,   │
                         │  Jikan/MangaDex       │ │  degrades on outage  │
                         └───────────────────────┘ └──────────────────────┘

Deployment: docker-compose.yml (local) → `deploy/` Lightsail single-box (live, ~$12/mo,
Caddy TLS) → Terraform `infra/` (EKS/RDS/ElastiCache portfolio path, applied on demand;
`infra/modules/{network,eks,rds,elasticache,ecr,iam}`)
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| App factory | Wires CORS + all routers; lifespan shutdown closes clients and engine | `backend/app/main.py` |
| Auth routes | register / OAuth2 password login / refresh / me / Google sign-in | `backend/app/api/auth.py` |
| Search route | Cross-source fan-out with `asyncio.gather`, merges normalized results | `backend/app/api/search.py` |
| Titles routes | Detail fetch by `{source}/{external_id}`, provider country filter, upsert, episode sync | `backend/app/api/titles.py` |
| Library routes | CRUD for library entries, ownership-scoped queries | `backend/app/api/library.py` |
| Progress routes | Idempotent mark/unmark of watched episodes, per-entry summary | `backend/app/api/progress.py` |
| Health routes | `/health` liveness (always 200), `/health/ready` checks Postgres + Redis | `backend/app/api/health.py` |
| Shared deps | `get_current_user` (JWT → DB user), OAuth2 bearer scheme | `backend/app/api/deps.py` |
| Config | pydantic-settings, env/.env loading, `lru_cache` singleton | `backend/app/core/config.py` |
| DB session | Async engine + `async_sessionmaker` + `get_db` dependency | `backend/app/core/db.py` |
| Redis client | Client factory from settings (2s socket timeouts) | `backend/app/core/redis.py` |
| Security | bcrypt hash/verify, HS256 JWT issue/decode with `type` claim, Google JWKS verify | `backend/app/core/security.py` |
| Client base | httpx wrapper, `_get_json`/`_post_json`, `_cached()` hook, `aclose()` | `backend/app/services/base.py` |
| Cache layer | Redis get-or-set JSON with TTL; failures degrade to live fetch, never raise | `backend/app/services/cache.py` |
| Client registry | `lru_cache` singletons per source; key-gated sources return `None`; `aclose_all()` on shutdown | `backend/app/services/registry.py` |
| Title store | Upsert normalized `TitleDetail` into `titles` table with external-id cross-referencing | `backend/app/services/title_store.py` |
| Episode sync | Populate `episodes` from TMDB seasons / AniList stubs / MangaDex chapters; idempotent | `backend/app/services/episode_sync.py` |
| External clients | One per source: tmdb, rawg, anilist (GraphQL), jikan (with 429 backoff), mangadex | `backend/app/services/tmdb.py` etc. |
| Models | SQLAlchemy 2.0 declarative: User, Title, Episode, LibraryEntry, Progress, WatchProvider | `backend/app/models/` |
| Schemas | Pydantic normalized shapes shared by all clients: SearchItem, TitleDetail, CastMember, ProviderOffer | `backend/app/schemas/title.py` |
| Migrations | Alembic with async engine, metadata from `app.models.Base` | `backend/alembic/env.py` |

## Pattern Overview

**Overall:** Modular layered monolith (FastAPI) with a service-adapter sub-layer for external APIs. Backend is the single source of truth; the Next.js frontend is a thin consumer (currently a scaffold). Redis sits in front of every external call as a cache-aside buffer.

**Key Characteristics:**
- **Async everywhere** — async SQLAlchemy 2 (`asyncpg`), `httpx.AsyncClient`, `asyncio.gather` for parallel source fan-out (`backend/app/api/search.py:50`)
- **One client per external source** — each in its own module extending `BaseClient` (`backend/app/services/base.py`), normalized to shared Pydantic schemas (`backend/app/schemas/title.py`)
- **Cache-aside with graceful degradation** — `CacheLayer.get_or_set_json` never lets a Redis failure break a request (`backend/app/services/cache.py:24-51`)
- **Key-gated sources** — TMDB/RAWG clients are `None` when their API key env var is unset; search simply skips them (`backend/app/services/registry.py:32-46`)
- **Token-derived data isolation** — user identity is always resolved from the JWT in `get_current_user`, never from client input; every library/progress query filters on `user_id` (`backend/app/api/deps.py:25-42`, `backend/app/api/library.py:17-29`)

## Layers

**API Layer (routers):**
- Purpose: HTTP endpoints, request validation, status-code mapping; no business logic beyond orchestration
- Location: `backend/app/api/` — `health.py`, `auth.py`, `search.py`, `titles.py`, `library.py`, `progress.py`, shared `deps.py`
- Contains: FastAPI `APIRouter`s, `Depends()` wiring, `HTTPException` mapping
- Depends on: `core/db.py` (`get_db`), `core/security.py`, `services/registry.py`, `services/title_store.py`, `services/episode_sync.py`, `schemas/`
- Used by: `backend/app/main.py` (`app.include_router(...)`)

**Service Layer (external integrations):**
- Purpose: talk to external APIs, normalize payloads, cache responses
- Location: `backend/app/services/` — `base.py`, `cache.py`, `registry.py`, `tmdb.py`, `rawg.py`, `anilist.py`, `jikan.py`, `mangadex.py`, `title_store.py`, `episode_sync.py`
- Contains: `BaseClient` subclasses, `CacheLayer`, singleton registry, persistence helpers
- Depends on: `core/redis.py`, `core/config.py`, `schemas/title.py`, `models/`
- Used by: API layer and each other (`episode_sync.py` uses registry clients)

**Model Layer (persistence):**
- Purpose: SQLAlchemy 2.0 `DeclarativeBase` tables; all app data
- Location: `backend/app/models/` — `base.py`, `enums.py`, `user.py`, `title.py`, `episode.py`, `library_entry.py`, `progress.py`, `watch_provider.py`
- Depends on: nothing app-level except `models/enums.py` and `models/base.py` (relationships use string refs + `TYPE_CHECKING` to avoid circular imports, e.g. `backend/app/models/library_entry.py:20-22`)
- Used by: services, API layer, Alembic (`backend/alembic/env.py:19`)

**Schema Layer (contracts):**
- Purpose: Pydantic request/response models; the source-agnostic normalization contract
- Location: `backend/app/schemas/` — `title.py` (SearchItem/TitleDetail/CastMember/ProviderOffer), `auth.py` (UserCreate/Token/etc.), `library.py` (LibraryEntryCreate/Read/Update, ProgressSummary)
- Used by: API layer (response models), services (client outputs), `app/schemas/__init__.py` re-exports title schemas via `__all__`

**Core (cross-cutting):**
- Purpose: settings, DB/Redis plumbing, security primitives
- Location: `backend/app/core/` — `config.py`, `db.py`, `redis.py`, `security.py`
- Depends on: environment variables / `.env` only

## Data Flow

### Primary Request Path — Cross-source search (`GET /search`)

1. Client hits `/search?q=...&type=...` — validation via `Query` constraints (`backend/app/api/search.py:21-26`)
2. Router asks `registry` for enabled clients (`registry.get_tmdb()`, `get_rawg()`, `get_anilist()`, `get_mangadex()`) (`backend/app/api/search.py:30-48`)
3. Each client checks Redis first via `BaseClient._cached` → `CacheLayer.get_or_set_json` (`backend/app/services/base.py:39-42`, `backend/app/services/cache.py:24`)
4. On miss, `httpx.AsyncClient` fetches upstream; result normalized to `SearchItem` and cached 24h (e.g. `backend/app/services/tmdb.py:53-65`)
5. `asyncio.gather(*tasks, return_exceptions=True)` collects all; failed sources are logged and skipped, not fatal (`backend/app/api/search.py:50-56`)
6. Merged `SearchItem` list returned as JSON (`backend/app/api/search.py:58-62`)

### Title detail + persistence flow (`GET /titles/{source}/{external_id}`)

1. `fetch_detail()` dispatches on `ExternalSource` enum to the right registry client (`backend/app/api/titles.py:19-50`); TMDB additionally requires `?media_type=movie|tv`
2. `httpx.HTTPError` from upstream maps to 502 (`backend/app/api/titles.py:68-69`)
3. Watch providers filtered by `?country=` (default `"IN"`) (`backend/app/api/titles.py:70`)
4. `upsert_title()` finds-or-creates the `titles` row by the source-specific indexed column (`tmdb_id`, `rawg_id`, …), fills known external-id columns from `detail.external_ids`, writes full payload to `raw_metadata` JSONB, commits (`backend/app/services/title_store.py:28-63`)
5. Internal UUID `title.id` becomes the stable key the rest of the app (library, progress) references

### Episode sync flow (`POST /titles/{source}/{external_id}/episodes/sync`)

1. Same `fetch_detail` + `upsert_title` path (`backend/app/api/titles.py:75-87`)
2. `sync_episodes()` branches per media type: TMDB TV → per-season fetches; anime → flat stub rows 1..episode_count; manga → MangaDex chapter feed (`backend/app/services/episode_sync.py:64-77`)
3. Idempotent insert: existing `(title_id, season, number)` pairs are skipped, honoring unique constraint `uq_episode_number` (`backend/app/services/episode_sync.py:79-101`, `backend/app/models/episode.py:19`)

### Library / progress flow (authenticated)

1. `Depends(get_current_user)` decodes the access JWT, loads the `User` row (`backend/app/api/deps.py:25-42`)
2. Entry access goes through `_get_owned_entry()` which filters `LibraryEntry.id == entry_id AND user_id == user.id` — 404 otherwise (`backend/app/api/library.py:17-29`)
3. Progress mark is idempotent (existing check before insert; `uq_entry_episode` unique constraint backs it) and returns a recomputed `ProgressSummary` (`backend/app/api/progress.py:53-72`)
4. After commits, entries are re-selected (`_refetch_entry`) so the eager-loaded `title` relationship is fresh (`backend/app/api/library.py:32-35`)

### Auth flow (self-hosted JWT + Google OAuth)

1. `POST /auth/register` — bcrypt hash, unique email check (`backend/app/api/auth.py:39-52`)
2. `POST /auth/login` — OAuth2 password form; issues access (30 min) + refresh (7 days) HS256 JWTs with a `type` claim (`backend/app/api/auth.py:55-71`, `backend/app/core/security.py:33-63`)
3. `POST /auth/refresh` — validates `type: refresh`, re-issues pair (`backend/app/api/auth.py:74-89`)
4. `POST /auth/google` — verifies Google `id_token` RS256 via JWKS (run in threadpool), requires `email_verified`, upserts/links user by `auth_provider_id`, issues own JWTs (`backend/app/api/auth.py:97-140`, `backend/app/core/security.py:66-80`)

**State Management:**
- No server-side session state; JWTs are stateless (no revocation yet — documented backlog in `docs/design.md` §5b)
- Frontend is currently a scaffold (`frontend/src/app/page.tsx`); no client state library wired yet (React Query planned per `docs/design.md` §5)

## Key Abstractions

**`BaseClient` (external API adapter):**
- Purpose: shared plumbing for every external source — one `httpx.AsyncClient` per client, JSON helpers, cache-aside hook
- Examples: `backend/app/services/tmdb.py:33`, `backend/app/services/rawg.py`, `backend/app/services/anilist.py:54`, `backend/app/services/jikan.py`, `backend/app/services/mangadex.py`
- Pattern: Template method — subclasses implement `search()`/`detail()` and wrap fetchers in `self._cached(key, ttl, fetch)`; `cache=None` bypasses caching (used in tests)

**`CacheLayer` (cache-aside decorator over Redis):**
- Purpose: single place where Redis get/set happens; outages degrade to live fetch
- Examples: `backend/app/services/cache.py:18-51`, instantiated per-client via `registry.cache_layer()`
- Pattern: get-or-set with TTL (24h for search/detail, 1h for MangaDex chapters), JSON serialization, hit/miss counters, `# noqa: BLE001` swallow-and-log

**`registry` (client lifecycle manager):**
- Purpose: construct/cache client singletons, gate on API keys, close everything on shutdown
- Examples: `backend/app/services/registry.py:26-76`
- Pattern: `lru_cache` factories + module-level `_instances` list + `aclose_all()` called from the FastAPI lifespan (`backend/app/main.py:18-22`)

**`get_current_user` (auth dependency):**
- Purpose: single gate protecting all user-scoped routes; resolves identity from token only
- Examples: `backend/app/api/deps.py:25-42`, used in `backend/app/api/auth.py:93`, `backend/app/api/library.py`, `backend/app/api/progress.py`

**Normalized schemas (source-agnostic contract):**
- Purpose: clients convert raw payloads into `SearchItem`/`TitleDetail` so nothing downstream knows the upstream API
- Examples: `backend/app/schemas/title.py:27-53`

## Entry Points

**HTTP server:**
- Location: `backend/app/main.py` (`app: FastAPI = create_app()` at line 47)
- Triggers: `uvicorn app.main:app` (Docker CMD, `backend/Dockerfile:31`)
- Responsibilities: CORS middleware from `settings.cors_origins`, router registration, lifespan shutdown (`registry.aclose_all()` + `engine.dispose()`)

**Database migrations:**
- Location: `backend/alembic/env.py` (async engine; `run_migrations_online` uses `asyncio.run`)
- Triggers: `alembic upgrade head` (see `backend/alembic.ini`; URL injected from `get_settings().database_url`)
- Migrations live in `backend/alembic/versions/` (3 revisions: initial schema, hashed passwords, widened external-id columns)

**Frontend:**
- Location: `frontend/src/app/layout.tsx` (root layout, Geist fonts, Tailwind classes) and `frontend/src/app/page.tsx` (create-next-app placeholder)
- Triggers: `next dev` / `next start` / `node server.js` (standalone output from `frontend/next.config.ts`)

**Orchestration (local dev):**
- Location: `docker-compose.yml` — postgres (host port **5433**), redis, backend (8000), frontend (3000); backend env vars override settings (`DATABASE_URL`, `REDIS_URL`, `TMDB_API_KEY`, `RAWG_API_KEY`, `CORS_ORIGINS`)

**Utility script:**
- Location: `scripts/check_apis.py` — manual verification that external API keys work

## Architectural Constraints

- **Threading:** Single asyncio event loop; no worker threads except `run_in_threadpool` for blocking JWKS fetch in `backend/app/api/auth.py:108`. No Celery/queue workers yet (background jobs planned per `docs/design.md` §2).
- **Global state:** Module-level singletons — `engine`/`AsyncSessionLocal` (`backend/app/core/db.py:9-11`), `Settings` cached via `@lru_cache` (`backend/app/core/config.py:41-43`), registry client cache (`backend/app/services/registry.py:26-61`), `_jwks_client` (`backend/app/core/security.py:22`), `_pwd_context` (`backend/app/core/security.py:17`). Tests replace these via dependency overrides/fixtures (`backend/tests/conftest.py`).
- **Async-session loading:** Implicit lazy loading is forbidden in async sessions. Relationships must be eager-loaded — `LibraryEntry.title` uses `lazy="selectin"` (`backend/app/models/library_entry.py:48-49`). New relationships must follow this.
- **Circular imports:** Avoided via string-based relationships + `TYPE_CHECKING` guards (`backend/app/models/library_entry.py:20-22`); `models/__init__.py` is the single import surface.
- **Schema ownership:** Postgres native enums (`media_type`, `library_status`, `offer_type`) are created by SQLAlchemy `Enum(..., native_enum=True)` — enum value changes require a migration.
- **Config precedence:** environment variables override `.env` (pydantic-settings, `backend/app/core/config.py:9-13`); compose injects service hostnames, local dev defaults to `localhost:5433` Postgres.
- **Never hardcode secrets:** all keys via env (`TMDB_API_KEY`, `RAWG_API_KEY`, `JWT_SECRET_KEY`, `GOOGLE_CLIENT_ID`); `.env.example` documents them; `.env` exists in the environment (existence noted only).

## Anti-Patterns

### Trusting client-provided identity

**What happens:** Taking `user_id` from a request body/query.
**Why it's wrong:** Breaks data isolation — any user could read/mutate another's library.
**Do this instead:** Always resolve the user from the JWT via `Depends(get_current_user)` and filter queries on `user.id`, as done in `backend/app/api/library.py:17-29` and `backend/app/api/progress.py:60`.

### Letting cache failures break requests

**What happens:** Treating Redis as a hard dependency (raise on Redis error).
**Why it's wrong:** Redis outage would take down search/titles.
**Do this instead:** Follow `CacheLayer.get_or_set_json` — catch, log, fetch live (`backend/app/services/cache.py:30-34`).

### Calling external APIs outside the client/registry abstraction

**What happens:** Importing `httpx` in a router and fetching TMDB directly.
**Why it's wrong:** Loses caching, normalization, key-gating, and shutdown lifecycle.
**Do this instead:** Add a `BaseClient` subclass in `backend/app/services/`, register it in `backend/app/services/registry.py`, consume via `registry.get_*()`.

### Implicit lazy-loading in async sessions

**What happens:** Accessing `entry.title` on a model with default `lazy="select"`.
**Why it's wrong:** Raises `MissingGreenlet` in async SQLAlchemy.
**Do this instead:** Declare relationships with `lazy="selectin"` (see `backend/app/models/library_entry.py:48-49`) or explicitly `select(...).options(selectinload(...))`.

### Unbounded upstream fan-out

**What happens:** Fetching related data in N+1 round trips to external APIs.
**Why it's wrong:** Free-tier rate limits (RAWG 20k/mo, Jikan ~3 req/s) and latency.
**Do this instead:** Batch upstream calls — TMDB uses `append_to_response=credits,watch/providers` (`backend/app/services/tmdb.py:72-77`), AniList batches GraphQL fields (`backend/app/services/anilist.py:16-51`) — and cache with TTL.

## Error Handling

**Strategy:** Convert low-level failures into HTTP semantics at the router boundary; let caches and optional sources degrade silently.

**Patterns:**
- Invalid/malformed tokens → single shared 401 `HTTPException` with `WWW-Authenticate: Bearer` (`backend/app/api/deps.py:18-22`)
- Upstream `httpx.HTTPError` → 502 (`backend/app/api/titles.py:68-69`)
- Key-gated source missing → 503 ("source disabled (no API key)") (`backend/app/api/titles.py:31-38`)
- Failed individual search source → logged warning, results from other sources still returned (`backend/app/api/search.py:53-55`)
- Google verification errors (including unexpected ones) → 401, never 500 (`backend/app/api/auth.py:107-117`)
- Dependency health failures → 503 from `/health/ready` with component detail (`backend/app/api/health.py:29-43`)
- Logging via stdlib `logging.getLogger(__name__)` per module; no structured logging yet

## Cross-Cutting Concerns

**Logging:** stdlib `logging` per module (`logger = logging.getLogger(__name__)` in services/routers); cache HIT/MISS, upstream failures, upserts, and episode syncs are logged. No log aggregation configured.
**Validation:** Pydantic v2 everywhere — request bodies (`backend/app/schemas/auth.py`, `backend/app/schemas/library.py`), normalized external payloads (`backend/app/schemas/title.py`), and inline `Query` constraints (e.g. `backend/app/api/search.py:23-24`). DB-level constraints back critical invariants (`uq_user_title`, `ck_rating_range`, `uq_episode_number`, `uq_entry_episode`).
**Authentication:** Self-hosted HS256 JWT + Google OAuth, implemented in `backend/app/core/security.py`; enforcement via `backend/app/api/deps.py`. Rate limiting and token revocation are documented backlog (`docs/design.md` §5b).
**CORS:** From `settings.cors_origins` (default `["http://localhost:3000"]`), injected in `backend/app/main.py:31-37`.

---

*Architecture analysis: 2026-08-31*
