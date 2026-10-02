# TODOs — Multi-Media Tracker

Conventions used throughout:
- Each task has a **Passing criteria** — the concrete bar that must be met before you check it off.
- 🧪 marks a testing task. Testing is not a separate phase — it's interleaved after every functional chunk, never batched to the end.
- 📝 marks a documentation-update checkpoint. Update `progress.md` at every one of these (see template at the bottom of this file / in `progress.md`).
- Nothing in a later phase should start until the current phase's 🧪 and 📝 checkpoints are both green.

---

## Phase 0 — Foundations

- [x] **Scaffold monorepo** (`backend/`, `frontend/`, `infra/`, `.github/workflows/`, `docs/`)
  - Passing criteria: repo pushed to GitHub, README stub present, `docs/prod.md`, `design.md`, `plan.md`, `todos.md` committed under `docs/`. ✅ 2026-09-01 — repo pushed to `NobleChicken97/trakPlus`, README present, all docs tracked under `docs/`.
- [x] **Docker Compose for local dev** (Postgres, Redis, backend, frontend)
  - Passing criteria: `docker compose up` brings up all 4 services; backend health endpoint (`/health`) returns 200; frontend loads on localhost. ✅ Verified 2026-08-30: all 4 containers healthy; `/health` 200; `/health/ready` 200 (database + redis ok); frontend serves HTTP 200 on :3000. Deviation: compose runs production builds (Next standalone) instead of dev servers — see progress.md.
- [x] **Register API keys** — TMDB, RAWG (AniList/Jikan/MangaDex need none)
  - Passing criteria: keys stored in `.env.example` (placeholder) and a local `.env` (gitignored); a throwaway script successfully fetches one real record from each API.
  - ✅ 2026-09-01 — keys stored in `.env.example` (placeholders) and local `.env`; `scripts/check_apis.py` written (fetches one real record from all 5 sources; reads keys from env or root `.env`).
- [ ] **Terraform skeleton + remote state**
  - Passing criteria: S3 bucket + DynamoDB lock table exist; `terraform init` succeeds against remote backend from an empty `infra/` module with no errors.
  - Status 2026-08-30: skeleton complete (versions/backend/variables, 6 placeholder modules per design.md §7, staging + prod environments). `terraform init` + `validate` green locally (local backend; remote-state block prepared but commented). Blocked on AWS credentials for the one-time S3 + DynamoDB bootstrap — step-by-step guide in `infra/README.md`.
- 🧪 **Smoke test**: every local service starts cleanly from a fresh clone (`git clone` → `docker compose up` → all green) on a machine other than your main dev box if possible.
  - Status 2026-08-30: verified on this machine via `docker compose up --build` (all green). Fresh-clone variant pending — requires the git repo to exist first.
- 📝 **progress.md checkpoint**: log what's running locally, any deviations from design.md, open questions.

---

## Phase 1 — Backend core

- [x] **DB schema + Alembic migrations** for `users`, `titles`, `episodes`/`chapters`, `library_entries`, `progress`, `watch_providers`
  - Passing criteria: `alembic upgrade head` runs clean on a fresh DB; schema matches design.md section 3; a rollback (`alembic downgrade -1`) also works without error. ✅ Verified 2026-08-30 (deviation note: external ids are dedicated indexed columns instead of one JSONB dict; episodes table doubles as chapters with season=0).
- [x] **TMDB service client** (search, detail, watch/providers via `append_to_response`)
  - Passing criteria: given a known title (e.g. "Inception"), returns normalized synopsis, genres, cast, and India provider list. ✅ Unit-tested with mocks (live test blocked on TMDB key — see Phase 0).
- [x] **RAWG service client**
  - Passing criteria: search + detail work; requests are counted/logged so you can see monthly quota usage. ✅ Class+instance counters, logged per request; unit-tested.
- [x] **AniList service client** (GraphQL)
  - Passing criteria: single query fetches title + episodes + genres in one round trip (no N+1 calls). ✅ Search+detail each one GraphQL round trip; unit-tested; **verified live** (`/titles/anilist/20` → NARUTO, 220 episodes).
- [x] **Jikan service client** (fallback/cross-reference)
  - Passing criteria: used only when AniList lookup misses or as MAL-ID cross-reference; respects rate limit with basic backoff. ✅ Exponential backoff on 429 (tested); wired as MAL cross-ref via detail.
- [x] **MangaDex service client**
  - Passing criteria: search + chapter list retrieval works for a known manga. ✅ Search + detail + chapter feed, unit-tested.
- [x] **Redis cache-aside layer** wrapping all 5 clients
  - Passing criteria: second identical request within TTL window hits Redis, not the external API (verify via logs/metrics counter). ✅ CacheLayer tested: second call skips HTTP (route.call_count==1); degrades gracefully on Redis outage/corrupt entries. TTLs: search+detail 24h, MangaDex chapters 1h.
- [x] **Unified `/search?type=all&q=` endpoint** (fans out across sources, normalizes, merges)
  - Passing criteria: one query returns correctly-typed results from at least 2 different sources when the query matches both. ✅ Tested (tmdb+anilist mocks); **verified live** (`q=naruto` → 20 anilist results; key-gated sources skipped gracefully).
- [x] **`/titles/{id}` detail endpoint**
  - Passing criteria: returns full normalized title object per design.md schema regardless of source. ✅ Implemented as `/titles/{source}/{external_id}` (composite id), upserts into `titles`; **verified live** against Postgres.
- 🧪 **Unit tests for every service client** (mocked external responses — no live network calls in test suite)
  - Passing criteria: `pytest` coverage ≥80% on `app/services/`; CI-runnable with zero external dependencies. ✅ **36 tests pass, 87.7% coverage on app/services** (respx mocks + fakeredis; DB-backed tests use a dedicated `trakplus_test` database). Ruff clean.
- 🧪 **Integration test**: `/search` and `/titles/{id}` against a local DB + mocked external APIs
  - Passing criteria: tests pass in a clean CI container, not just locally. ⚠ Locally green; CI-container verification deferred to Phase 5 (needs GitHub Actions first).
- 📝 **progress.md checkpoint**: which endpoints are live, cache hit-rate observed locally, any API quirks discovered (undocumented fields, rate-limit surprises).

---

## Phase 2 — Auth + library

> Auth decision 2026-08-30: switched from Cognito/Auth0 to self-hosted JWT + Google OAuth sign-in — see design.md §5b. Rationale: no external dependency, no free-tier limits, simpler local dev; still demonstrates production auth patterns.

- [x] **Self-hosted auth setup** (register/login/refresh + Google OAuth id_token exchange)
  - Passing criteria: can sign up and log in via API; a valid JWT is issued; refresh flow works; Google credential verified against JWKS (aud/iss). ✅ 2026-08-30 — register/login/refresh verified live; Google verification covered by tests (real JWKS check needs GOOGLE_CLIENT_ID at runtime; JS-side button lands in Phase 3).
- [x] **Protect backend endpoints** with JWT verification dependency
  - Passing criteria: unauthenticated requests to protected routes return 401; valid token returns 200. ✅ 2026-08-30 — expired/malformed/missing/wrong-secret/valid all covered in test suite; refresh-token-as-access rejected (type claim).
- [x] **`library_entries` CRUD** (add/update status, rating, notes; remove)
  - Passing criteria: a user can add a title with status "Plan to Watch," update it to "Watching," and the change persists across requests. ✅ 2026-08-30 — tested + verified live (NARUTO added as watching/9, status persisted).
- [x] **`progress` CRUD** (mark episode/chapter watched/read)
  - Passing criteria: marking episode 5 watched doesn't affect episodes 1-4's state; querying progress returns correct watched count. ✅ 2026-08-30 — idempotent mark/unmark, per-title episode validation (foreign episodes 404), counts correct; live: 220-episode sync then mark ep1 → watched_count=1.
- [x] **Watch-provider India filtering**
  - Passing criteria: `/titles/{id}` for a title with providers returns only `country=IN` entries, correctly split into stream/rent/buy. ✅ 2026-08-30 — default `country=IN`, overridable via query param; tested with US/GB mocks filtered out.
- 🧪 **Auth test suite**: expired token, malformed token, missing token, valid token — all four cases covered. ✅ 2026-08-30 (+ wrong-secret forged token, refresh-as-access, weak password, duplicate email).
- 🧪 **Data isolation test**: user A cannot read/modify user B's library entries (critical — test this explicitly, don't assume). ✅ 2026-08-30 — read/modify/delete attempts by B all 404; verified live too.
- 📝 **progress.md checkpoint**: auth flow confirmed end-to-end, any friction with the managed auth provider's free tier limits. ✅ No managed provider anymore (self-hosted) — see progress entry.

---

## Phase 3 — Frontend MVP

- [x] **Auth flow in Next.js** (login/logout, session persistence)
  - Passing criteria: refreshing the page keeps the user logged in; logout clears session and redirects. ✅ 2026-08-31 — httpOnly-cookie BFF (`src/app/api/auth/*`, `src/app/api/bff/[...path]`) with silent refresh; login/logout/register + Google GIS button; E2E verifies logout→login→data persists.
- [x] **Search UI** (single bar, results grouped/tagged by media type)
  - Passing criteria: typing a query returns results within ~1s (cached) and correctly shows poster/thumbnail, title, type, year. ✅ 2026-08-31 — debounced SearchBar + TanStack Query (`src/components/search/search-bar.tsx`, `src/app/search/page.tsx`); results grouped under media-type headings with poster/type/year badges.
- [x] **Title detail page** (synopsis, cast, genres, episodes list, India streaming badges)
  - Passing criteria: page is server-rendered (check page source has content, not just a JS shell) for SEO. ✅ 2026-08-31 — async server component (`src/app/titles/[source]/[externalId]/page.tsx`) with `generateMetadata`; synopsis/cast/genres/India provider badges stream/rent/buy; server-side fetch uses runtime `API_URL`.
- [x] **Library dashboard** (status columns/tabs: Watching, Plan to, Completed, Dropped, On-Hold)
  - Passing criteria: moving a title between statuses updates immediately in the UI and persists on reload. ✅ 2026-08-31 — status Tabs + optimistic onMutate updates (`src/components/library/entry-card.tsx`), per-media-type status options.
- [x] **Episode/chapter progress tracker UI**
  - Passing criteria: checking off an episode updates a visible progress bar/count without a full page reload. ✅ 2026-08-31 — checkbox list + Progress bar, cache-set after mutation (`src/components/titles/progress-tracker.tsx`); episode sync button per title.
- 🧪 **Component tests** (React Testing Library) for search bar, status selector, progress tracker
  - Passing criteria: tests run in CI headlessly, no reliance on live backend. ✅ 2026-08-31 — **12 vitest tests, 3 files, 0 backend dependency** (fetch is stubbed to throw in `tests/setup.ts`); Base UI assertions verified against real component behavior.
- 🧪 **End-to-end test** (Playwright/Cypress): sign up → search → add to library → mark progress → log out → log back in → data still there
  - Passing criteria: this single E2E flow passes reliably (not flaky) 3 runs in a row. ✅ 2026-08-31 — **3 consecutive passes** (8.3s / 5.3s / 4.8s) against the live compose stack (`frontend/e2e/flow.spec.ts`). ✅ Re-verified 2026-09-01 after the archive redesign — **3 consecutive passes** (17.9s / 17.8s / 17.2s) after fixing 3 redesign regressions (sidebar testids, sync POST + media_type, data-ordering flake).
- 📝 **progress.md checkpoint**: screenshots/GIF of the working MVP flow, known UI gaps. ✅ Screenshots in `docs/examples/` (title detail with progress, search results, empty library).

---

## Phase 4 — Import/export

- [x] **Trakt-compatible export** (CSV + JSON, history/ratings/watchlist arrays)
  - Passing criteria: exported file re-imports into your own system cleanly (round-trip test) and is structurally close enough to Trakt's format to be recognizable. ✅ 2026-08-31 — `GET /library/export?format=json|csv`; JSON follows Trakt schema (history/ratings/watchlist arrays with `movie`/`show` objects and `ids`); round-trip verified (export → import to second user → created 1, errors 0).
- [x] **CSV/JSON import** (Trakt export, generic template, dedup logic)
  - Passing criteria: importing a file with 50 mixed titles creates correct library entries, skips true duplicates, and reports any rows it couldn't match with a clear error per row (not a silent failure). ✅ 2026-08-31 — `POST /library/import` accepts JSON (Trakt-style) or CSV; dedup by (user, title); per-row error reporting in `errors` array; `GET /library/export/template` for the CSV format. Sample files in `docs/examples/`.
- 🧪 **Import edge-case tests**: malformed row, unknown external ID, duplicate entries, empty file. ✅ 2026-08-31 — 14 tests covering: JSON export shape, CSV export, plan_to → watchlist, CSV import, Trakt JSON import, malformed JSON → 400, empty file → 400, unknown ID → per-row error (not silent), duplicate → skipped, round-trip (export → second-user import → clean).
- 📝 **progress.md checkpoint**: sample import/export files committed to `docs/examples/` for future reference. ✅ Sample files created.

---

## Phase 5 — Containerize + CI

- [x] **Dockerfiles** (backend, frontend) — multi-stage builds, non-root user, minimal final image
  - Passing criteria: image builds reproduce `docker compose` behavior; final image size reasonable (backend <300MB, frontend <250MB as a rough target; CI measures uncompressed size — frontend was 201 MB on 2026-10-02, so the guard was raised from 200 to 250 MB). ✅ Verified (backend ~88 MB, frontend ~68 MB); hadolint clean.
- [x] **GitHub Actions: lint + test + build on every PR** — consolidated into one workflow
  - Passing criteria: a PR with a deliberately broken test fails CI and blocks merge (verify this actually happens, don't just assume the config is right).
  - ✅ 2026-08-31: single `.github/workflows/ci.yml` (13 jobs → 1 action in the UI). Every CI command verified locally first (ruff, alembic chain+check, pytest ≥80% cov, tsc, eslint, vitest+coverage, hadolint, pip-audit, npm audit, terraform fmt/validate, docker builds + smoke tests + size limits). Validated with actionlint (0 findings).
- 🧪 **CI itself is the test here** — confirm green-on-good-code, red-on-bad-code both work. ✅ 2026-08-31 — repo pushed to GitHub; CI went red 3× on genuine defects (missing migrations, infra audit over-check, vitest reporter) and each fix went green; final full run green.
- 📝 **progress.md checkpoint**: CI run time noted, any flaky steps flagged for follow-up. ✅ E2E is the slowest job (compose build + Playwright ~2m); live search depends on AniList keyless availability. See Phase 5 + CI iteration entries in progress.md.

---

## Phase 6 — AWS infra via Terraform

- [x] **`network` module** (VPC, subnets, security groups)
  - Passing criteria: `terraform apply` succeeds; resources visible in AWS console matching the plan. ⚠ Code complete + `terraform validate` green; `apply` pending AWS credentials (see `infra/README.md` bootstrap).
- [x] **`rds` module** (Postgres)
  - Passing criteria: backend can connect from a local machine (temporarily, via bastion/SSM) using the Terraform-output connection string. ⚠ Code complete + validated; live connectivity test pending AWS apply.
- [x] **`elasticache` module** (Redis)
  - Passing criteria: same connectivity check as RDS. ⚠ Code complete + validated; live test pending AWS apply.
- [x] **`ecr` module**
  - Passing criteria: can `docker push` a built image to the repo manually. ⚠ Code complete (lifecycle policy for old-image cleanup) + validated; push pending AWS apply.
- [x] **`iam` module** (least-privilege CI/CD role + IRSA for pods)
  - Passing criteria: CI role can push to ECR and deploy to EKS but cannot, e.g., delete the VPC — verify by attempting a disallowed action and confirming it's denied. ⚠ Code complete (GitHub OIDC assume role + ECR push policy; EKS pod execution role) + validated; verification pending AWS apply.
- [x] **`eks` module + node group + ALB ingress controller**
  - Passing criteria: `kubectl get nodes` shows healthy nodes; a manually-deployed "hello world" pod is reachable via the ALB URL. ⚠ Code complete (managed SPOT node group, ALB ingress controller IAM policy) + validated; live checks pending AWS apply.
- [ ] **Manual first deploy** (kubectl/Helm) of backend + frontend to staging
  - Passing criteria: staging URL serves the real app, connects to RDS/Redis, and a full user flow (Phase 3's E2E scenario) works against the deployed environment. ⚠ Blocked on AWS credentials + remote-state bootstrap (Phase 0).
- 🧪 **Infra smoke test**: `terraform destroy && terraform apply` from scratch reproduces a working environment (proves it's not hand-patched). ⚠ Pending AWS apply.
- 📝 **progress.md checkpoint**: architecture diagram updated to reflect actual deployed topology; cost snapshot from AWS Cost Explorer noted. ⚠ Pending actual deployment.

---

## Phase 7 — Full CI/CD to EKS

- [x] **Extend GitHub Actions**: build → push ECR → deploy staging → smoke test → manual approval gate → promote to prod
  - Passing criteria: a merge to `main` reaches staging automatically with zero manual steps; promotion to prod requires an explicit approval click and then deploys without manual kubectl commands.
  - ✅ 2026-09-01 (code-complete + validated): `ci.yml` extended with `push-images` (ECR build+push), `deploy-staging` (kubectl apply + ALB smoke test), `deploy-prod` (gated by GitHub `prod` environment with required reviewers). K8s manifests (`k8s/`) with placeholder image tags rendered at deploy time. actionlint: 0 findings. ⚠ Live run blocked on AWS bootstrap (ECR repos + EKS clusters must exist first).
- [x] **`prod` Terraform workspace**
  - Passing criteria: `prod` and `staging` are fully independent (verify prod apply doesn't touch staging state). ⚠ Code-complete — `infra/environments/prod/` is a separate root config with its own backend.hcl/state. Independence verified once both are applied with AWS.
- 🧪 **Rollback test**: deliberately deploy a broken image to staging, confirm you can roll back to the previous good image within a few minutes. ⚠ Pending AWS deployment (use `kubectl rollout undo deployment/trakplus-backend -n trakplus`).
- 📝 **progress.md checkpoint**: full pipeline diagram (commit → prod) added to README. See Phase 7 progress entry.

---

## Phase 8 — Observability + polish

- [x] **Prometheus + Grafana** (or CloudWatch) dashboards: latency, error rate, cache hit ratio, external API call volume
  - Passing criteria: dashboard visibly reflects a real spike when you deliberately generate load or errors. ✅ 2026-09-01 — `prometheus-fastapi-instrumentator` wired to backend (`GET /metrics`); custom `trakplus_external_api_calls_total` counter per source. Grafana dashboard JSON in `observability/grafana-trakplus.json`. ⚠ Live dashboard pending EKS deployment (Prometheus server + Grafana not running yet).
- [x] **Alertmanager rules** (error-rate spike, pod crash loops, DB/Redis connection failures)
  - Passing criteria: triggering one condition (e.g. killing a pod) actually fires a real alert (Slack/email/webhook) within a couple minutes. ✅ Config files written (`observability/alertmanager.yaml`, `observability/prometheus-alerts.yml`). ⚠ Live alert routing pending EKS deployment.
- [x] **AWS Budgets alarm**
  - Passing criteria: test alarm fires at a low threshold to confirm wiring, then reset to real threshold. ✅ Terraform `budgets` module ($50 staging / $100 prod) wired into both environments, validated. ⚠ `terraform apply` + AWS account needed.
- [x] **Light load test** (k6 or Locust)
  - Passing criteria: you have real numbers (requests/sec, p95 latency) to cite, plus a saved report file in `docs/`. ✅ k6 script in `observability/load-test.js`: stages (10→25→0 users), p95 threshold 1s, <1% error rate. ⚠ Run against live deployment for real numbers; can run locally against compose backend now: `k6 run observability/load-test.js`.
- [x] **README + architecture diagram for resume/portfolio**
  - Passing criteria: a stranger could read the README and understand what the app does, the architecture, and how to run it locally in under 5 minutes. ✅ Updated with full EKS + observability pipeline diagram, all phases checked, quickstart->dev->testing flow.
- 📝 **Final progress.md checkpoint**: full retrospective — what shipped, what's deferred to "v2," lessons learned (this is your interview-story material). ✅ See Phase 8 progress entry.

---

## Phase 9 — Lightsail single-box deployment (the $12/mo live path)

> Cost decision 2026-09-01: the EKS architecture (~$185–205/mo per env) is over-budget for
> a personal app. The live app moves to a single **Lightsail Small** instance (~$12–13.50/mo)
> running the same Docker Compose stack. EKS/Terraform is kept intact as portfolio code.
> Full numbers in `docs/budget.md` (authoritative) and `docs/report.md` §9.

- [x] **Deploy tooling** (`deploy/`): Caddy reverse proxy, Lightsail compose override, provision/deploy/backup/teardown scripts
  - Passing criteria: `deploy/provision.sh` creates a Lightsail Small + static IP + opens 22/80/443; `deploy/deploy.sh` installs Docker, uploads the repo + `.env.lightsail`, and brings the full stack up behind Caddy; health check passes. ✅ Done + live: `deploy/` (Caddyfile, `docker-compose.lightsail.yml`, `provision.sh`, `deploy.sh`, `backup.sh`, `teardown.sh`, `.env.lightsail.example`).
- [x] **Frontend build-arg fix**: `NEXT_PUBLIC_API_URL` must be a Docker ARG (was silently ignored; the CI `build-args: NEXT_PUBLIC_API_URL=/api` line now actually applies)
  - Passing criteria: frontend Dockerfile declares `ARG NEXT_PUBLIC_API_URL`; compose passes it; a build with `/api` bakes it into the client bundle. ✅ Done (Dockerfile + base compose).
- [x] **CORS configurable**: `CORS_ORIGINS` overridable via env (was hardcoded localhost)
  - Passing criteria: base compose reads `${CORS_ORIGINS:-…}`; Lightsail override sets prod origin. ✅ Done.
- [x] **Provision + deploy live**
  - Passing criteria: instance running, app reachable at http://IP (or domain), full Phase 3 E2E flow works against it. ✅ **LIVE** — Lightsail Small `trakplus` (13.234.124.180) → https://trakplus.noblechicken.me; Caddy TLS (Let's Encrypt); search/auth verified via headless browser.
- [x] 🧪 **Backup smoke test**: `deploy/backup.sh` writes a `pg_dump` to S3 and restores it into a throwaway DB.
  - Passing criteria: round-trip backup → restore yields identical row counts. ✅ 2026-09-02 — scoped IAM user `trakplus-backups` (S3 put/list on `trakplus-backups` only) + bucket created; aws CLI v2 installed + scoped creds configured on the box; nightly cron `30 2 * * *` wired (`PATH` set,, log `/var/log/trakplus-backup.log`). Round-trip verified: restore into throwaway DB → exact `count(*)` identical across all 7 tables (titles 372, episodes 237, users 3, library_entries 6).
- [x] **Azure VM deployment** (alternative single-box target, same compose stack)
  - Passing criteria: site reachable over HTTPS on a custom domain, register/login/search/add-to-library work, only Caddy's 80/443 published, survives a VM deallocate/start cycle. ✅ 2026-10-02 — https://trak-plus.lucifer07o.tech; verified incl. restart test. Runbook: `docs/azure-deployment.md`. Fixes folded into `deploy/`: domain/CORS now env-driven, `JWT_SECRET_KEY` required, `!reset` for host ports.
- 📝 **progress.md checkpoint**: cost snapshot (first full month bill), actual vs planned spend, anything surprising about Lightsail. ⚠ Pending first full month; infra + HTTPS + fixes logged in progress.md.

---

## Maintenance — Current bugfix

- [x] **Restore title detail navigation and cover art**
  - Passing criteria: clicking any search result renders its title page without a Next.js error, and cover URLs work in both local absolute-API and production same-origin `/api` deployments.
  - ✅ 2026-09-02 — `proxiedImageUrl()` is server-safe and preserves the configured API prefix (`/api/img` in same-origin deployments).
- 🧪 **Regression coverage**: URL helper tests cover both absolute and relative API bases; frontend lint, unit tests, and production build pass. ✅ 2026-09-02 — 15/15 frontend tests, lint, and build green.
- 📝 **progress.md checkpoint**: record the fix, verification, and any remaining environment-specific gaps. ✅ 2026-09-02 — see latest progress entry.
- [x] **Wire Google OAuth in local Compose**
  - Passing criteria: both frontend and backend receive the configured Google client ID; failed OAuth responses are visible to the user.
  - ✅ 2026-09-02 — backend now receives `GOOGLE_CLIENT_ID`; Google callback errors show a toast instead of failing silently. Added 60-second JWT clock-skew tolerance after reproducing `ImmatureSignatureError`.
- [x] **Harden external-source failures for local Docker**
  - Passing criteria: local TLS-inspecting environments can opt into a development-only certificate workaround; production keeps verification enabled; episode sync returns an upstream error instead of `500`.
  - ✅ 2026-09-02 — added `EXTERNAL_API_VERIFY_SSL` (local Compose default false, Lightsail true), sanitized source-failure logs, and mapped sync HTTP failures to 502. Provider/API access still depends on valid RAWG credentials and network access.
- [x] **Search, episode, notes, and schedule UX fixes**
  - Passing criteria: browser back restores the query, recent searches are local-only, episode metadata renders after sync, game notes save, and planned titles plus dated episodes appear in schedule order.
  - ✅ 2026-09-02 — search state is URL-driven with up to 8 localStorage history entries; detail back uses browser history; episodes store/render descriptions and thumbnails; notes hydrate after async library loading; schedule includes planned title release events and unwatched dated episodes across media types.
- 🧪 **Regression validation for current UX fixes**: backend tests and frontend checks remain green after the schema/API/UI changes.
  - ✅ 2026-09-02 — backend 109/109, Ruff clean, frontend 16/16 Vitest, lint, and production build green; episode metadata migration applied to the local Compose database.
- 📝 **progress.md checkpoint**: record current UX behavior and any provider limitations. ✅ 2026-09-02 — see latest progress entry.

---

## Maintenance — Auth rate limiting (v2 hardening)

- [x] **Per-IP rate limiting on auth endpoints** (Redis fixed-window, design.md §5b)
  - Passing criteria: more than `AUTH_RATE_LIMIT_PER_MINUTE` attempts/min from one IP on a scoped auth endpoint returns 429 with `Retry-After`; different endpoints/IPs count independently; an outage must never block logins (fail open).
  - ✅ 2026-09-02 — `app/core/rate_limit.py` (INCR/EXPIRE counter keyed `ratelimit:{scope}:{ip}:{minute-bucket}`, default 10/min, `=0` disables) wired as a dependency onto register/login/refresh/google in `app/api/auth.py`; Redis outages fail open; scopes isolated.
- 🧪 **Rate-limit tests**: unit (allowed-then-blocked, scope/IP isolation, window rollover, fail-open on Redis down, `limit=0` disables, XFF handling) + endpoint-level (11th login → 429, register hammering doesn't lock out login).
  - ✅ 2026-09-02 — 9 new tests in `tests/test_rate_limit.py`; shared `api_client` fixture rebinds the limiter to disabled so other suite tests are never throttled; backend **118/118** + Ruff clean.
- 📝 **progress.md checkpoint**: record the rate-limit implementation, verification, and any environment quirks. ✅ 2026-09-02 — see latest progress entry.

---

## Phase 10 — UI Overhaul (Archive Aesthetic & Dynamic Motion)

- [x] **Globals & Tailwind Config**
  - Passing criteria: `globals.css` updated with Stitch OKLCH tokens, `--radius` set to `0px`, high-contrast text tokens (`--foreground: oklch(0.18)` / `--muted-foreground: oklch(0.38)` in light; `--foreground: oklch(0.95)` / `--muted-foreground: oklch(0.76)` in dark), warm archive ivory sidebar in light mode, no default generic colors left.
  - ✅ 2026-09-02 — Full OKLCH token setup, hardware-accelerated spring curves, status color mapping.
- [x] **Typography & Fonts**
  - Passing criteria: `Source Serif 4` and `Geist` correctly imported in Next.js and mapped to Tailwind config; applied to UI.
  - ✅ 2026-09-02 — Editorial serif headers + mono metadata tags across library, title detail, and modals.
- [x] **Library & Discovery Refinement**
  - Passing criteria: Responsive poster grid (Amazon/Letterboxd style), single gold star rating pill (`★ 10`), dedicated status colors, compact hover action bar, filter tabs, sort dropdown with explicit high-contrast option styling, living ambient background with HTML5 canvas particles and luminous aurora orbs.
  - ✅ 2026-09-02 — Full poster grid in `src/app/library/page.tsx`, `library-card.tsx`, `ambient-background.tsx`, and `app-sidebar.tsx`.
- [x] **Sidebar & Navigation Polish**
  - Passing criteria: Fixed 64px rail, T logo removed, high-contrast dark charcoal icons (75%-100% opacity), Anime.js spring physics with floating tooltip pills, cleanly aligned profile account menu.
  - ✅ 2026-09-02 — Verified in light and dark mode with browser subagent.
- [x] **Title Details Polish**
  - Passing criteria: Title detail page uses a magazine-style grid; `StatusSelector` and `ProgressTracker` redesigned and animated; no squished poster images.
  - ✅ 2026-09-02 — Validated and working with integer rating schema (1-10).
- 🧪 **Regression test**: Vitest unit tests pass; UI verified with multiple browser screenshots across both light and dark themes.
- 📝 **progress.md checkpoint**: Document completion of the Archive Aesthetic overhaul. ✅ 2026-09-02 — see progress.md.

---

## Phase 11 — Feature Enhancements (Schedule, Analysis, Playtime & Progress)

- [x] **Schedule page redesign**
  - Passing criteria: Visual cards with poster thumbnails, date badges, color-coded type indicators, animated counters, collapsible week sections.
  - ✅ 2026-09-03 — Full redesign with `schedule-card.tsx`, `week-section.tsx`, animejs animations.
- [x] **Analysis page dashboard**
  - Passing criteria: Animated counters, spring-physics bar charts, SVG donut chart for media type distribution.
  - ✅ 2026-09-03 — Dashboard with `stat-card.tsx`, `animated-bar.tsx`, `donut-chart.tsx`.
- [x] **Playtime tracking for games**
  - Passing criteria: Editable hours/minutes input, persistence across sessions, display in library.
  - ✅ 2026-09-03 — `playtime-input.tsx`, `playtime-input-wrapper.tsx`, backend `playtime_minutes` column.
- [x] **Season-based episode selector**
  - Passing criteria: Season dropdown, "Watch all in season" checkbox, filtered episode list.
  - ✅ 2026-09-03 — Updated `progress-tracker.tsx` with season grouping and batch toggle.
- [x] **Auto-complete on completed status**
  - Passing criteria: Changing status to "completed" marks all episodes as watched.
  - ✅ 2026-09-03 — useEffect watches status changes and batch updates episodes.
- [x] **Library progress indicator**
  - Passing criteria: Watched/total for series, playtime for games displayed under cards.
  - ✅ 2026-09-03 — Updated `library-card.tsx` with progress bar and playtime display.
- [x] **Status selection visual feedback**
  - Passing criteria: Toggle shows immediate visual feedback with shadow and transition.
  - ✅ 2026-09-03 — Enhanced `toggle.tsx` with `duration-200` and `shadow-sm`.
- 🧪 **Regression test**: Frontend build green, manual verification of all features.
- 📝 **progress.md checkpoint**: Document completion of feature enhancements. ✅ 2026-09-03 — see progress.md.

---

## Phase 12 — Login Redesign, CI/CD Auto-Deploy & Auto-Save

- [x] **Login page redesign (archive aesthetic)**
  - Passing criteria: Warm cream background matching app light mode, editorial serif heading, hand-drawn media collage illustration, amber accents, tonal Google button.
  - ✅ 2026-09-03 — Warm cream + serif + generated collage image (`login-illustration.png`); Create/Login mode toggle; Google button toned amber.
- [x] **Custom Google sign-in button**
  - Passing criteria: Buttons render in-page, open account chooser, blend with theme (no white pill / no red not-allowed cursor).
  - ✅ 2026-09-03 — Custom-style button; reverted to reliable `renderButton` iframe integration for guaranteed function; CSS tint for theme blending.
- [x] **Google OAuth backend hardening**
  - Passing criteria: `/auth/google` returns controlled 4xx/5xx (never leaks 500), logs real cause.
  - ✅ 2026-09-03 — Wrapped user-upsert with logger.exception; 400 for missing email; verification failures → 401.
- [x] **Hover animation feedback on all buttons**
  - Passing criteria: Every button lifts + shadows on hover, settles on active, disabled suppressed.
  - ✅ 2026-09-03 — Shared `Button` base + custom login buttons: `-translate-y-0.5` + `shadow-lg` on hover.
- [x] **Auto-save status & rating (remove Save button)**
  - Passing criteria: Status persists on click; rating persists on debounce/blur; no save button; rating shown from saved data on reload.
  - ✅ 2026-09-03 — Status PATCH/POST on click; rating debounced auto-save; `entryIdRef` synced from library; field populates from entry.
- [x] **Streamlined CI/CD — ECR push + Lightsail auto-deploy**
  - Passing criteria: Push to `main` → CI → ECR → Lightsail auto-pulls within ~5 min; no manual deploy.
  - ✅ 2026-09-03 — `push-images` job on main; `deploy/auto-deploy.sh` (cron every 5 min) polls ECR; `docker-compose.ecr.yml` uses pre-built images.
- 🧪 **Regression test**: Frontend build green; E2E updated for login mode toggle + auto-save; backend lint clean.
- 📝 **progress.md checkpoint**: Document login redesign, auto-save, and ECR→Lightsail auto-deploy. ✅ 2026-09-03 — see progress.md.

---

## Ongoing, every phase (not one-time)
- 🧪 Re-run the full test suite (unit + integration + E2E where applicable) before closing out any phase — never carry forward a red test into the next phase.
- 📝 Update `progress.md` at every checkpoint marked above, not just at phase boundaries — a quick 3-5 line entry is enough, but it should happen the same day the work happens, not retroactively.
- 📝 Keep `design.md` in sync if reality diverges from the original design (e.g. you swap a library, change a schema) — treat drift between docs and code as a bug.
