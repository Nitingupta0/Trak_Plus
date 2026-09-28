# External Integrations

**Analysis Date:** 2026-08-31

## APIs & External Services

**Media Metadata Sources** (all wrapped in Redis cache-aside via `backend/app/services/cache.py`):

- TMDB — movies + TV (search, detail with credits + watch providers, per-season episodes)
  - Client: `backend/app/services/tmdb.py` (`TMDBClient`, extends `BaseClient` in `backend/app/services/base.py`)
  - Base URL: `https://api.themoviedb.org/3`; images: `https://image.tmdb.org/t/p/w500`
  - Auth: v3 key as `api_key` query param OR v4 read token as `Authorization: Bearer` (auto-detected by `eyJ` prefix, `backend/app/services/tmdb.py:44`)
  - Key: `TMDB_API_KEY` (`backend/app/core/config.py`) — **key-gated**: source is disabled (returns `None`) if unset (`backend/app/services/registry.py:32`)

- RAWG — games (search, detail)
  - Client: `backend/app/services/rawg.py`
  - Base URL: `https://api.rawg.io/api`
  - Auth: `key` query param
  - Key: `RAWG_API_KEY` — **key-gated** same as TMDB (`backend/app/services/registry.py:41`)

- AniList — anime (search, detail via GraphQL)
  - Client: `backend/app/services/anilist.py` (GraphQL queries inlined as constants; single round trip per operation, no N+1)
  - Base URL: `https://graphql.anilist.co` (POST `/` with `{query, variables}`)
  - Auth: none (public API)

- Jikan — anime/manga mirror of MyAnimeList
  - Client: `backend/app/services/jikan.py`
  - Base URL: `https://api.jikan.moe/v4`
  - Auth: none; **rate-limit aware** — retries with exponential backoff on 429 (`backend/app/services/jikan.py:35`)

- MangaDex — manga (search, detail, chapter feed)
  - Client: `backend/app/services/mangadex.py`
  - Base URL: `https://api.mangadex.org`; cover images: `https://uploads.mangadex.org/covers`
  - Auth: none

**Client Lifecycle Pattern:**
- Singletons via `lru_cache` getters + graceful `aclose_all()` on app shutdown (`backend/app/services/registry.py`, called from lifespan in `backend/app/main.py:21`)
- All HTTP through one `httpx.AsyncClient` per source with 10s timeout (`backend/app/services/tmdb.py:47`, base class in `backend/app/services/base.py`)
- Cache keys: `trakplus:<source>:<op>:<id/query>`; typical TTL 24h (`TTL_24H` constant in each client)
- **Graceful degradation:** Redis GET/SET failures fall back to live fetch; key-gated sources absent from `/search` results rather than erroring (`backend/app/services/cache.py:32`, `backend/app/services/registry.py:35`)

**Google Identity (Sign-In):**
- Google id_token verification (not a full OAuth code flow) — JWT checked against Google JWKS `https://www.googleapis.com/oauth2/v3/certs`, issuer `https://accounts.google.com` (`backend/app/core/security.py:19-20`, `verify_google_id_token`)
- Endpoint: `POST /api/auth/google` in `backend/app/api/auth.py:97`; links Google sub to existing password account if emails match
- Gated by `GOOGLE_CLIENT_ID` — endpoint returns 503-style error "google sign-in not configured" when empty (`backend/app/api/auth.py:102`)

## Data Storage

**Databases:**
- PostgreSQL 17
  - Connection: `DATABASE_URL` (asyncpg driver, e.g. `postgresql+asyncpg://...@postgres:5432/trakplus` in `docker-compose.yml`; default localhost:5433 in `backend/app/core/config.py`)
  - Client: SQLAlchemy 2.0 async engine + `async_sessionmaker` (`backend/app/core/db.py`), FastAPI dependency `get_db()` yields sessions
  - Migrations: Alembic (`backend/alembic/versions/`, URL injected from settings in `backend/alembic/env.py:17`)
  - Schema: users, titles, library entries, progress, episodes, watch providers (`backend/app/models/`)

**File Storage:**
- None — media images are hotlinked directly from provider CDNs (`https://image.tmdb.org/t/p/w500`, `https://uploads.mangadex.org/covers`, `backend/app/services/tmdb.py:20`, `backend/app/services/mangadex.py:20`)

**Caching:**
- Redis 7 (db 0) — cache-aside JSON cache only
  - Connection: `REDIS_URL` (`backend/app/core/redis.py`, `redis.from_url` with 2s socket timeouts, `decode_responses=True`)
  - Layer: `CacheLayer.get_or_set_json(key, ttl, factory)` in `backend/app/services/cache.py` — never fails a request on Redis outage
  - Test substitute: fakeredis (`backend/requirements-dev.txt`)

## Authentication & Identity

**Auth Provider:**
- Self-hosted JWT (HS256) + optional Google Sign-In
  - Implementation: `backend/app/core/security.py` — passlib/bcrypt password hashing, PyJWT access tokens (30 min) + refresh tokens (7 days) with `type` claim discrimination
  - Routes: `backend/app/api/auth.py` (`/api/auth/*`: register, login, refresh, google)
  - Settings: `JWT_SECRET_KEY`, `JWT_ALGORITHM` (HS256), `GOOGLE_CLIENT_ID` (`backend/app/core/config.py:27-31`)
  - Request auth: FastAPI dependency in `backend/app/api/deps.py`

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry or equivalent)

**Logs:**
- Python stdlib `logging` per module (`logger = logging.getLogger(__name__)` pattern in `backend/app/services/*`, e.g. `backend/app/services/cache.py:15`); no structured logging or aggregation configured

## CI/CD & Deployment

**Hosting:**
- Local: Docker Compose (`docker-compose.yml`)
- Production (planned, Phase 6): AWS — Terraform modules for EKS (`infra/modules/eks/`), RDS (`infra/modules/rds/`), ElastiCache (`infra/modules/elasticache/`), ECR (`infra/modules/ecr/`), network (`infra/modules/network/`), IAM (`infra/modules/iam/`); env wiring in `infra/environments/{staging,prod}/`
- Remote state: S3 + DynamoDB lock — backend block commented out until bootstrap (`infra/backend.tf:12`, procedure in `infra/README.md`)

**CI Pipeline:**
- None active — `.github/workflows/` contains only `.gitkeep`

## Environment Configuration

**Required env vars** (names from `.env.example` and `backend/app/core/config.py`; values never committed):
- `ENVIRONMENT`, `DEBUG` — runtime mode flags
- `DATABASE_URL` — Postgres asyncpg URL
- `REDIS_URL` — Redis connection
- `JWT_SECRET_KEY` — HS256 signing key (must be ≥32 bytes; dev default is flagged insecure in `backend/app/core/config.py:26-27`)
- `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS` — token lifetimes
- `GOOGLE_CLIENT_ID` — enables Google Sign-In when set
- `TMDB_API_KEY`, `RAWG_API_KEY` — enables those sources when set
- `CORS_ORIGINS` — JSON array string, e.g. `'["http://localhost:3000"]'`
- `NEXT_PUBLIC_API_URL` — frontend→backend base URL (baked into browser bundle)

**Secrets location:**
- Local: `.env` at repo root (gitignored; template at `.env.example`) — file is not currently present in the working tree, only the example
- Compose: passthrough interpolation `${TMDB_API_KEY:-}` in `docker-compose.yml:41-42`
- Production: not yet defined (Terraform envs have no secret wiring; will be needed with EKS/ECS deployment in Phase 6)

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None (backend only consumes external APIs; no outbound notification/webhook calls)

## Frontend ↔ Backend Contract

- REST API consumed via `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`, `docker-compose.yml:62`)
- CORS restricted to `CORS_ORIGINS` list (`backend/app/main.py:31-37`, `allow_credentials=True`)
- Health endpoint for compose healthcheck: `GET /health` (`backend/app/api/health.py`, curl in `docker-compose.yml:52`)
- Frontend is currently create-next-app boilerplate (`frontend/src/app/page.tsx`) — no API client layer written yet; first real integration code will need a fetch wrapper honoring `NEXT_PUBLIC_API_URL`

---

*Integration audit: 2026-08-31*
