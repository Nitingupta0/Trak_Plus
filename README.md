# TrakPlus — Multi-Media Tracker

One self-hosted app to track everything you consume — **movies, TV, games, anime, and manga** — with rich metadata, episode/chapter-level progress tracking, and India-specific "where to stream" info.

Built as a portfolio-grade full-stack + DevOps project: async FastAPI backend, Next.js 16 frontend, Redis-cached external APIs, and a Terraform-driven path to AWS EKS.

---

## Features (MVP — working today)

- 🔐 **Auth** — email/password (self-hosted JWT with refresh tokens) or one-tap **Google sign-in**; sessions persist via httpOnly cookies, browser never touches raw tokens
- 🔎 **Unified search** — one query fans out across TMDB, RAWG, AniList, and MangaDex simultaneously; results grouped by media type
- 📖 **Rich title pages** — synopsis, cast, genres, runtime, episodes; server-rendered for SEO
- 📺 **Where to stream (India)** — Netflix/Prime/JioCinema etc., split into stream / rent / buy (country selectable)
- 📚 **Personal library** — statuses (Watching / Playing / Reading / Plan to / Completed / Dropped / On-Hold), 1–10 ratings, notes, playtime tracking for games; status and rating **auto-save** on click/typing (no save button)
- ✅ **Progress tracking** — check off episodes (TV/anime) or chapters (manga) one by one with a live progress bar, season selector, and "watch all" quick actions
- 🎮 **Playtime tracking** — log hours played for games with persistent storage and library display
- 📅 **Schedule** — upcoming releases and episodes in a visual timeline with week grouping
- 📊 **Analysis** — dashboard with animated charts showing library stats by status and media type
- 📦 **Import/export** — Trakt-compatible JSON + CSV export/import with dedup and per-row error reporting
- ⚡ **Redis cache-aside** — 24h on searches/details, so free-tier API limits (RAWG 20k/mo, AniList ~90 req/min) are never a problem
- 👤 **Private by default** — every library/progress query is scoped server-side by the authenticated user

## Architecture

```text
[Next.js 16 frontend] ──BFF (httpOnly cookies)──► [FastAPI backend] ──► [PostgreSQL (RDS)]
      browser                                          │            ──► [Redis (ElastiCache)]
          │                                            │
          │              ┌──► [TMDB / RAWG / AniList / Jikan / MangaDex]
          └──────────────┘  (public API calls)

Docker Compose (local) ──► Terraform (VPC + EKS + RDS + ElastiCache + ECR)
                                │
                             EKS cluster
                         ┌─────┴─────┐
                    [ALB Ingress] [k8s Deployments]
                         │         backend + frontend
                    Prometheus + Grafana (observability)
                         │
                    Alertmanager + AWS Budgets (cost alert)

CI/CD: GitHub Actions ──► push ECR ──► deploy staging (auto) ──► promote prod (approval gate)
```

See [`docs/design.md`](docs/design.md) for the full architecture document.

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Python 3.11, FastAPI (async), SQLAlchemy 2 (async) + Alembic, PyJWT, passlib/bcrypt |
| Frontend | Next.js 16 (App Router, TS), Tailwind v4, shadcn/ui (Base UI), TanStack Query |
| Data | PostgreSQL 17, Redis 7 |
| External APIs | TMDB, RAWG, AniList (GraphQL), Jikan, MangaDex |
| Testing | pytest + pytest-asyncio (105 tests), vitest + React Testing Library (12 tests), Playwright (E2E) |
| Infra | Docker Compose, Terraform (EKS portfolio code; staging destroyed), GitHub Actions (CI + EKS deploy chain) |

## Quickstart (Docker)

```bash
git clone <repo-url> && cd trakplus
cp .env.example .env        # optional: add TMDB/RAWG keys (anime + manga work keyless)
docker compose up --build
```

Then open:

- **App**: http://localhost:3000
- **API docs (Swagger)**: http://localhost:8000/docs

> Smoke-check the external APIs anytime: `python scripts/check_apis.py` (after filling keys in `.env`).

## Local dev without Docker

Backend (needs local Postgres + Redis, or `docker compose up postgres redis`):

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate                # Windows (source .venv/bin/activate on Unix)
pip install -r requirements.txt -r requirements-dev.txt
alembic upgrade head
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Configuration

All via environment variables (see [`.env.example`](.env.example)):

| Variable | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | backend | Postgres DSN (`postgresql+asyncpg://…`) |
| `REDIS_URL` | backend | Redis DSN (cache) |
| `JWT_SECRET_KEY` | backend | HS256 signing key — **set a real one** (`python -c "import secrets; print(secrets.token_hex(32))"`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` / `REFRESH_TOKEN_EXPIRE_DAYS` | backend | Token lifetimes (default 30 min / 7 days) |
| `GOOGLE_CLIENT_ID` | backend | Google OAuth audience check (empty = Google sign-in disabled) |
| `TMDB_API_KEY` / `RAWG_API_KEY` | backend | Unlocks movies/TV/games search (register free at TMDB / RAWG) |
| `CORS_ORIGINS` | backend | JSON list of allowed frontend origins |
| `API_URL` | frontend (server) | Backend URL for BFF route handlers (compose: `http://backend:8000`) |
| `NEXT_PUBLIC_API_URL` | frontend (browser) | Backend URL for public search/detail calls |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | frontend | Renders the Google button when set |

## API overview

| Endpoint | Auth | Description |
|---|---|---|
| `GET /health` · `GET /health/ready` | — | Liveness · readiness (checks DB + Redis) |
| `POST /auth/register` | — | Create account (email + password ≥ 8 chars) |
| `POST /auth/login` | — | OAuth2 password form → JWT pair |
| `POST /auth/refresh` | refresh token | Rotate tokens |
| `POST /auth/google` | — | Verify Google `id_token` → issue JWT pair |
| `GET /auth/me` | Bearer | Current user |
| `GET /search?q=&type=` | — | Cross-source search (`all\|movie\|tv\|game\|anime\|manga`) |
| `GET /titles/{source}/{external_id}` | — | Normalized detail + India providers (`?country=IN` default) |
| `GET /titles/{source}/{external_id}/episodes` | — | Synced episodes/chapters |
| `POST /titles/{source}/{external_id}/episodes/sync` | — | Pull episode/chapter list from the source |
| `GET/POST /library` · `PATCH/DELETE /library/{id}` | Bearer | Library CRUD (user-scoped) |
| `POST/DELETE /library/{entry_id}/progress/{episode_id}` · `GET /library/{entry_id}/progress` | Bearer | Episode/chapter progress |
| `GET /library/export?format=json\|csv` | Bearer | Download library (Trakt-compatible JSON/CSV) |
| `GET /library/export/template` | Bearer | CSV import template |
| `POST /library/import` | Bearer | Bulk-import library from JSON/CSV (dedup + per-row errors) |

Interactive docs: http://localhost:8000/docs (Swagger UI supports the OAuth2 password flow via *Authorize*).

## Testing

```bash
# Backend — pytest (unit + integration; external APIs mocked via respx, Redis via fakeredis)
cd backend && .venv\Scripts\python -m pytest
cd backend && .venv\Scripts\python -m ruff check . && .venv\Scripts\python -m ruff format --check .

# Frontend — lint, component tests (jsdom, no backend needed), production build
cd frontend && npm run lint && npm run test && npm run build

# E2E — full user journey against the running compose stack (must pass 3× in a row)
cd frontend && npm run test:e2e
```

## CI/CD

A single consolidated GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push/PR — lint, tests, build, Docker, Terraform validation, security scans (gitleaks, hadolint, npm/pip audits), and a full-stack Playwright E2E. One file = one action in the Actions UI.

## Deploy to AWS Lightsail (~$12/mo, single box) — auto-deploy

The **live, always-on** deployment runs the same Docker Compose stack on one **Lightsail Small** instance (2 vCPU / 2 GB / 60 GB SSD — $12/mo flat). No EKS, no RDS, no ElastiCache — Postgres and Redis run in Docker on the box. See [`docs/budget.md`](docs/budget.md) for the full cost plan.

**Deploys are automatic.** Pushing code to `main` triggers GitHub Actions → tests → push images to **ECR** → Lightsail's `deploy/auto-deploy.sh` (cron, every 5 min) polls ECR, pulls the new images, and restarts the stack. No manual deploy step needed.

### One-time setup
```bash
# 1. Provision the instance + static IP (one-time, needs aws CLI + SSH key)
deploy/provision.sh                 # prints the public IP

# 2. Configure secrets
cp deploy/.env.lightsail.example deploy/.env.lightsail   # fill in IP/domain + keys

# 3. On the Lightsail box (one-time): create ECR repos, configure AWS creds, add cron
#    ECR_BACKEND_URL / ECR_FRONTEND_URL must be set in deploy/.env.lightsail
#    Auto-deploy cron (already added on the live box):
#    */5 * * * * /opt/trakplus/deploy/auto-deploy.sh >> /var/log/trakplus-deploy.log 2>&1
```

Then browse to `http://<ip>` (or your domain — Caddy auto-provisions TLS). After each push to `main`, the new build lands automatically within ~5 minutes. Tail logs with `docker compose logs -f`. Teardown: `deploy/teardown.sh`. Nightly DB backups: `deploy/backup.sh` (pg_dump → S3) — installed on the live box (02:30 UTC cron), round-trip restore verified. See [`docs/ci-cd.md`](docs/ci-cd.md) for the full ECR→Lightsail pipeline setup.

The **EKS/Terraform** path (`infra/`, `k8s/`) remains intact as portfolio code — re-applied on demand for demos, then `terraform destroy`-ed.

## Repo layout

```
backend/    FastAPI app — app/{api,core,models,schemas,services}, Alembic migrations, tests/
frontend/   Next.js 16 — src/app (pages + BFF routes), src/components, e2e/
infra/      Terraform — modules/{network,eks,rds,elasticache,ecr,iam}, environments/{staging,prod}
deploy/     Lightsail single-box deploy — Caddy, compose override (base/lightsail/ecr), provision/backup/teardown/auto-deploy scripts
scripts/    Dev utilities (scripts/check_apis.py smoke-tests all 5 external APIs)
docs/       Product spec, design, plan, todos, progress log, budget, ci-cd, examples/
.planning/  GSD codebase map (STACK, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, INTEGRATIONS, CONCERNS)
```

Local-only, gitignored (see `.gitignore`): `.commandcode/` (agent tooling settings), `scratchpad/` (one-off debug scripts with local paths), and any stray root artifacts.

## Status & roadmap

Build plan and phase-by-phase passing criteria: [`docs/plan.md`](docs/plan.md) · [`docs/todos.md`](docs/todos.md). Work log: [`docs/progress.md`](docs/progress.md).

- ✅ **Phase 0** — Foundations (monorepo, Compose, Terraform skeleton)
- ✅ **Phase 1** — Backend core (schema, 5 API clients + cache, unified search/detail)
- ✅ **Phase 2** — Auth + library (JWT + Google, CRUD, progress, India filtering)
- ✅ **Phase 3** — Frontend MVP (search, detail, library, progress, full E2E)
- ✅ **Phase 4** — Import/export (Trakt-compatible CSV/JSON, round-trip verified)
- ✅ **Phase 5** — Containerize + CI (Dockerfiles, single GitHub Actions workflow)
- ✅ **Phase 6** — AWS Terraform (6 modules: network, RDS, Redis, ECR, IAM, EKS — code-complete, blocked on AWS)
- ✅ **Phase 7** — CI/CD to EKS (ECR push + staging deploy + prod approval gate — code-complete, blocked on AWS)
- ✅ **Phase 8** — Observability (Prometheus metrics, Grafana dashboards, Alertmanager rules, AWS Budgets alarm, k6 load test — code-complete, blocked on AWS)
- ✅ **Phase 9** — Lightsail single-box deployment (~$12/mo, live at https://trak-plus.lucifer07o.tech; nightly S3 backups wired + round-trip verified)
- ✅ **Phase 10** — UI Overhaul (Archive Aesthetic & Dynamic Motion)
- ✅ **Phase 11** — Feature Enhancements (Schedule, Analysis, Playtime & Progress)
- ✅ **Phase 12** — Login Redesign, CI/CD Auto-Deploy & Auto-Save
- ✅ **Graphify** — Knowledge graph installed globally (3 surfaces) + graph built (679 nodes)

## Notes

- **Data sources**: metadata from [TMDB](https://www.themoviedb.org), [RAWG](https://rawg.io) (attribution required — added in UI footer during Phase 5), [AniList](https://anilist.co), [Jikan](https://jikan.moe), [MangaDex](https://mangadex.org). This product only tracks metadata — no video/streaming playback, no scraping.
- **Cost control**: live deployment is a single **Lightsail Small** (~$12/mo, see [`docs/budget.md`](docs/budget.md)); the EKS/RDS/ElastiCache Terraform path is kept as portfolio code, `terraform destroy`-ed when not demoing.
