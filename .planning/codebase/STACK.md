# Technology Stack

**Analysis Date:** 2026-08-31

## Languages

**Primary:**
- Python 3.11 — entire backend (`backend/app/`; pinned via `requires-python = ">=3.11"` in `backend/pyproject.toml`, runtime image `python:3.11-slim` in `backend/Dockerfile`)
- TypeScript 5 — frontend (`frontend/package.json`: `"typescript": "^5"`; all code under `frontend/src/`)

**Secondary:**
- HCL (Terraform) — AWS infrastructure as code (`infra/`)
- YAML — Docker Compose orchestration (`docker-compose.yml`), GitHub Actions (`.github/workflows/ci.yml`, 13 jobs)

## Runtime

**Environment:**
- Backend: Python 3.11 (uvicorn ASGI server, `backend/Dockerfile` CMD: `uvicorn app.main:app --host 0.0.0.0 --port 8000`)
- Frontend: Node.js 24 (Docker image `node:24-alpine` in `frontend/Dockerfile`; note `@types/node` is `^20` in `frontend/package.json`)
- Databases (local dev): Postgres 17 (`postgres:17-alpine`) and Redis 7 (`redis:7-alpine`) via `docker-compose.yml`

**Package Manager:**
- Backend: pip with venv — `requirements.in` (top-level ranges) compiled to fully pinned `backend/requirements.txt`; installed into `/opt/venv` at Docker build time (`backend/Dockerfile`)
- Frontend: npm — lockfile present (`frontend/package-lock.json`), `npm ci` in `frontend/Dockerfile`

## Frameworks

**Core:**
- FastAPI 0.141.1 (Starlette 1.6.0) — REST API, app factory in `backend/app/main.py` (`create_app()` with lifespan that closes HTTP clients and disposes the DB engine)
- Next.js 16.3.3 (App Router, `src/` dir) — frontend scaffold in `frontend/src/app/`; `output: "standalone"` set in `frontend/next.config.ts` for minimal Docker images
- React 19.2.8 + react-dom 19.2.8 — `frontend/package.json`
- SQLAlchemy 2.0.52 (async) — ORM + async engine, `backend/app/core/db.py` (`create_async_engine` with `pool_pre_ping=True`)
- Tailwind CSS 4 — styling via `@tailwindcss/postcss` (`frontend/package.json`), global styles in `frontend/src/app/globals.css`

**Testing:**
- pytest 9.1.1 + pytest-asyncio 1.4.0 (`asyncio_mode = "auto"` in `backend/pyproject.toml`)
- respx 0.23.1 — httpx mocking for external API clients
- fakeredis 2.37.1 — Redis stub for cache-layer tests
- pytest-cov 7.1.0, pytest-mock 3.15.1 (dev deps in `backend/requirements-dev.txt`)

**Build/Dev:**
- uvicorn 0.52.4 `[standard]` (watchfiles, websockets, httptools) — backend dev/prod server
- ruff 0.16.5 — lint + format (`backend/pyproject.toml`: line-length 100, target py311, rules `E,F,I,B,UP`, B008 ignored for FastAPI idiom)
- ESLint 9 + eslint-config-next 16.3.3 — `npm run lint` (`frontend/package.json`)
- Alembic 1.19.1 — DB migrations (`backend/alembic.ini`, migration scripts in `backend/alembic/versions/`)

## Key Dependencies

**Critical:**
- FastAPI 0.141.1 — API framework; every route in `backend/app/api/`
- SQLAlchemy 2.0.52 + asyncpg 0.31.0 — async Postgres access; models in `backend/app/models/`, session via `backend/app/core/db.py`
- redis 8.1.0 (async client) — cache-aside layer `backend/app/services/cache.py`; client factory `backend/app/core/redis.py`
- httpx 0.28.1 — all external API calls (`backend/app/services/base.py` BaseClient)
- Pydantic 2.13.5 + pydantic-settings 2.15.0 — schemas in `backend/app/schemas/`, typed settings in `backend/app/core/config.py` (`.env` file loading, `extra="ignore"`)
- Next.js 16.3.3 — frontend framework; **breaking changes vs older Next knowledge** (see `frontend/AGENTS.md` and bundled docs at `node_modules/next/dist/docs/`)

**Infrastructure:**
- alembic 1.19.1 — schema migrations (`backend/alembic/versions/`: `13f74a4c16e8_initial_schema.py`, `4979a28def16_users_hashed_password.py`, `bec220365eb9_widen_external_id_columns.py`)
- PyJWT 2.13.0 — HS256 access/refresh token issue/verify (`backend/app/core/security.py`)
- passlib 1.7.4 + bcrypt 4.0.1 (pinned `<4.1` in `backend/requirements.in`) — password hashing (`backend/app/core/security.py`)
- python-multipart 0.0.32, email-validator 2.3.0 — form/OAuth body parsing and email validation for auth endpoints (`backend/app/api/auth.py`)

## Configuration

**Environment:**
- Backend: pydantic-settings reads `.env` at repo root (`env_file=".env"` in `backend/app/core/config.py`); a template exists at `.env.example` (keys only — see INTEGRATIONS.md for the var list; never commit real values)
- Frontend: `NEXT_PUBLIC_API_URL` (backend base URL, set in `docker-compose.yml`); `NEXT_TELEMETRY_DISABLED=1` in `frontend/Dockerfile`
- Compose injects backend env from host `.env` via `${TMDB_API_KEY:-}` / `${RAWG_API_KEY:-}` passthrough (`docker-compose.yml`)

**Build:**
- `backend/pyproject.toml` — pytest, ruff, project metadata (no build backend; app is not a package)
- `backend/alembic.ini` — migration config; `sqlalchemy.url` placeholder overridden at runtime from settings in `backend/alembic/env.py` (`config.set_main_option("sqlalchemy.url", get_settings().database_url)`)
- `frontend/next.config.ts` — `output: "standalone"`
- Root `docker-compose.yml` — 4 services (postgres, redis, backend, frontend) with healthchecks and dependency conditions

## Platform Requirements

**Development:**
- Docker Compose for Postgres (host port **5433** — dev machine reserves 5432 for a native Postgres) and Redis (6379); backend runs on 8000, frontend on 3000
- Backend venv: `backend/.venv` (verify commands in root `AGENTS.md`: `.venv\Scripts\python -m pytest`, `ruff check .`)

**Production:**
- Docker images: `backend/Dockerfile` (python:3.11-slim, non-root `appuser`, multi-stage venv build) and `frontend/Dockerfile` (node:24-alpine, non-root `nextjs`, standalone `server.js` output)
- Deployment target: AWS (EKS + RDS + ElastiCache + ECR) via Terraform modules in `infra/modules/{network,eks,rds,elasticache,ecr,iam}/`; region `ap-south-1` (`infra/variables.tf`); Terraform >= 1.6, AWS provider >= 5.0 (`infra/backend.tf`); S3 remote state + DynamoDB lock defined but **commented out pending bootstrap** (`infra/backend.tf`, `infra/README.md`)

---

*Stack analysis: 2026-08-31*
