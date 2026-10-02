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

The diagram above is the **EKS target** (Terraform/Kubernetes portfolio code, not deployed). The **live deployment is simpler**: one Azure VM runs the Docker Compose stack (frontend, backend, Postgres, Redis) behind Caddy, which provides automatic HTTPS — see [Deploy to an Azure VM](#deploy-to-an-azure-vm-live-site).

See [`docs/design.md`](docs/design.md) for the full architecture document.

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Python 3.11, FastAPI (async), SQLAlchemy 2 (async) + Alembic, PyJWT, passlib/bcrypt |
| Frontend | Next.js 16 (App Router, TS), Tailwind v4, shadcn/ui (Base UI), TanStack Query |
| Data | PostgreSQL 17, Redis 7 |
| External APIs | TMDB, RAWG, AniList (GraphQL), Jikan, MangaDex |
| Testing | pytest + pytest-asyncio (118 tests), vitest + React Testing Library (16 tests), Playwright (E2E) |
| Infra | Docker Compose + Caddy on an Azure VM (live), Terraform (AWS EKS portfolio code, not deployed), GitHub Actions (CI + optional ECR/EKS deploy chain) |

## Quickstart (Docker)

```bash
git clone https://github.com/Nitingupta0/Trak_Plus.git && cd Trak_Plus
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

A single consolidated GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push/PR — lint, tests, build, Docker, Terraform validation, security scans (gitleaks, hadolint, npm/pip audits), and a full-stack Playwright E2E. One file = one action in the Actions UI. The ECR-push and EKS-deploy jobs only run on `main`, need AWS credentials (and the `EKS_DEPLOY_ENABLED` repo variable for EKS) and are not used by the Azure deployment, which is updated by hand (see below).

## Deploy to an Azure VM (live site)

**Live: [trak-plus.lucifer07o.tech](https://trak-plus.lucifer07o.tech)** — the Docker Compose stack on one Ubuntu 24.04 VM (`Standard_B2s`, 2 vCPU / 4 GB, static public IP) behind Caddy with automatic Let's Encrypt HTTPS. Postgres and Redis run in Docker on the VM (no managed database). The VM is **started before demos and deallocated afterwards**, so the site is up on demand rather than always-on, and it is updated by hand — there is no auto-deploy or nightly backup on it.

```bash
# On the VM (Docker + a 2 GB swapfile installed; DNS A record -> the VM's static IP; ports 22/80/443 open)
git clone https://github.com/Nitingupta0/Trak_Plus.git && cd Trak_Plus
cp deploy/.env.lightsail.example deploy/.env.lightsail   # CADDY_SITE_ADDRESS=<hostname>, DB password, API keys, CORS_ORIGINS, NEXT_PUBLIC_API_URL=/api, plus JWT_SECRET_KEY
# deploy/docker-compose.lightsail.yml is written for the original AWS host, so three local edits are needed on a new host:
sed -Ei 's/[a-z0-9-]+\.[a-z0-9-]+\.me/<your-hostname>/g' deploy/docker-compose.lightsail.yml         # hardcoded hostname (healthcheck + CORS)
sed -i '/ENVIRONMENT: production/a\      JWT_SECRET_KEY: ${JWT_SECRET_KEY}' deploy/docker-compose.lightsail.yml   # pass the JWT secret to the backend
sed -i 's/ports: \[\]/ports: !reset []/' deploy/docker-compose.lightsail.yml                          # really drop host port bindings (Compose >= 2.24)
docker compose -f docker-compose.yml -f deploy/docker-compose.lightsail.yml --env-file deploy/.env.lightsail up -d --build
```

Update after a code change with `git pull` and the same `up -d --build` command. Stop with `docker compose ... down` (never add `-v`, which deletes the database volume). Deallocate the VM from the Azure portal (status must read *Stopped (deallocated)*) to stop compute billing.

## Alternative: AWS Lightsail (~$12/mo, single box) — auto-deploy

The repo also ships scripts for its original deployment target, the same Compose stack on one **Lightsail Small** instance (2 vCPU / 2 GB / 60 GB SSD — $12/mo flat) — not used for the Azure site above. No EKS, no RDS, no ElastiCache — Postgres and Redis run in Docker on the box. See [`docs/budget.md`](docs/budget.md) for the cost plan.

**Deploys can be automatic.** Pushing code to `main` triggers GitHub Actions → tests → push images to **ECR** → the box's `deploy/auto-deploy.sh` (cron, every 5 min) polls ECR, pulls the new images, and restarts the stack.

### One-time setup
```bash
# 1. Provision the instance + static IP (one-time, needs aws CLI + SSH key)
deploy/provision.sh                 # prints the public IP

# 2. Configure secrets
cp deploy/.env.lightsail.example deploy/.env.lightsail   # fill in IP/domain + keys

# 3. On the Lightsail box (one-time): create ECR repos, configure AWS creds, add cron
#    ECR_BACKEND_URL / ECR_FRONTEND_URL must be set in deploy/.env.lightsail
#    Auto-deploy cron:
#    */5 * * * * /opt/trakplus/deploy/auto-deploy.sh >> /var/log/trakplus-deploy.log 2>&1
```

Then browse to `http://<ip>` (or your domain — Caddy auto-provisions TLS). Tail logs with `docker compose logs -f`. Teardown: `deploy/teardown.sh`. Nightly DB backups: `deploy/backup.sh` (pg_dump → S3, cron at 02:30 UTC). See [`docs/ci-cd.md`](docs/ci-cd.md) for the full ECR→Lightsail pipeline setup.

The **EKS/Terraform** path (`infra/`, `k8s/`) remains intact as portfolio code — re-applied on demand for demos, then `terraform destroy`-ed.

## Repo layout

```
backend/    FastAPI app — app/{api,core,models,schemas,services}, Alembic migrations, tests/
frontend/   Next.js 16 — src/app (pages + BFF routes), src/components, e2e/
infra/      Terraform — modules/{network,eks,rds,elasticache,ecr,iam}, environments/{staging,prod}
deploy/     Single-box deploy — Caddy + compose override (base/lightsail/ecr) used on the Azure VM; AWS Lightsail provision/backup/teardown/auto-deploy scripts
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
- ✅ **Phase 9** — Single-box deployment: AWS Lightsail scripts (~$12/mo option, incl. nightly S3 backup script) and a live Azure VM at https://trak-plus.lucifer07o.tech
- ✅ **Phase 10** — UI Overhaul (Archive Aesthetic & Dynamic Motion)
- ✅ **Phase 11** — Feature Enhancements (Schedule, Analysis, Playtime & Progress)
- ✅ **Phase 12** — Login Redesign, CI/CD Auto-Deploy (Lightsail/ECR path) & Auto-Save
- ✅ **Graphify** — Knowledge graph installed globally (3 surfaces) + graph built (679 nodes)

## Notes

- **Data sources**: metadata from [TMDB](https://www.themoviedb.org), [RAWG](https://rawg.io) (attribution required — added in UI footer during Phase 5), [AniList](https://anilist.co), [Jikan](https://jikan.moe), [MangaDex](https://mangadex.org). This product only tracks metadata — no video/streaming playback, no scraping.
- **Cost control**: the live site runs on a single Azure `Standard_B2s` VM that is deallocated between demos (idle cost is just the disk and static IP); the AWS Lightsail option is ~$12/mo (see [`docs/budget.md`](docs/budget.md)); the EKS/RDS/ElastiCache Terraform path is kept as portfolio code and is not deployed.
