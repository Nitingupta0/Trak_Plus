# Codebase Structure

**Analysis Date:** 2026-08-31

## Directory Layout

```text
trakPlus/
├── AGENTS.md                  # AI agent guidance (project ground rules)
├── README.md
├── .env.example               # Env var template (real .env present — never read)
├── .gitignore
├── .coverage                  # Backend coverage output artifact
├── docker-compose.yml         # Local stack: postgres, redis, backend, frontend
├── backend/                   # FastAPI service (Python 3.11, async)
│   ├── Dockerfile             # 2-stage python:3.11-slim, non-root, uvicorn CMD
│   ├── pyproject.toml         # pytest + ruff config (line 100, py311)
│   ├── requirements.in        # Top-level dep ranges
│   ├── requirements.txt       # Locked deps
│   ├── requirements-dev.txt   # Dev deps (pytest, ruff, etc.)
│   ├── alembic.ini            # Alembic config
│   ├── alembic/
│   │   ├── env.py             # Async migrations, URL from get_settings()
│   │   └── versions/          # 3 migration revisions
│   ├── app/
│   │   ├── main.py            # create_app() factory — entry point
│   │   ├── api/               # Routers: health, auth, search, titles, library, progress + deps.py
│   │   ├── core/              # config.py, db.py, redis.py, security.py
│   │   ├── models/            # SQLAlchemy 2 tables + enums.py + base.py
│   │   ├── schemas/           # Pydantic: title.py, auth.py, library.py
│   │   └── services/          # External clients + cache.py + registry.py + title_store.py + episode_sync.py
│   └── tests/                 # pytest suite (conftest.py + test_<module>.py)
├── frontend/                  # Next.js 16.3.3 (App Router, src/ dir)
│   ├── Dockerfile             # 3-stage node:24-alpine, standalone output
│   ├── package.json           # next 16.3.3, react 19.2.8, tailwind v4
│   ├── next.config.ts         # output: "standalone"
│   ├── eslint.config.mjs      # eslint 9 flat config
│   ├── postcss.config.mjs     # @tailwindcss/postcss
│   ├── tsconfig.json
│   ├── AGENTS.md / CLAUDE.md  # Next 16 breaking-changes warning for agents
│   ├── public/                # Static SVG assets
│   └── src/
│       └── app/               # layout.tsx, page.tsx, globals.css, favicon.ico (scaffold)
├── infra/                     # Terraform (AWS: EKS/RDS/ElastiCache/ECR/IAM/VPC — portfolio path)
│   ├── main.tf                # AWS provider + default tags
│   ├── backend.tf             # Remote state config
│   ├── variables.tf
│   ├── modules/               # network/, eks/, rds/, elasticache/, ecr/, iam/
│   └── environments/          # staging/, prod/ (backend.hcl + main.tf + tfvars each)
├── deploy/                    # Lightsail single-box live deploy: Caddyfile, compose override,
│   │                          #   provision/deploy/backup/teardown scripts, .env.lightsail.example
├── scripts/
│   └── check_apis.py          # Manual external API key verification
├── docs/                      # design.md, plan.md, prod.md, todos.md, progress.md, budget.md, report.md
├── .github/workflows/         # ci.yml — single consolidated CI workflow (13 jobs)
└── .planning/codebase/        # These documents
```

## Directory Purposes

**`backend/app/api/`:**
- Purpose: HTTP layer — FastAPI routers per domain plus shared dependencies
- Contains: `auth.py`, `search.py`, `titles.py`, `library.py`, `progress.py`, `health.py`, `deps.py` (auth dependency)
- Key files: `backend/app/api/deps.py` (get_current_user), `backend/app/api/search.py` (fan-out pattern)

**`backend/app/services/`:**
- Purpose: external API adapters, Redis caching, persistence helpers — the business-logic layer
- Contains: `base.py` (BaseClient), `cache.py` (CacheLayer), `registry.py` (singletons/lifecycle), `tmdb.py`, `rawg.py`, `anilist.py`, `jikan.py`, `mangadex.py`, `title_store.py`, `episode_sync.py`
- Key files: `backend/app/services/registry.py` (add new sources here), `backend/app/services/title_store.py` (SOURCE_ATTR mapping)

**`backend/app/models/`:**
- Purpose: SQLAlchemy 2.0 declarative tables and app-wide enums
- Contains: `base.py` (DeclarativeBase), `enums.py` (MediaType, LibraryStatus, OfferType, ExternalSource), `user.py`, `title.py`, `episode.py`, `library_entry.py`, `progress.py`, `watch_provider.py`, `__init__.py` (barrel with `__all__`)
- Key files: `backend/app/models/__init__.py` — Alembic and deps import from here

**`backend/app/schemas/`:**
- Purpose: Pydantic request/response contracts, including source-agnostic normalization shapes
- Contains: `title.py` (SearchItem, TitleDetail, CastMember, ProviderOffer), `auth.py`, `library.py`, `__init__.py` (re-exports title schemas)

**`backend/app/core/`:**
- Purpose: cross-cutting infrastructure — settings, DB session, Redis, security primitives
- Contains: `config.py` (pydantic-settings + `lru_cache`), `db.py` (engine/session dependency), `redis.py` (client factory), `security.py` (bcrypt, JWT, Google JWKS)

**`backend/alembic/`:**
- Purpose: schema migrations; `env.py` injects `database_url` from settings and targets `app.models.Base.metadata`
- Key files: `backend/alembic/env.py`, `backend/alembic/versions/`

**`backend/tests/`:**
- Purpose: pytest suite, one file per module (`test_tmdb.py`, `test_auth.py`, `test_library.py`, …) plus `conftest.py` fixtures

**`frontend/src/app/`:**
- Purpose: Next.js App Router pages — currently scaffold only (`layout.tsx`, `page.tsx`, `globals.css`)
- Note: `frontend/AGENTS.md` warns that Next 16 has breaking changes; consult `node_modules/next/dist/docs/` before writing frontend code

**`infra/`:**
- Purpose: Terraform IaC. Root files define provider/state/vars; `modules/` holds reusable components (network, eks, rds, elasticache, ecr, iam); `environments/{staging,prod}/` are per-env roots with `backend.hcl` + tfvars
- Note: `.terraform/` provider directories exist locally (not part of the source tree)

**`docs/`:**
- Purpose: product and engineering docs — `design.md` (authoritative architecture), `plan.md`, `prod.md`, `todos.md` (phase order), `progress.md` (checkpoint log)

**`.planning/`:**
- Purpose: GSD planning artifacts, including this `codebase/` mapping

## Key File Locations

**Entry Points:**
- `backend/app/main.py`: FastAPI app factory + lifespan; uvicorn target (`app.main:app`)
- `backend/alembic/env.py`: migration entry point
- `frontend/src/app/layout.tsx` / `frontend/src/app/page.tsx`: frontend root
- `docker-compose.yml`: local full-stack orchestration
- `scripts/check_apis.py`: manual API key sanity check

**Configuration:**
- `backend/app/core/config.py`: all backend settings (DB/Redis URLs, JWT, API keys, CORS)
- `.env.example`: documented env vars (real `.env` present in environment — never read/quote)
- `backend/alembic.ini`: migration config
- `backend/pyproject.toml`: ruff (line 100, E/F/I/B/UP, B008 ignored) + pytest (asyncio_mode auto)
- `frontend/next.config.ts`, `frontend/tsconfig.json`, `frontend/eslint.config.mjs`, `frontend/postcss.config.mjs`
- `infra/backend.tf`, `infra/variables.tf`, `infra/environments/*/backend.hcl`

**Core Logic:**
- `backend/app/api/search.py`: cross-source fan-out (`asyncio.gather`)
- `backend/app/api/titles.py`: source dispatch + upsert + episode-sync trigger
- `backend/app/services/registry.py`: client singletons, key gating, shutdown
- `backend/app/services/cache.py`: Redis cache-aside with graceful degradation
- `backend/app/services/title_store.py`: normalized detail → `titles` upsert
- `backend/app/services/episode_sync.py`: episode/chapter population (idempotent)
- `backend/app/core/security.py`: JWT/bcrypt/Google JWKS primitives

**Testing:**
- `backend/tests/conftest.py`: shared fixtures
- `backend/tests/test_*.py`: 15 test modules mirroring source (auth, cache, clients, API routes, isolation)

## Naming Conventions

**Files (backend):**
- snake_case modules named after their domain/source: `tmdb.py`, `title_store.py`, `episode_sync.py`
- One SQLAlchemy model per file, singular noun: `user.py`, `title.py`, `episode.py`
- One router per domain: `auth.py`, `library.py`
- Tests prefixed `test_<module>.py`

**Files (frontend):**
- Next.js App Router conventions: `layout.tsx`, `page.tsx`, `globals.css` under `src/app/`

**Code:**
- Classes: PascalCase (`TMDBClient`, `CacheLayer`, `LibraryEntry`)
- Functions/variables: snake_case; async endpoints are plain `async def`
- Enums: `StrEnum` with lowercase string values (`MediaType.MOVIE = "movie"` in `backend/app/models/enums.py`)
- DB tables: snake_case plural (`titles`, `library_entries`, `watch_providers`)
- Redis keys: `trakplus:{source}:{op}:{id}` pattern, e.g. `trakplus:tmdb:detail:movie:123` (`backend/app/services/tmdb.py:80`)
- Route paths: REST-ish, prefixed per router (`/auth/*`, `/library`, `/library/{entry_id}/progress/*`, `/titles/{source}/{external_id}`, `/search`, `/health`)

## Where to Add New Code

**New external media source (e.g. OpenLibrary):**
1. Create `backend/app/services/<source>.py` — subclass `BaseClient`, implement `search()`/`detail()` returning `SearchItem`/`TitleDetail`, wrap fetches in `self._cached(key, ttl, fetch)` (template: `backend/app/services/tmdb.py`)
2. Add enum value to `ExternalSource` in `backend/app/models/enums.py` (needs a migration — native enum)
3. Register a `@lru_cache def get_<source>()` factory in `backend/app/services/registry.py` (return `None` if key-gated) and clear it in `aclose_all()`
4. Add the source→column mapping in `SOURCE_ATTR` (`backend/app/services/title_store.py:18-25`) and a corresponding indexed `String(64)` column on `Title` + migration
5. Wire into `backend/app/api/search.py` fan-out and `fetch_detail()` in `backend/app/api/titles.py`
6. Tests: `backend/tests/test_<source>.py`

**New API endpoint:**
- Domain router exists → add handler to the file in `backend/app/api/` (auth guard via `Depends(get_current_user)` from `backend/app/api/deps.py`)
- New domain → create `backend/app/api/<domain>.py`, register in `create_app()` in `backend/app/main.py`
- Pydantic contracts go in `backend/app/schemas/`

**New database model/table:**
1. `backend/app/models/<name>.py` — inherit `Base`, use `Mapped[...]`/`mapped_column`, UUID PK with `default=uuid.uuid4`, `server_default=func.now()` timestamps (template: `backend/app/models/progress.py`)
2. Export from `backend/app/models/__init__.py`
3. Generate migration: `alembic revision --autogenerate -m "..."` in `backend/`

**New Pydantic schema:**
- `backend/app/schemas/<domain>.py`; re-export via `__all__` in `backend/app/schemas/__init__.py` if shared

**New frontend page/route:**
- `frontend/src/app/<route>/page.tsx` (server component by default); shared client components in `frontend/src/components/` (directory does not exist yet — create it when first needed)
- API base URL comes from `NEXT_PUBLIC_API_URL` (set in `docker-compose.yml:62`)

**New Terraform resource:**
- Add a module under `infra/modules/<name>/main.tf`, wire it in the per-env `infra/environments/{staging,prod}/main.tf` (or root `infra/main.tf`)

## Special Directories

**`backend/.venv/`** (when present):
- Purpose: local Python virtualenv; run pytest/ruff via `.venv\Scripts\python -m pytest`
- Generated: Yes; Committed: No

**`frontend/node_modules/`, `frontend/.next/`:**
- Purpose: npm deps and Next build output (`.next/standalone` feeds the Docker runner stage)
- Generated: Yes; Committed: No

**`backend/alembic/versions/`:**
- Purpose: generated migration scripts (committed source, excluded from ruff via `backend/pyproject.toml` extend-exclude)
- Generated: Yes (per revision); Committed: Yes

**`infra/.terraform/`:**
- Purpose: Terraform provider binaries/plugin cache
- Generated: Yes; Committed: No

**`.coverage`, `.pytest_cache/`, `.ruff_cache/` (root/backend):**
- Purpose: test coverage output and tool caches
- Generated: Yes; Committed: No

**`docs/`:**
- Purpose: hand-written project documentation; `docs/design.md` is the architecture source of truth and must be updated when code diverges (per `AGENTS.md`)
- Generated: No; Committed: Yes

---

*Structure analysis: 2026-08-31*
