# Build Plan — Multi-Media Tracker

## Repo layout
Monorepo recommended for a solo/portfolio project (simpler CI/CD to start):
```
media-tracker/
  backend/         # FastAPI app
  frontend/        # Next.js app
  infra/           # Terraform modules + staging/prod tfvars
  .github/workflows/
  docs/            # prod.md, design.md, plan.md live here
```

## Phase 0 — Foundations (1-2 days)
- Repo scaffold, Docker Compose for local dev (Postgres + Redis + backend + frontend).
- Get free API keys: TMDB, RAWG. Confirm AniList/Jikan/MangaDex need no key.
- Terraform skeleton (empty modules, remote state in S3 + DynamoDB lock table) — set this up early even before deploying anything.

## Phase 1 — Backend core (1 week)
- DB schema + migrations (Alembic).
- Service clients for TMDB, RAWG, AniList, Jikan, MangaDex with Redis caching.
- Unified `/search` endpoint, `/titles/{id}` detail endpoint.
- Unit tests for each service client (mock external responses).

## Phase 2 — Auth + library (3-5 days)
- Wire up auth (Cognito/Auth0 originally planned; **replaced with self-hosted JWT + Google OAuth** — see design.md §5b); protect endpoints.
- `library_entries`, `progress` CRUD endpoints.
- Watch-provider fetch + India-region filtering.

## Phase 3 — Frontend MVP (1-1.5 weeks)
- Auth flow, search UI, title detail pages, library dashboard (status columns), episode/chapter progress tracker.
- Deploy nowhere yet — run against local backend.

## Phase 4 — Import/export (2-3 days)
- Trakt-compatible CSV/JSON export.
- CSV/JSON import with dedup against existing library.

## Phase 5 — Containerize + CI (3-4 days)
- Dockerfiles for both apps, docker-compose parity check.
- GitHub Actions: lint/test/build on PR.

## Phase 6 — AWS infra via Terraform (1 week)
- `network`, `rds`, `elasticache`, `ecr`, `iam` modules → apply to `staging`.
- `eks` module, node group, install ALB ingress controller.
- Manually deploy once via kubectl/Helm to validate before automating.

## Phase 7 — Full CI/CD to EKS (3-5 days)
- Extend GitHub Actions: build → push ECR → deploy staging → smoke test → manual approval → promote to prod.
- Set up `prod` Terraform workspace, apply.

## Phase 8 — Observability + polish (3-5 days)
- Prometheus/Grafana (or CloudWatch) dashboards, Alertmanager rules, AWS Budgets alarm.
- README + architecture diagram for resume/portfolio presentation.
- Load-test lightly (k6/Locust) to have real numbers to cite.

## Phase 9 — Lightsail single-box deployment (the live path)
- The EKS architecture (~$185–205/mo per env) is over-budget for a personal app.
- **Live path:** one Lightsail Small (~$12/mo) running the same Docker Compose stack behind Caddy (TLS). See [`docs/budget.md`](budget.md) and [`docs/todos.md`](todos.md) Phase 9.
- EKS/Terraform (Phases 6–8) kept as portfolio code, applied on demand for demos.

## Maintenance — Current bugfix

1. Reproduce the detail-page crash and broken cover URL with a server-safe URL test.
2. Make image proxy URLs preserve the configured API prefix in same-origin deployments.
3. Run frontend tests, lint, and production build; update `docs/todos.md` and `docs/progress.md`.
4. Keep search state in the URL and cache a small, browser-local recent-search list.
5. Persist episode metadata from providers, support notes after async library loading, and merge planned title events with dated episode events in the schedule.

## Phase 10 — UI Overhaul (Archive Aesthetic & Dynamic Motion)
- Upgrade the frontend to the "Archive Aesthetic" design system (Source Serif 4, Geist, #EDE9DE cream / #22211F charcoal).
- Fixed left sidebar rail pinned across scrolling views.
- Ambient motion background: drifting warm light orbs, interactive cursor spotlight, and subtle archive grid overlay.
- Poster-first grid library (Amazon/Letterboxd style) replacing list tables.
- Unified single personal rating badge (★ 1-10), eliminating redundant score/rating duplicate displays.
- Color-coded status system (Active Amber, Plan Slate Blue, Completed Jade, On-Hold Lavender, Dropped Terracotta) with interactive format/status filters.
- Refined silky hover animations: subtle card elevation, diagonal light sheen, and quick-action glass bar.

## MVP cut line
If time-constrained, MVP = Phases 0-5 + the Lightsail single-box deployment (Phase 9). Phases 6-8's full EKS automation and observability can be the "v2" story in interviews — still very fine to build incrementally and talk about the roadmap.

## What I need from you to start Phase 0
- Confirm repo name / whether you want it on your existing GitHub (Nitingupta0).
- TMDB + RAWG API keys once you've registered for them (I can walk you through registration).
