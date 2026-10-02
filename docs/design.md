# Design Doc — Multi-Media Tracker

## 1. High-level architecture

```
[Next.js frontend] --> [FastAPI backend] --> [PostgreSQL]
                              |         --> [Redis (cache + rate-limit buffer)]
                              |         --> [TMDB / RAWG / AniList / Jikan / MangaDex APIs]
                              --> [Self-hosted JWT auth + Google OAuth sign-in]

All containerized (Docker) --> Lightsail (live, ~$12/mo) or EKS (portfolio demo, on-demand)
Provisioned via Terraform (EKS) --> VPC, EKS, RDS (Postgres), ElastiCache (Redis), ECR, ALB, IAM
CI/CD: GitHub Actions --> build/test --> deploy to Lightsail (SSH) or EKS (kubectl, portfolio demos)
Observability: Prometheus + Grafana (or CloudWatch) + Alertmanager
```

## 2. Backend (FastAPI)
- **Structure**: modular — `app/api/` (routers per domain: auth, health, search, titles, library, progress, import_export), `app/services/` (one client per external API), `app/models/`, `app/schemas/` (Pydantic), `app/core/` (config, db session, redis client, security, metrics).
- **Async everywhere**: `httpx.AsyncClient` for all third-party calls, run concurrently with `asyncio.gather` for cross-source search.
- **Caching strategy**: Redis cache-aside pattern. Cache TMDB/RAWG/AniList/Jikan responses (title search + detail, incl. watch-provider data bundled via TMDB `append_to_response`) for 24h; MangaDex chapter lists for 1h. This is what keeps you inside free-tier rate limits (RAWG: 20k/mo, Jikan: informal rate limit ~3 req/sec).
- **Background jobs**: Celery + Redis (or APScheduler for MVP) for periodic syncs — e.g., refresh airing anime schedules, refresh streaming-provider changes.

## 3. Data model (core tables)
- `users` (id, email, auth_provider_id, created_at)
- `titles` (id, media_type[movie|tv|game|anime|manga], external ids as dedicated indexed columns (tmdb_id, rawg_id, anilist_id, mal_id, mangadex_id — changed from the original single `external_ids{...}` JSONB so "find by tmdb id" lookups stay indexed), title, original_title, synopsis, release_date, genres[], poster_url, backdrop_url, raw_metadata JSONB, created_at, updated_at)
- `episodes` / `chapters` (id, title_id, number, season[0 = N/A for anime flat lists and manga chapters], name, air_date; unique per (title, season, number))
- `library_entries` (id, user_id, title_id, status[watching|playing|reading|plan_to|completed|dropped|on_hold], rating[1-10 CHECK], notes, added_at, updated_at; unique per (user, title))
- `progress` (id, library_entry_id, episode_id, watched_at; unique per (entry, episode))
- `watch_providers` (id, title_id, country, provider_name, offer_type[stream|rent|buy], updated_at; unique per (title, country, provider, offer))

`raw_metadata JSONB` keeps the door open for fields you didn't anticipate without a migration.

## 4. External API integration notes
| Source | Auth | Key limit to design around |
|---|---|---|
| TMDB | API key | Generous free tier; use `append_to_response` to batch fetch credits+episodes+watch/providers in one call |
| RAWG | API key | 20,000 req/month — must cache aggressively, attribute RAWG in footer |
| AniList | none (GraphQL) | Rate-limited (~90 req/min); batch fields per query |
| Jikan | none (REST) | ~1-3 req/sec informal limit; used as MAL fallback/cross-reference |
| MangaDex | none | Standard REST, respect their rate-limit headers |

Unify all sources behind an internal `/search?type=all&q=` endpoint that fans out, normalizes into a common shape, and returns merged results — this abstraction is what lets the frontend stay source-agnostic.

## 5. Frontend (Next.js)
- App Router, server components for SEO-friendly title pages, client components for interactive library management.
- Auth: the frontend talks to the backend's self-hosted JWT endpoints (see Authentication section). Next.js route handlers act as a light BFF: they hold tokens in httpOnly, secure cookies server-side so the browser never touches raw JWTs (XSS mitigation; CSRF-safe sameSite=lax). For Google sign-in the frontend renders Google Identity Services, sends the `id_token` (credential) to `POST /auth/google`, and the backend verifies it — the browser never receives Google tokens it could misuse.
- State: React Query (TanStack Query) for server-state caching against your own FastAPI, not the third-party APIs directly.

## 5b. Authentication (self-hosted JWT + Google OAuth)
Decision (2026-08-30, replaces the original Cognito/Auth0 plan): auth is fully
self-hosted — no managed identity provider, no external dependency on the auth
critical path, no free-tier limits.

- **Credentials**: email + password, bcrypt-hashed via passlib (`bcrypt` pinned <4.1 for passlib compat). `users.hashed_password` is nullable — OAuth-only accounts have none.
- **Tokens**: JWTs signed HS256 with `JWT_SECRET_KEY` from env.
  - Access token: 30 min, carries `sub` (user id) + `type: access`.
  - Refresh token: 7 days, carries `sub` + `type: refresh`; `POST /auth/refresh` exchanges it for a new pair. Token `type` claim prevents refresh tokens being used as access tokens.
- **Endpoints**: `POST /auth/register`, `POST /auth/login` (OAuth2 password form → Swagger "Authorize" works out of the box), `POST /auth/refresh`, `GET /auth/me`, `POST /auth/google`.
- **Google OAuth** ("sign in with Google" for easier management): frontend obtains a Google Identity Services `id_token` credential; backend verifies RS256 signature against Google's JWKS via `jwt.PyJWKClient`, checks `iss=accounts.google.com` and `aud=GOOGLE_CLIENT_ID`, then upserts the user (`auth_provider_id` = Google `sub`) and issues our own JWT pair. Google never sees our API.
- **Protection**: FastAPI dependency `get_current_user` (OAuth2PasswordBearer) on all library/progress routes. 401 on missing/expired/malformed tokens. All user data endpoints are scoped by `user_id` from the token — never from client input.
- **Rate limiting (per-IP, implemented 2026-09-02)**: the four unauthenticated auth endpoints (`/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/google`) are throttled per client IP via Redis fixed-window counters (INCR/EXPIRE, key `ratelimit:{scope}:{ip}:{minute-bucket}`, default 10 attempts/min per endpoint scope, `AUTH_RATE_LIMIT_PER_MINUTE=0` disables). 429 responses carry a `Retry-After` header. Scopes are isolated so hammering register does not lock out login. Redis outages fail open — an unavailable limiter must never block legitimate logins (same philosophy as the cache layer).
- **Remaining hardening (v2 backlog, documented deliberately)**: token revocation/denylist via Redis, refresh-token rotation with reuse detection.

## 6. Import/export
- Export: `GET /library/export?format=json|csv` generates Trakt-compatible output — JSON has `history`/`ratings`/`watchlist` arrays with `movie`/`show` objects and external `ids`; CSV is a flat per-entry table. Anime maps to Trakt's `show` type (via AniList/MAL ids); games and manga fall back to `movie` for portability.
- Import: `POST /library/import` accepts Trakt-style JSON or the generic CSV template (columns: `source, external_id, media_type, status, rating, notes`) — auto-detected from content. Titles resolve from the DB first, then via live API lookup (cached) if not cached. Dedup by (user, title); unmatched rows are reported per-row in `errors`, never silently dropped. `GET /library/export/template` serves the CSV template.

## 7. Infrastructure (Terraform modules)
- `network/` — VPC, subnets, security groups
- `eks/` — cluster, node groups (spot instances to control cost against your AWS credits)
- `rds/` — Postgres (single instance is fine for a portfolio project)
- `elasticache/` — Redis
- `ecr/` — image repos for frontend + backend
- `iam/` — least-privilege roles for CI/CD and pod service accounts (IRSA)
- Two workspaces/environments: `staging` and `prod`, same modules with different tfvars.

## 8. CI/CD (GitHub Actions)
1. On PR: lint, unit tests, type-check (mypy/ESLint), build Docker images.
2. On merge to `main`: build + push images to ECR, deploy to `staging` via `kubectl apply`/Helm, run smoke tests.
3. Manual approval gate → promote same image to `prod`.

## 9. Observability
- Prometheus scraping FastAPI (via `prometheus-fastapi-instrumentator`) + node/pod metrics.
- Grafana dashboards: request latency, error rate, cache hit ratio, external API call volume (to watch rate-limit headroom).
- Alertmanager: alert on error-rate spike, pod crash loops, Redis/Postgres connection failures.

## 10. Cost control
- **Live deployment:** a single VM runs the whole app + Postgres + Redis in Docker behind Caddy. Currently an **Azure VM** (`Standard_B2s`, deallocated between demos — see [`docs/azure-deployment.md`](azure-deployment.md)); the original target was a **Lightsail Small** (~$12/mo flat — see [`docs/budget.md`](budget.md)). No EKS/RDS/ElastiCache charges in the always-on path.
- **Portfolio/EKS path (Phases 6–8):** if re-applied for a demo, use a small SPOT node group, RDS `db.t4g.micro`, ElastiCache `cache.t4g.micro`, and `terraform destroy` when the demo is over (~$0/mo idle). AWS Budgets alarm guards both.
