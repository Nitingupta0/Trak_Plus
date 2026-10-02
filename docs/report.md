# TrakPlus — Project Report

> **Version:** 1.0 · **Date:** 2026-09-01
> **Repo:** https://github.com/Nitingupta0/Trak_Plus
> **Companion docs:** [`README.md`](../README.md) · [`docs/prod.md`](prod.md) · [`docs/design.md`](design.md) · [`docs/plan.md`](plan.md) · [`docs/todos.md`](todos.md) · [`docs/progress.md`](progress.md)

---

## 1. What is this project?

**TrakPlus is a self-hosted, multi-media tracker** — one web app to keep track of everything you consume: **movies, TV series, games, anime, and manga**.

It answers three questions for every title:

1. **What is it?** — Rich metadata (synopsis, cast, genres, runtime, release date, posters) pulled live from 5 external APIs and merged into one consistent view.
2. **Where can I watch it?** — India-specific streaming availability (Netflix, Prime, JioCinema, etc.) split into stream / rent / buy.
3. **How far am I?** — Episode-by-episode (TV/anime) and chapter-by-chapter (manga) progress tracking, with a personal library of statuses, ratings, and notes.

It is deliberately **not** a video player, a piracy tool, or a streaming service — it tracks *metadata and progress* only.

---

## 2. Who is it for?

| User | Need |
|---|---|
| **You (primary)** | One place for all your media, import your existing Trakt/IMDb data, private by default |
| **Friends (multi-user)** | Each person gets their own account, library, and progress — data is scoped per user |
| **Potential employers (secondary)** | A portfolio-grade full-stack + DevOps project demonstrating real production patterns |

The target scale is **small** — a handful of real users, not thousands. That constraint drives the cost plan in §9.

---

## 3. What are we doing?

### 3.1 The mission
Ship a real, publicly reachable app on AWS that costs **$10–30/month** to run, while keeping the *code* as a resume-worthy architecture.

### 3.2 Current status (2026-09-01)

All **9 phases (0–8) are code-complete and locally verified**:

| Phase | Scope | Status |
|---|---|---|
| 0 | Foundations (monorepo, Docker Compose, Terraform skeleton) | ✅ Done |
| 1 | Backend core (schema, 5 API clients, Redis cache, search/detail) | ✅ Done |
| 2 | Auth + library (JWT + Google OAuth, CRUD, progress, India filtering) | ✅ Done |
| 3 | Frontend MVP (auth UI, search, title pages, library, progress tracker) | ✅ Done |
| 4 | Import/export (Trakt-compatible JSON/CSV, dedup) | ✅ Done |
| 5 | Containerize + CI (Dockerfiles, 13-job GitHub Actions) | ✅ Done |
| 6 | AWS infra via Terraform (6 modules) | ⚠️ Code-complete, deployed to staging |
| 7 | CI/CD to EKS (ECR push, staging deploy, prod approval gate) | ⚠️ Code-complete, blocked on AWS secrets |
| 8 | Observability (Prometheus, Grafana, Alertmanager, budgets, k6) | ⚠️ Code-complete |

**Testing baseline (verified this session):**
- Backend: **99/99** pytest passing, 81% coverage, ruff clean
- Frontend: **12/12** vitest, eslint clean, production build clean
- Live E2E user journey: sign up → search → add to library → mark progress → log out → log back in (3× consecutive passes)

### 3.3 The one decision driving everything right now

The original plan targeted **Amazon EKS (Kubernetes)** — a production-grade but expensive architecture. It was fully built and deployed to staging. When the real monthly bill was calculated, **EKS turned out to cost ~$185–205/month for staging alone** — far beyond the personal budget.

We are therefore **re-platforming the live app onto a single small EC2 instance** (running the exact same Docker Compose stack), while **keeping the EKS/Terraform work intact as portfolio code**. §9 explains the money in detail.

---

## 4. Tech stack

| Layer | Technology | Why |
|---|---|---|
| Backend | **Python 3.11 · FastAPI (async) · SQLAlchemy 2 (async) · Alembic** | Fast, typed, modern async Python API |
| Auth | **PyJWT (HS256) · passlib/bcrypt · Google OAuth (JWKS)** | Self-hosted JWT + one-tap Google sign-in |
| Frontend | **Next.js 16 (App Router, TS) · Tailwind v4 · shadcn/ui (Base UI) · TanStack Query** | Server-rendered SEO pages + reactive library UI |
| Data | **PostgreSQL 17 · Redis 7** | Durable storage + 24h cache-aside layer |
| External APIs | **TMDB · RAWG · AniList (GraphQL) · Jikan · MangaDex** | Movies/TV, games, anime, manga metadata + India providers |
| Testing | **pytest · vitest · Playwright** | 99 backend + 12 frontend + full E2E |
| Infra | **Docker Compose · Terraform (AWS) · GitHub Actions · k8s manifests** | Reproducible local → cloud path |
| Observability | **prometheus-fastapi-instrumentator · Grafana · Alertmanager · k6 · AWS Budgets** | Metrics, dashboards, alerts, load test, cost alarm |

---

## 5. Features (what a user can do today)

- 🔐 **Sign up / log in** with email+password or one-tap Google
- 🔎 **Search once across all 5 media sources**, results grouped by type
- 📖 **Rich title pages** — synopsis, cast, genres, runtime, poster, server-rendered for SEO
- 📺 **India "where to stream"** — stream / rent / buy per title (country selectable)
- 📚 **Personal library** — statuses, 1–10 ratings, notes; optimistic UI
- ✅ **Progress tracking** — check off episodes/chapters with a live progress bar
- 📦 **Import / export** — Trakt-compatible JSON + CSV, with dedup and per-row errors
- 👤 **Private by default** — all data scoped server-side to the logged-in user
- ⚡ **Redis cache-aside** — 24h on searches/details, so free-tier API quotas are never hit

---

## 6. Architecture

### 6.1 Application architecture (unchanged)

```text
Browser
  │
  ▼
[Next.js 16 frontend] ──BFF (httpOnly cookies)──► [FastAPI backend]
      browser                                        │
          │                                          ├──► [PostgreSQL]
          │                                          └──► [Redis cache]
          │                                          │
          └──────┌───────────────────────────────────┘
                 ▼
   [TMDB] [RAWG] [AniList] [Jikan] [MangaDex]   (public APIs)
```

### 6.2 Deployment — before vs after the cost decision

**Before (EKS — portfolio-grade, ~$185–205/mo staging):**

```text
Terraform → VPC + EKS cluster + SPOT node group
            + RDS (Postgres) + ElastiCache (Redis)
            + ECR repos + ALB ingress + NAT Gateway + IAM
GitHub Actions → build → push ECR → kubectl deploy → ALB
```

**After (single Lightsail instance — the $10–30/mo live path):**

```text
One Lightsail Small instance (x86, 2GB RAM, 60GB SSD, $12/mo flat)
  └── Caddy reverse proxy (80/443, optional auto-TLS)
        ├── /api/bff/*  → frontend (Next.js route handlers)
        ├── /api/auth/* → frontend (Next.js route handlers)
        ├── /api/*      → backend (FastAPI)
        └── everything  → frontend (Next.js pages)
  └── Docker Compose (the same stack used locally):
        backend (uvicorn) + frontend (next standalone)
        + postgres:17 + redis:7   ← all on one box, no RDS/ElastiCache
  └── Static IP (free while attached) + Lightsail firewall (22/80/443 only)
```

The Docker Compose stack is already written and battle-tested locally (`docker-compose.yml`) — no code changes needed, only the deploy override (`deploy/docker-compose.lightsail.yml`) that adds Caddy and internalizes the service ports.

---

## 7. Testing & quality

- **Backend:** 99 tests (unit + integration), 81% coverage, external APIs mocked via `respx`, Redis via `fakeredis`; `ruff check` + `ruff format` clean
- **Frontend:** 12 component tests (jsdom, no backend dependency), ESLint clean, production build clean (12 routes)
- **E2E:** Playwright full journey passes 3× consecutively against the live compose stack
- **CI:** single 13-job GitHub Actions workflow (lint → test → build → Docker → Terraform validate → security scans → E2E)

---

## 8. Roadmap

| Horizon | Items |
|---|---|
| **Now** | Re-platform live app to single EC2 ($10–30/mo) · wire GitHub secrets · deploy via CI |
| **Soon (v2)** | Custom domain + TLS · auth rate-limiting · refresh-token rotation · PWA |
| **Later** | Friends/activity feed · recommendations · release calendar · public profile |
| **On-demand (portfolio)** | Re-apply EKS stack for a recorded demo, then `terraform destroy` |

---

## 9. Cost plan — two budgets, clearly separated

> **Superseded by [`docs/budget.md`](budget.md) (v2.0, 2026-09-01).** The active
> plan is now a **single Lightsail Small instance (~$12–13.50/mo)** — see `budget.md`
> for the authoritative line-item numbers. This section is kept for history and to
> explain *why* the plan changed twice.

There are **two budgets** for this project:

- **Budget A — Original (EKS)**: the production-grade architecture originally built and deployed. Full and accurate, but too expensive for personal use (~$185–205/mo per environment). **Kept as portfolio code, not the live deployment.**
- **Budget B — Revised**: the chosen path for the live app. **Was** a single EC2 t4g.small (~$21–27/mo), **now** a single Lightsail Small (~$12–13.50/mo) per `budget.md`. **This is the active budget.**

---

### 9A. Budget A — Original (EKS) · ~$185–205/mo per environment

#### What it was
The original plan: Kubernetes on EKS with fully managed data stores and a load balancer, provisioned by Terraform. Built and deployed to staging in full. Several services charge a **flat fee just for existing** — that's what makes it expensive.

#### Line-item budget (per environment, e.g. staging)

| Line | Resource | Rate | Monthly | What it pays for |
|---|---|---|---|---|
| 1 | **EKS cluster control plane** | $0.10/hr | **~$73.00** | Flat fee just for having a managed k8s control plane |
| 2 | **EKS node group** (2× SPOT: t3.medium + t3.small) | ~$0.012–0.02/hr | **~$20–30** | Worker nodes running backend + frontend pods |
| 3 | **NAT Gateway** (Mumbai) | ~$0.052/hr | **~$38.00** | Outbound internet for private-subnet resources |
| 4 | NAT data processing | ~$0.045/GB | **~$2–5** | Per-GB traffic through the NAT gateway |
| 5 | **RDS Postgres** (db.t4g.micro) | ~$0.016/hr | **~$12.00** | Managed database instance |
| 6 | RDS storage 20GB gp3 + 1-day backup | ~$0.10/GB-mo | **~$2–3** | Database disk + automated backups |
| 7 | **ElastiCache Redis** (cache.t4g.micro) | ~$0.018/hr | **~$13.00** | Managed cache cluster |
| 8 | **ALB + LCUs** (after deploy) | ~$0.025/hr + LCU | **~$18–22** | Load balancer in front of the services |
| 9 | **ECR** (2 repos, small images) | ~$0.10/GB-mo | **~$0.50** | Docker image storage |
| 10 | Public IPv4 (NAT EIP + ALB IPs) | $0.005/hr each | **~$4–7** | Public addresses on NAT/ALB |
| 11 | VPC, subnets, IAM, budgets | $0 | **$0** | Networking + identity, no charge |
| | | | **SUBTOTAL (one env)** | **~$185–205** |
| | | | **BOTH envs (staging + prod)** | **~$370–410** |

#### Why it was rejected for the live app
- The **flat $0.10/hr EKS fee (~$73/mo)** and **NAT gateway (~$38/mo)** bill you whether or not anyone uses the app.
- Managed RDS + ElastiCache + ALB add another ~$45–65/mo of "always-on" cost.
- For a handful of users, this is **~95% wasted spend** — you're paying for scalability you never use.

#### Where it still lives
Kept **intact as code** (`infra/`, `k8s/`, `observability/`, deploy jobs in `.github/workflows/ci.yml`) so it can be re-applied on demand for a portfolio demo, then `terraform destroy`-ed.

---

### 9B. Budget B — Revised (Lightsail) · ~$12–13.50/mo **← active budget**

#### What it is
One **Lightsail Small** instance (2 vCPU / 2 GB / 60 GB SSD / 1.5 TB transfer, $12/mo flat)
running the **exact same Docker Compose stack** already used locally — backend, frontend,
Postgres, and Redis all on a single box, fronted by a Caddy reverse proxy (TLS included).
No EKS, no NAT, no RDS, no ElastiCache, no ALB. x86 architecture matches the GitHub
Actions runners, so the same CI-built images run unchanged. See [`budget.md`](budget.md)
for the authoritative line items; the key ones:

| Line | Resource | Monthly | What it pays for |
|---|---|---|---|
| 1 | **Lightsail Small** (2 vCPU, 2 GB, 60 GB SSD, 1.5 TB transfer) | **$12.00** | All 4 services on one box (backend + frontend + Postgres + Redis) |
| 2 | **Static IP** | $0.00 | Free while attached to a running instance |
| 3 | Domain / ECR storage (optional) | $0–1.50 | Only if a custom domain or ECR is used |
| | | **~$12.00–13.50** | |

> vs. the earlier EC2 t4g.small plan (~$21–27/mo): Lightsail bundles disk + transfer +
> static IP into the flat rate and uses x86 (no multi-arch build problem). See
> `budget.md` §2 for the comparison table.

#### Where the money is NOT going (deliberate savings vs Budget A)

| Removed | Was costing | Why removed |
|---|---|---|
| EKS control plane | ~$73/mo | Flat $0.10/hr fee just to exist — overkill for 5 users |
| NAT Gateway | ~$38/mo | Not needed — the instance gets a public IP directly |
| RDS Postgres | ~$15/mo | Postgres runs on the same box as the app |
| ElastiCache Redis | ~$13/mo | Redis runs on the same box as the app |
| ALB + LCUs | ~$18–22/mo | A single instance needs no load balancer |
| EBS + IPv4 + transfer as separate line items | ~$4–8/mo | Bundled into the Lightsail flat rate |
| **Total avoided** | **~$160–170/mo** | Same app, same features |

#### What happens if usage grows (from this budget)

| Scenario | Monthly estimate | Action |
|---|---|---|
| You + a few friends | **~$12–13.50** | This plan (Lightsail Small) — plenty |
| ~100 active users | ~$25–35 | Move Postgres/Redis to managed RDS/ElastiCache, upsize instance |
| ~1000+ users | ~$150+ | Re-introduce EKS/ALB/autoscaling (Budget A code already exists) |

---

### 9C. Budget comparison at a glance

| | **Budget A (EKS)** | **Budget B (Lightsail)** |
|---|---|---|
| Compute | EKS control plane + node group (~$93–103) | One Lightsail Small (~$12) |
| Database | RDS managed (~$14–15) | Postgres in Docker (included) |
| Cache | ElastiCache managed (~$13) | Redis in Docker (included) |
| Networking | NAT (~$38) + ALB (~$18–22) | Static IP (bundled) |
| Disk / transfer | EBS + IPv4 billed separately (~$4–8) | 60 GB SSD + 1.5 TB transfer bundled |
| **Per environment / mo** | **~$185–205** | **~$12–13.50** |
| Best for | Production scale, portfolio demo | Personal + friends, always-on |

---

### 9D. Cost guardrails already in place

- **AWS Budgets alarm** — staging budget $50, prod $100; emails on 80% and 100% (these are hard ceilings above the *expected* spend, so you get warned before anything surprises you)
- **CI cost controls** — ECR lifecycle policy expires old images (keep 10 tagged, purge 30-day-old untagged)
- **Idle discipline** — portfolio EKS (Budget A) is `terraform destroy`-ed when not demoing (≈$0/mo while asleep)

---

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Single instance = single point of failure | Acceptable for 5 users; RDS/Redis can move to managed later; nightly DB backup (pg_dump to S3) |
| Instance death loses data | EBS volume persists; EBS snapshots as backup; app state is Postgres-only |
| Cost creep | Budgets alarms + monthly review of Cost Explorer |
| API rate limits (TMDB/RAWG) | Redis 24h cache-aside already absorbs most calls |
| SPOT node interruption (EKS demo only) | On-demand fallback for demos; the single EC2 is on-demand |

---

## 11. Summary

**What it is:** a multi-media tracker (movies/TV/games/anime/manga) with rich metadata, India streaming info, and episode/chapter progress — self-hosted, multi-user, private by default.

**What we're doing:** shipping it live for **~$12–13.50/month** on a single AWS Lightsail Small instance running the existing Docker Compose stack (fronted by Caddy for TLS), while preserving the full EKS/Terraform architecture (Budget A) as portfolio code that can be re-applied for demos.

**Two budgets:** **Budget A — Original (EKS)** ≈ $185–205/mo per environment (kept as code, too expensive for always-on personal use). **Budget B — Revised (Lightsail)** ≈ $12–13.50/mo (the active budget, authoritative numbers in `budget.md`). Everything expensive in Budget A (EKS, NAT, RDS, ElastiCache, ALB ≈ $160–170/mo) was removed because the app's actual scale doesn't need it.

**Current status (2026-09-01):** the app is **LIVE at https://trakplus.noblechicken.me** on a Lightsail Small (~$12/mo). EKS staging was `terraform destroy`-ed (~$190/mo saved). Google sign-in + search verified end-to-end. Remaining: nightly DB backup cron + first full-month cost review.

**Update (2026-10-02):** the app is also deployed to an Azure VM at **https://trak-plus.lucifer07o.tech** (started before demos, deallocated after) — see [`azure-deployment.md`](azure-deployment.md).
