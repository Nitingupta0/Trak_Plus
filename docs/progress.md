# Progress Log — Multi-Media Tracker

Update this file at every 📝 checkpoint in `todos.md` — same day the work happens. Newest entry on top. Keep entries short (3-5 lines); this is a log, not a report.

Each entry format:

```
## YYYY-MM-DD — Phase N: <what you worked on>
**Done:** what actually got finished and passed its criteria
**Tests:** what was run, pass/fail, coverage if relevant
**Issues/deviations:** anything that didn't go per design.md/plan.md, and why
**Next:** the next concrete task
```

---

## 2026-10-02 — Phase 9: Azure VM deployment (live) + deploy config hardening

**Done:** Deployed the compose stack to an Azure Ubuntu VM (`Standard_B2s`, static IP, 2 GB swap) behind Caddy at **https://trak-plus.lucifer07o.tech** (Let's Encrypt cert issued, `/health` reports `production`). Documented the full runbook in `docs/azure-deployment.md`. Hardened `deploy/docker-compose.lightsail.yml`: site domain/CORS now come from `deploy/.env.lightsail` (no hardcoded domain; Caddy healthcheck derives the host from `CADDY_SITE_ADDRESS`), `JWT_SECRET_KEY` is passed to the backend and **required** (the backend default is a public dev value), and `ports: !reset []` so base-file host ports really are removed.

**Dependencies:** CI's `pip-audit` started failing on advisories published after the pins were set — bumped `PyJWT` 2.13.0 → 2.15.1 (13 advisories) and `urllib3` 2.7.0 → 2.8.0 (3 advisories). `pip-audit -r backend/requirements.txt --strict` now reports no known vulnerabilities.

**Tests:** `docker compose config` renders correctly with the override and fails fast when `JWT_SECRET_KEY` is missing; on the VM all 5 containers healthy, only 80/443 published, register/login/search (TMDB, RAWG, anime/manga) and add-to-library verified in the browser; ruff clean, 27 DB-free backend tests pass on the bumped pins, and an access/refresh token round trip (wrong-type and tampered tokens rejected) passes on PyJWT 2.15.1; site survived a deallocate → start cycle with data and TLS intact.

**Issues/deviations:** The VM is deallocated between demos, so the site is up on demand only. SSH is open to any IP (strong password + fail2ban) because IP allow-listing broke on campus/ISP networks. Google sign-in left disabled on this deployment (email/password works). Older entries below still reference the original AWS Lightsail host (`trakplus.noblechicken.me`) as historical record.

**Next:** Optional — enable Google sign-in for the new domain; nightly DB backup for the Azure VM.

---

## 2026-09-03 — Phase 12: Login redesign, CI/CD auto-deploy, auto-save

**Done:** (1) **Login redesign** — warm cream archive aesthetic with a generated hand-drawn media collage (`login-illustration.png`) showing movies/games/manga/anime/TV, a Create/Login mode toggle, amber accents, and hover-lift animation on every button. Google sign-in returned to the reliable `renderButton` iframe (custom-styled + warm-tinted) and the `/auth/google` backend was hardened to never leak a 500 (logger.exception captures the real cause, controlled 4xx/5xx). (2) **Auto-save** — status persists on click and rating persists on debounce/blur; the Save-changes button is gone; the rating field loads the saved value and `entryIdRef` is synced from the library so a rating always PATCHes the right entry. (3) **Streamlined CI/CD** — `push-images` runs on every push to `main` → ECR (SHA + latest tags); Lightsail `deploy/auto-deploy.sh` (cron every 5 min) polls ECR and redeploys automatically, no manual deploy. Verified end-to-end: Google sign-in works after correctly mapping the Google console origin + the hardened backend.

**Tests:** `cd frontend && npm run build` green; backend `ruff check app/api/auth.py` clean; DB confirmed ratings persist (e.g. 9/7/9 rows). E2E updated for the login mode toggle and auto-save (click status → creates entry + "Added to library").

**Issues/deviations:** GIS `renderButton` iframe can't be recolored directly → CSS filter for warm tint. Google OAuth "origin not allowed" was a console propagation/caching issue (origin was correctly configured); the custom native `prompt()` button triggered a stricter origin check so it was reverted to the reliable iframe. CI initially failed on OIDC/false-positive gitleaks; switched ECR push to AWS access keys and added `.gitleaksignore`.

**Next:** Send the deployed site to the testing team for real-life testing.

---

## 2026-09-03 — Login page redesign for warm archive aesthetic

**Done:** Redesigned the login page to match TrakPlus's archive aesthetic instead of the cold dark "anima" copy. Warm cream background (`oklch(0.934 0.015 90.2)`), editorial serif heading, archive-themed media-shelf/film-reel/clapperboard SVG illustration (replaces the hollow black monitor), amber `--status-active` accents on links and the primary button, and a tonal-amber-tinted Google OAuth button via a CSS filter (keeps the working GIS flow + `google-button` testid intact). Added reusable `fade-up` animation; reused existing orb/grain utilities. **Also completed the streamlined CI/CD pipeline** (ECR push on main → Lightsail `auto-deploy.sh` polls ECR every 5 min) and deployed the app live.

**Tests:** `cd frontend && npm run build` green; login page HTML verifies Create Account / TrakPlus / Or / Email address render. Deployed stack healthy on Lightsail (backend/frontend/postgres/redis/caddy all healthy).

**Issues/deviations:** GIS `renderButton` renders a white iframe that can't be recolored directly — used a CSS filter to warm-tint it. Deploy required fixed `.env.lightsail` (CORS quoting) and compose CORS override to keep the backend healthy.

**Next:** User review of the new login look; verify Google sign-in visually on the live site.

---

## 2026-09-03 — Housekeeping: gitignore hygiene + docs sync (v1.1)

**Done:** Tagged/committed/pushed deploy work as **v1.1** (`6aa45a6`). Updated `.gitignore` with a "Local agent tooling / scratch" section — `.commandcode/`, `scratchpad/`, and `/NUL` (Windows device-name artifact) are now ignored; stray `NUL` file deleted. README repo-layout notes the gitignored local dirs.

**Tests:** `git status` clean apart from tracked changes; `.commandcode/` + `scratchpad/` no longer surface as untracked.

**Issues/deviations:** none.

**Next:** (none pending.)

---

## 2026-09-03 — Deploy UI Enhancements to Lightsail (live)

**Done:** Redeployed the stack to the Lightsail box (`deploy/deploy.sh`, HEAD `0fb112f`) — frontend/backend images rebuilt, Alembic migrations applied (episode descriptions/thumbnails, playtime/duration), all 5 containers healthy. Live site verified: `https://trakplus.noblechicken.me/health` → 200 ok, `/library` 200, `/` → `/login` 200.

**Tests:** On-box `docker compose` healthchecks green; external curl of health + pages 200.

**Issues/deviations:** (1) `deploy/.env.lightsail` had placeholder values — replaced with real DB password/API keys (kept out of git). (2) `deploy.sh` step 5 health check was broken for HTTPS sites (`curl http://localhost/health` → 308, JSON parse failed) — fixed to derive the site address from `.env.lightsail` and follow redirects with `-k` on https. (3) Caddy container had a wedged `docker exec` runtime state (`procReady not received`) causing it to show "unhealthy" while still proxying — fixed with `docker compose up -d --force-recreate caddy`.

**Next:** (nothing pending — E2E re-verify on the live box if UI core flow changes).

---

## 2026-09-03 — UI Enhancements: Schedule, Analysis, Playtime & Progress Features

**Done:** Major UI enhancements across multiple pages: (1) **Schedule page** redesigned with visual cards featuring poster thumbnails, date badges, color-coded type indicators (movie vs episode), and animated counters. (2) **Analysis page** rebuilt as a dashboard with animated counters, spring-physics bar charts, and SVG donut chart for media type distribution. (3) **Playtime tracking** for games with editable hours/minutes input and persistence. (4) **Season-based episode selector** with dropdown and "Watch all in season" checkbox. (5) **Auto-complete episodes** when status changes to "completed". (6) **Library progress indicator** showing watched/total for series and playtime for games. (7) **Visual feedback** for status selection with enhanced toggle styling.

**Tests:** Frontend build green, manual verification of all new features.

**Issues/deviations:** Initial playtime wrapper was defined in server component causing `useQuery` error — fixed by extracting to separate client component with "use client" directive.

**Next:** Deploy to Lightsail and verify live.

---

## 2026-09-02 — Phase 10: Dynamic Archive Poster Grid & Motion Redesign

**Done:** Completely overhauled the frontend library and navigation experience: (1) Replaced flat table rows with a responsive 6-column golden-ratio poster grid (Amazon/Letterboxd style) with single gold star ratings (`★ 10`) and dedicated OKLCH status theme badges. (2) Replaced pitch-black sidebar with a warm ivory/sand tone matching the cream palette (`oklch(0.912 0.016 86)`), removed T logo per request, boosted icon contrast to 75%–100%, and added Anime.js spring physics with floating tooltip pills. (3) Built a living interactive ambient background (`ambient-background.tsx`) featuring an HTML5 Canvas with floating amber/gold particles, cursor gravitational interaction, constellation threads, and luminous aurora spheres tuned for high visibility in both light and dark modes. (4) Fixed profile dropdown email misalignment with dedicated card container, and styled the Sort dropdown (`<select>` and `<option>`) for dark/light visibility and contrast.
**Tests:** Frontend Vitest unit tests pass; verified visually across multiple browser subagent sessions in both light and dark modes with captured screenshots.
**Issues/deviations:** Initial light mode background particles lacked contrast against the `#EDE9DE` cream background; tuned particle palette to rich amber (`rgba(180, 83, 9, 0.85)`), terracotta, and gold with luminous peach/sage aurora gradients.
**Next:** User review and verification.

---

**Done:** Completely overhauled the frontend to strictly follow the TrakPlus Stitch "Archive Aesthetic". Replaced the blue spotlight gradient with a solid Archive Cream background and Charcoal sidebar. Removed brutalist drop-shadows and spring translations from buttons. Converted status badges to hairline outlines with small-caps Geist sans typography. Transformed library entry cards into a dense, spec-sheet style list with bottom hairline borders, while retaining `anime.js` for subtle hover background interactions.
**Tests:** N/A (CSS and component classname changes only).
**Issues/deviations:** Initial redesign deviated heavily from the Stitch spec by incorporating generic "brutalist" shadows and blue glows. A secondary visual audit realigned the UI to the exact Stitch JSON token values (zero radius, hairline borders, dense editorial typography).
**Next:** End of redesign task. Review the changes visually to ensure they match the Archive aesthetic.

---
## 2026-09-02 — Auth rate limiting + full-suite green (backend 118, frontend 16)

**Done:** Implemented per-IP fixed-window rate limiting on all four unauthenticated auth endpoints (`/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/google`) — Redis INCR/EXPIRE counter keyed `ratelimit:{scope}:{ip}:{bucket}`, limit `AUTH_RATE_LIMIT_PER_MINUTE` (default 10/min, 0 disables), `Retry-After` header on 429, scopes isolated, and Redis outages fail open so an unavailable limiter never blocks logins. Added `app/core/rate_limit.py` (dependency-factory) + wiring in `app/api/auth.py`, `backend/tests/test_rate_limit.py`, and made the shared `api_client` fixture rebind the limiter disabled (limit 0) so suite tests are never throttled. Closes the design.md §5b v2-backlog hardening item. Also ticked the UX-fixes 📝 checkpoint (already-coded fixes were verified on this tree).

**Tests:** Backend **118/118** passed (109 prior + 9 new rate-limit tests), ruff check + format clean. Frontend **16/16** Vitest, eslint clean, and `next build` green — run with `NODE_ENV=test` because this shell exports `NODE_ENV=production`, which makes React load its production build and throw `act(...) is not supported in production builds`.

**Issues/deviations:** Frontend component tests were failing with `React.act is not a function`. Root cause: `react@19.2.8` no longer exports `act` from its main entry, breaking `@testing-library/react@16.3.3` (which calls `React.act` on React 19). Pinned `react`/`react-dom` to **19.0.8** (the `backport` line, same 19.x as the React RTL was validated against), verified its CJS entry does `exports.act`. Locally, `npm install`/`npm ci` also skipped devDependencies because this machine's npm config has `omit=dev` (orphaned `userconfig` — no `.npmrc` file exists) — worked around with `npm ci --include=dev`. No deployment performed.

**Next:** commit this working tree when ready; rate limiting can be smoke-tested live (11 rapid bad logins from one IP → 429).

---

## 2026-09-02 — Search history, episode metadata, notes, and schedule

**Done:** Search URLs now retain `?q=` for browser back/reload, recent queries are stored locally (newest first, capped at 8), and detail back navigation uses browser history. Episode sync persists provider descriptions/thumbnails, NotesRail hydrates existing entries after the library query resolves, and schedule merges planned title release events with unwatched dated episodes across media types.

**Tests:** Backend 109/109, Ruff clean, local Alembic upgrade applied; frontend 16/16 Vitest, lint, and Next production build green.

**Issues/deviations:** Episode details depend on provider data; AniList/MangaDex may not supply thumbnails/descriptions, and future episode events appear after the title is synced. No deployment was performed.

**Next:** Smoke-test a planned game/movie and a synced TV title in the browser; deploy only when explicitly requested.

---

## 2026-09-02 — Fix: title detail crash and cover proxy path

**Done:** Made `proxiedImageUrl()` safe during server rendering and preserved relative API prefixes, so production `/api` deployments now request covers through `/api/img` instead of browser-only `window` plus `/img`.

**Tests:** Added 3 URL-helper regressions; frontend 15/15 Vitest, lint, and production build passed. Graphify refreshed. Existing running containers were not rebuilt during this source-only validation.

**Next:** Rebuild/restart the deployed frontend image so the fix is live, then smoke-test one result from each media source.

---

## 2026-09-02 — Fix: local Google OAuth configuration

**Done:** Local Compose now passes `GOOGLE_CLIENT_ID` into the backend, matching the frontend build variable. Google callback failures now display the backend error in a toast instead of failing silently.

**Tests:** Rebuilt the local stack; both Google client ID variables are present without exposing their values. Frontend lint, 15/15 Vitest, and production build passed. The backend previously returned 503 “not configured”; configuration wiring is now present.

**Next:** Click the Google button at `http://localhost:3000/login` and complete sign-in; Google Cloud Console must list `http://localhost:3000` as an authorized JavaScript origin.

---

## 2026-09-02 — Fix: Google token clock skew

**Done:** Reproduced Google OAuth’s `ImmatureSignatureError`: the token `iat` was slightly ahead of the verifier clock even though host and container clocks matched. Added a 60-second PyJWT leeway while retaining RS256 signature, audience, issuer, and email verification.

**Tests:** Rebuilt the backend container; backend auth tests pass 22/22, Ruff passes, and the container health check is green. The prior environment-isolation test was made deterministic by explicitly clearing the Google client ID in that test.

**Next:** Retry Google sign-in locally; successful sign-in should redirect to `/library`.

---

## 2026-09-02 — Diagnose missing sources and episode sync

**Done:** Reproduced missing results and sync failures. Local Docker outbound access returns RAWG/MangaDex `403` and TMDB connection failures; `breaking bad` now returns the expected TMDB TV result. Added explicit local-only SSL configuration, sanitized source error logs, and converted episode upstream failures from `500` to `502`.

**Tests:** Local stack rebuilt and healthy; targeted backend tests 16/16 and Ruff passed. The remaining RAWG/MangaDex access issue requires a valid provider response/network path; TMDB episode sync should be smoke-tested on Lightsail where production TLS verification remains enabled.

**Next:** Verify the RAWG key in local `.env`, then deploy/smoke-test the TV episode flow on Lightsail.

---

## 2026-09-02 — Nightly S3 backup wired on the live box (round-trip verified)

**Done:** Created scoped IAM user `trakplus-backups` (inline policy: PutObject/ListBucket/HeadBucket on `trakplus-backups` only) + bucket with public-access-block; no admin creds shipped to the box. Installed aws CLI v2 on the Lightsail box + configured the scoped creds (`~/.aws/credentials`, 0600). Ran `deploy/backup.sh` live — dump streamed to `s3://trakplus-backups/` (240 KB). Restore round-trip verified: `pg_restore` into throwaway DB → exact `count(*)` identical across all 7 tables. Wired nightly cron `30 2 * * *` (`PATH=/usr/local/bin:/usr/bin:/bin`, logs `/var/log/trakplus-backup.log`; script already executable).

**Tests:** backup smoke test passed; restore round-trip counts identical (titles 372, episodes 237, users 3, library_entries 6, progress 0, watch_providers 0, alembic_version 1. Local suites unchanged: backend 105/105 + ruff clean (re-verified 2026-09-02), frontend lint/vitest 12/12/build green.

**Next:** first full-month Lightsail cost review (early Oct); optional v2 backlog items (quota monitoring, PWA).

---

## 2026-09-01 — Three-column detail layout + NotesRail

**Done:** Restructured the title detail page to a three-column grid on desktop (info panel / main content / notes rail) with `lg:sticky` columns. Built `NotesRail` client component — queries the library, finds the entry for this title, shows an editable textarea for personal notes, saves via PATCH (same bff path as status/rating). Left panel: poster + badges + AddToLibrary. Center: synopsis + genres + providers + cast + progress. Right: notes rail with "Add to library to leave notes" hint when unowned.

**Tests:** frontend lint clean, 12/12 vitest, build OK (ƒ /titles/ route unchanged). E2E flow passing.

**Next:** [none — all planned features shipped]

---

## 2026-09-01 — Schedule + Analysis pages, schedule API (105 backend tests)

**Done:** New `GET /schedule` endpoint — joins the user's library → episodes with `air_date`, excludes watched + completed/dropped entries, splits into upcoming / backlog (default 30-day lookback). Pydantic response models. Added `/schedule` (week-grouped upcoming + backlog) and `/analysis` (status bars, media-type bars, avg rating, highest-rated) pages, both wired into the sidebar rail. New `tests/test_schedule.py` (6 tests: empty, upcoming, watched-excluded, backlog, completed-excluded, data-isolation).

**Tests:** backend **105/105** + ruff clean (check + format); frontend lint clean, 12/12 vitest, build OK (16 routes: + /analysis /schedule); E2E flow passing (9.6s).

**Next:** three-column detail layout (notes rail); wire backup cron on the box; first full-month cost review.

---

## 2026-09-01 — New pages: Directory, Settings, New Entry dialog; sidebar nav expanded

**Done:** `/directory` (all entries + title search + media/status filter chips), `/settings` (account identity, JSON/CSV export, logout), `NewEntryDialog` on the library page (search → pick title + status → continue to detail). Sidebar rail now has Library, Search, Settings links + theme toggle. Lint zero problems; build routes up to 14.

**Tests:** backend 99/99 + ruff clean; frontend 12/12 vitest; E2E flow passing (8.6s); all new routes return 200 live.

**Next:** Schedule/Calendar view (needs per-source airing dates — AniList airingSchedule is the best source); Analysis/Stats (library data suffices for status breakdown + ratings; hours need duration backfill).

---

## 2026-09-01 — Image proxy + MangaDex episode fallback + dark mode

**Root causes found:** (1) Manga covers "broken": MangaDex's CDN serves cover bytes with `vary: Referer/Origin` and challenges browser subresource requests from some ISPs (one network was a FortiGate TLS-intercepting firewall actively returning a "Web Filter Violation" page for RAWG + MangaDex). URLs themselves are valid — verified 10/10 from the Lightsail box. (2) Episode lists empty for manga: MangaDex legitimately has **0 English chapters** for much of its licensed catalog, so the `translatedLanguage[]=en` feed returns 0 and sync created nothing; older E2E runs never noticed because their titles' episodes were already in the DB.

**Fixes:** (1) new backend **image proxy** `GET /img?url=` — strict https host allowlist (mangadex/rawg/tmdb/anilist), 7-day immutable browser cache, SSRF-guarded; frontend `proxiedImageUrl()` routes all covers (search, library, detail, cast) through it. (2) MangaDex client falls back to **any language** when EN chapters are 0; ProgressTracker shows "No chapter/episode data available" instead of looping on the sync button; `publicApi` gained a method param (POST for sync) with `media_type` threaded through. (3) **Dark mode toggle** (next-themes, system default) added to the sidebar rail via hydration-safe `useSyncExternalStore` mount check.

**Tests:** backend 99/99 + ruff clean (image proxy live-tested: 200 image/png via proxy, 400 for non-allowlisted host); manga sync now creates 17 chapters for the previously vi-only title; frontend lint clean, 12/12, build OK; E2E flow passing; theme-toggle verified in the live bundle.

**Next:** Directory page; Schedule view; Analysis/Stats; Profile/Settings; New Entry modal; three-column detail layout.

---

## 2026-09-01 — Frontend redesign landed: archive theme + 3 regressions fixed

**Done:** Redesign committed (dark sidebar rail, cream OKLCH theme, Source Serif 4 headlines, hairline rows, radius 0). Deep-dive found 3 regressions in it: (1) sidebar dropped `user-menu`/`logout-button` testids → E2E died at logout; (2) episode sync sent **GET** (`publicApi` had no method param) and never passed required `media_type` → 405/400, "Load episode list" never worked from the browser; (3) flow test blindly clicked the first search result — TMDB ordering shifted to a movie (no episodes). All fixed.

**Tests:** E2E flow **3 consecutive passes** (17.9s/17.8s/17.2s) against compose; backend 99/99 + ruff clean; frontend lint clean, 12/12 vitest, production build OK. Redeployed to Lightsail — sidebar/serif/hairline theme verified live.

**Issues/deviations:** CI run #13 failed on the redesign commit (regressions above) — fixed in b3a2c48. Docs synced: frontend-handbook (AppHeader→AppSidebar/AppLayout, implemented theme), plan/todos/design/budget/report already current.

**Next:** dark-mode toggle UI (CSS vars exist, switch missing); Analysis/Stats page; nightly backup cron on the box.

---

## 2026-09-01 — Fix: search results blank (publicApi + relative URL)

**Root cause:** `frontend/src/lib/client/api.ts` `publicApi()` used `new URL()` which **throws a TypeError on a relative URL**. After the Caddy proxy change, `NEXT_PUBLIC_API_URL=/api` (relative) — so `/api/search?...` threw `Invalid URL` and the fetch never fired → search/library/title pages stayed blank despite the API working. Reproduced with a headless Playwright check (0 result cards, no `/api/search` request, only a 401 on `/auth/me`).

**Fix:** `publicApi()` now resolves relative bases against `window.location.origin` (`base.startsWith("http") ? new URL(base+path) : new URL(base+path, location.origin)`). Uploaded + rebuilt the frontend image on the box, recreated the container.

**Verified:** headless browser loads `/search`, types `dune`, and renders **32 result cards**; network log shows `/api/search?q=dune&type=all` → 200.

---

## 2026-09-01 — Fix: Google sign-in root cause (missing `cryptography`)

**Root cause:** Backend returned 503/401 on `/auth/google` with log "google id_token verification failed unexpectedly". Deep-dive with a diagnostic script inside the container revealed `jwt.exceptions.MissingCryptographyError: RS256 requires 'cryptography' to be installed`. PyJWT needs the `cryptography` package to verify Google's RS256-signed JWKS id_tokens; it was absent from `requirements.txt` (only PyJWT + bcrypt present). The exception isn't an `InvalidTokenError`, so the generic handler masked the real error.

**Fix:** Added `cryptography>=42.0` to `backend/requirements.in` and `cryptography==44.0.0` to `backend/requirements.txt`, uploaded, rebuilt the backend image on the Lightsail box, recreated the container. Verified in-container: cryptography 44.0.0 installed, JWKS fetch returns 4 Google signing keys, backend returns proper 401 (not 503). Also fixed earlier: backend env missing `GOOGLE_CLIENT_ID` (added to `deploy/docker-compose.lightsail.yml`).

---

## 2026-09-01 — Custom domain + HTTPS live: trakplus.noblechicken.me

**Done:** DNS propagated (trakplus.noblechicken.me → 13.234.124.180). Caddy updated to use `CADDY_SITE_ADDRESS=https://trakplus.noblechicken.me` and CORS adjusted. Let's Encrypt cert issued successfully via TLS-ALPN challenge. Verified: HTTPS `/health` → `{"status":"ok"}` · search · frontend. HTTP → HTTPS auto-redirect working. Old IP (13.234.124.180) → 308 redirect to HTTPS domain.

**One manual step remaining:** add `https://trakplus.noblechicken.me` to the Google OAuth client's Authorized JavaScript origins in Google Cloud Console.

---

## 2026-09-01 — Phase 9: Lightsail DEPLOYED LIVE (~$12/mo)

**Done:** Provisioned Lightsail Small (`trakplus`, small_3_1, ubuntu_24_04, ap-south-1a) + static IP **13.234.124.180** + ports 22/80/443. SSH key pair `trakplus-lightsail` created (PEM at `~/.ssh/trakplus-lightsail.pem`). Docker 29.7.2 + Compose v5.5.0 installed on the box. Repo uploaded (tar-over-ssh; deploy.sh switched off rsync for Windows compat), `.env.lightsail` generated from `.env` + strong DB password. Full stack up behind Caddy: backend + frontend + postgres + redis + caddy all healthy.

**Verified live:** `/health` → `{"status":"ok","environment":"production"}` · `/api/search?q=naruto` → 49 TMDB results · `type=game` → RAWG results · `type=anime` → AniList results · user registration via BFF works (smoke user created in Postgres on the box) · frontend serves 200. Found + fixed Caddy bug: `/api/*` must use `handle_path` (strip prefix) so FastAPI sees `/search` not `/api/search`; `/health*` routed to backend.

**EKS teardown:** staging stack `terraform destroy`-ed (all 55 resources: EKS cluster, node group, RDS, ElastiCache, ECR, NAT, VPC, IAM) — saves ~$190/mo. One transient DNS error mid-destroy; re-run finished cleanly.

**Next:** optional custom domain + Caddy auto-TLS; nightly `deploy/backup.sh` cron on the box; commit deploy/ + doc updates.

---

## 2026-09-01 — Phase 9: Lightsail single-box deployment (budget v2)

**Done:** New `docs/budget.md` (authoritative: Lightsail Small, ~$12–13.50/mo) supersedes report.md §9. Implemented the deploy path: `deploy/Caddyfile` (reverse proxy: /api/bff/* + /api/auth/* → frontend, /api/* → backend, rest → frontend), `deploy/docker-compose.lightsail.yml` (adds Caddy, internalizes service ports, prod env), `deploy/{provision,deploy,backup,teardown}.sh` + `.env.lightsail.example`. Fixed frontend `Dockerfile` to declare `ARG NEXT_PUBLIC_API_URL` (CI's `build-args: NEXT_PUBLIC_API_URL=/api` was silently ignored before) and made `CORS_ORIGINS` env-configurable in base compose. README + report.md §9 + todos.md Phase 9 updated; EKS/Terraform kept as portfolio code.

**Tests:** `docker compose -f docker-compose.yml -f deploy/docker-compose.lightsail.yml --env-file deploy/.env.lightsail.example config` validates clean (Caddy wired, env flows correct). Backend/frontend suites unchanged (99 + 12).

**Issues/deviations:** Compose array merge means base host ports (3000/8000/5433/6379) still publish inside the box — safe because the Lightsail firewall only opens 22/80/443. Budget doc's "3TB transfer" is actually 1.5TB on `small_3_1` — irrelevant at our scale.

**Next:** user runs `deploy/provision.sh` → fills `deploy/.env.lightsail` → `deploy/deploy.sh`; then destroy the idle EKS staging stack (~$190/mo saved immediately).

---

## 2026-09-01 — Project audit: full test suite, docs drift repair, encoding fix

**Done:** Ran full test suites (backend 99/99, frontend 12/12). Frontend lint warnings fixed (2 unused imports in import-export-toolbar.tsx). Production build verified (12 routes, clean). Live API endpoints confirmed matching README docs. Mojibake in progress.md fixed (em-dashes, checkmarks, arrows, section signs, emoji). README test count updated (85 -> 99).

**Drifts fixed:** design.md §2 router list (per-domain movies/tv/games/anime/manga -> unified search/titles/health/progress). design.md §2 cache TTL (12h watch-provider -> 24h with TMDB bundled). .planning/codebase STACK.md (".github/workflows/, currently empty" -> full ci.yml). .planning/codebase TESTING.md (~83 -> 99 tests). todos.md Phase 0 API key registration (now verified done).

**Tests:** backend 99 passed, 81% coverage, ruff clean; frontend 12/12 vitest, lint clean, build clean. Docker compose stack healthy.

**Next:** Continue with any feature work or address the v2 backlog items (TMDB/RAWG quota monitoring, PWA).

---

## 2026-08-31 — Phase 4: Import/export

**Done:** Trakt-compatible export + generic CSV/JSON import (design.md §6). New `app/api/import_export.py` + `app/services/{export_service,import_service}.py` + `app/schemas/import_export.py`. Endpoints: `GET /library/export?format=json|csv` (attachment download, Trakt schema: history/ratings/watchlist with movie/show + ids), `GET /library/export/template` (CSV template), `POST /library/import` (auto-detects JSON vs CSV, dedup by (user,title), per-row errors never silently dropped).

**Tests:** 14 new tests (99 total backend). Covered: JSON export shape, CSV export, plan_to→watchlist mapping, JSON+CSV import, malformed JSON → 400, empty file → 400, unknown external ID → per-row error, duplicate → skipped, **round-trip** (A exports → B imports → clean). Frontend: 12 vitest still green. ruff + format clean.

**Issues/deviations:** Trakt has no anime/game/manga types — mapped anime→`show` (via AniList/MAL ids), games/manga fall back to `movie` type for portability (documented in export_service docstring). Import precedence: rated→history→watchlist so a title rated *and* watched becomes `completed`, not `watching`. CSV uses `utf-8-sig` (tolerates BOM from Excel exports). Dead `_parse_trakt_item` helper removed.

**Next:** Phase 6 (AWS infra via Terraform) — needs AWS credentials. Or Phase 3 bonus polish. Open items unchanged: TMDB/RAWG keys, real JWT/Google secrets.

---

## 2026-08-31 — E2E CI iteration 3: Missing migrations on fresh Postgres volume

The E2E job failed on run #4 with the same exit code 4 as run #3. `docker compose down -v` wipes the Postgres volume, but the compose backend started `uvicorn` directly — no `alembic upgrade head` — so the `users` table didn't exist. Register returned a 500 that curl`s -f` suppressed into a cryptic jq exit 4.

**Fix (2 files):**

1. `backend/Dockerfile` — added `COPY alembic.ini ./` and `COPY alembic ./alembic` (the image had only `app/`, so migrations couldn't run even if called).
2. `docker-compose.yml` — backend `command:` now runs `alembic upgrade head && exec uvicorn ...` on startup. Deliberately *not* in the Dockerfile CMD: the CI smoke test runs the image with no DB and must still serve `/health`.

**Verified:** `docker compose down -v` (fresh volume) → up → register + login both succeed. All 6 tables present. CI smoke test (no DB) still returns `/health` 200. actionlint: 0 findings.

**Next:** user commits + pushes → expect green CI (finally).

---

## 2026-08-31 — Phase 5 (CI iteration 2): infra-modules audit over-checked local-only files

2nd real CI run revealed the `infra-modules` job's structure audit required `terraform.tfvars` per env, but those files are gitignored (per-developer local dev values, not a structural artifact). The error duplicated for staging + prod, hence the "2 errors" in the UI.

**Fix:** the structure audit now checks `main.tf`, `backend.hcl`, and a tracked `terraform.tfvars.example` per env (the negation pattern already in `.gitignore` was aspirational). Added two tracked `terraform.tfvars.example` files (staging, prod) with sensible placeholders — also gives future devs a starting point. actionlint: 0 findings.

**What I learned:** my "all env files tracked" assumption was wrong — `.tfvars` was correctly gitignored from the start. The audit should test structure (tracked files) not local dev state. Same principle will apply to any future structural check.

**Next:** user commits + pushes → expect green CI.

---

## 2026-08-31 — Phase 5 (CI iteration 1): First real CI run — 3 failures found & fixed

The repo was pushed to GitHub (`NobleChicken97/trakPlus`) and CI ran for real. Three genuine failures surfaced:

1. **vitest `test-results.json` not written** — `--outputFile` only works when a JSON reporter is active; `--reporter=default` alone silently skips it. **Fix:** added `--reporter=json` alongside `--reporter=default` (verified locally: file written, count 12).
2. **gitleaks flagged `JWT_SECRET_KEY=ci-smoke-key-...`** in the backend smoke-test step as `generic-api-key`. **Fix:** removed the env var entirely — the smoke test only checks `/health` (liveness, no auth), verified still 200 locally.
3. **Terraform checksum mismatch on CI** — committed `.terraform.lock.hcl` files (generated on Windows) contain only `windows_amd64` hashes, so `terraform init` on the Linux runner failed. `terraform providers lock` stalled on this machine's registry connection (slow download). **Fix:** stop committing lock files during the skeleton phase (gitignore + rationale in `infra/README.md`); CI regenerates a fresh Linux lock per run. Re-introduce committed multi-platform locks (via `providers lock`) in Phase 6. Note: this is a deliberate, documented deviation from Terraform's "commit the lock" recommendation, justified while modules are empty.

**Tests:** vitest+coverage command re-verified locally (12/12). Backend smoke 200 with no env overrides. Terraform simulate-init left unverified locally only because the registry download stalls on this connection — logic is sound (empty modules, fresh lock per run). actionlint: 0 findings.

**Issues/deviations:** `git check-ignore` reports tracked files as non-ignored until the deletions are committed — expected. Disk hit a transient 0-byte-free state during the session (freed 2.5 GB of Terraform provider caches; recovered to ~47 GB).

**Next:** user commits these 4 files (ci.yml, .gitignore, infra/README.md, lock deletions) and re-pushes → expect green CI.

---

## 2026-08-31 — Phase 5 (partial): Single consolidated CI workflow

**Done:** Consolidated the 5 existing workflows (`backend.yml`, `frontend.yml`, `infra.yml`, `security.yml`, `e2e.yml`) into **one** `.github/workflows/ci.yml` — 13 jobs, so GitHub shows exactly **one** action. GSD codebase map + docs updated.

**Key fixes (each verified locally before writing):**
- **Node 24 migration**: GitHub removed Node 20 action support Sept 2026 — old v4/v5/v6 actions would die. Bumped to current majors: checkout@v7, setup-python@v7, setup-node@v7, upload-artifact@v7, setup-buildx@v4, build-push@v7, setup-terraform@v4, gitleaks@v3.
- **e2e.yml cross-job bug**: integration + e2e were separate jobs assuming the compose stack carried over — jobs run on *different runners*, so it silently rebuilt twice. Merged into one `e2e` job (compose up once, curl contract checks + Playwright together).
- **backend smoke crash**: used `sqlite+aiosqlite:///` but `aiosqlite` isn't a dependency — engine creation would fail on boot. Now runs on defaults (liveness `/health` needs no DB); verified 200.
- **pip-audit false positives**: scanning the env flagged `setuptools` CVEs from the runner's bundled tooling. Now `pip-audit -r backend/requirements.txt --strict` → verified **0 CVEs**. Also added `pip/setuptools` upgrade to the backend Dockerfile builder stage (same CVE class in the shipped image).
- **vitest coverage**: `--coverage` requires `@vitest/coverage-v8`; added it (exact-pinned to vitest version). Fixed test-count step that masked failures with `|| true`.
- **hadolint-action is unmaintained (Node 16/20)** → run hadolint via the official docker image directly.
- **`ruff format --check` was failing** → ran `ruff format .` (15 files), all 85 tests still green.
- **`terraform fmt -check` failing** on `terraform.tfvars` → ran `terraform fmt -recursive infra/`, re-validated all environments.
- Gitleaks to v3 (Node 20 runtime), dead routes/typecheck steps removed; workflow validated with **actionlint — 0 findings**.

**Tests:** All CI commands re-verified locally: backend 85/85, ruff clean (check + format), alembic chain + `alembic check` (no drift), coverage ~86%, frontend 12/12 vitest w/ coverage, eslint 0, tsc clean, next build ✓, hadolint (DL3066/DL3013 only, intentional), npm audit 0 vulns, docker sizes backend 88 MB / frontend 68 MB, both smoke tests 200.

**Issues/deviations:** `.gitignore` updated (Playwright/test artifacts). Live AniList search in the e2e job is keyless but depends on upstream availability. `infra/` CI validates only — deploy stays manual until Phase 6/7.

**Next:** Finish Phase 5 requires the repo actually on GitHub — `git init` + first push (user decision), then confirm red-on-bad-code blocking. Then Phase 4 (import/export) or Phase 6 (Terraform AWS).

---

## 2026-08-31 — Phase 3: Frontend MVP

**Done:** Full MVP UI on Next.js 16 (App Router, src/, Tailwind v4, shadcn base-nova). **Auth**: httpOnly-cookie BFF (`src/app/api/auth/*` + `src/app/api/bff/[...path]`) — silent refresh on 401, browser never sees JWTs; login/register/Google GIS button (hidden unless `NEXT_PUBLIC_GOOGLE_CLIENT_ID`). **Pages**: search (debounced bar, TanStack Query, grouped by media type), title detail (server-rendered + `generateMetadata`, India stream/rent/buy badges, cast, episode sync + progress tracker), library dashboard (status Tabs, optimistic updates). **Tests**: 12 vitest+RTL component tests (0 backend dependency — fetch stubbed to throw); Playwright E2E of the full journey. Backend additions: internal `id` on TitleDetail, `GET /titles/{src}/{id}/episodes`, `primary_source` properties + explicit `LibraryEntryRead` serialization, CORS for :3001. GSD: `.planning/codebase/` map complete (7 docs).

**Tests:** backend 85 passed, ruff clean; frontend lint clean, build ✓, 12/12 component tests; **E2E passed 3 consecutive runs** (todos.md criterion) against live compose. Screenshots: `docs/examples/`.

**Issues/deviations:** 3 real bugs caught by E2E: (1) Base UI prod error #31 — `Button render={<Link/>}` needs `nativeButton={false}`, and `DropdownMenu` parts require a `DropdownMenuGroup` wrapper (minified only decoded via dev-server probe); (2) server components must use runtime `API_URL`, not build-time-inlined `NEXT_PUBLIC_API_URL` (compose now sets both); (3) Pydantic `from_attributes` skips Python properties on SQLAlchemy instances — switched to explicit `_serialize_entry` mapping. Playwright `.check()` can't flip controlled React inputs — use `.click()` + assert. `shadcn init` v4 CLI changed flags (use `--defaults`).

**Next:** Phase 4 — Trakt-compatible export (CSV+JSON), CSV/JSON import with dedup. Open: TMDB/RAWG keys (movies/TV/games still disabled in search), real JWT_SECRET_KEY + GOOGLE_CLIENT_ID, git/GitHub decision.

---

## 2026-08-30 — Phase 2: Auth + library

**Done:** Auth switched from Cognito/Auth0 to **self-hosted JWT + Google OAuth** (docs updated: design.md §5b new, prod.md, todos.md). Register/login (OAuth2 password flow)/refresh (`type` claim prevents refresh-as-access)/me; Google `id_token` verified via PyJWT `PyJWKClient` (RS256, iss/aud) with account upsert/linking. `get_current_user` dependency protects library+progress; all queries scoped by token user_id. Library CRUD, idempotent progress mark/unmark with per-title episode validation, India provider filtering (`?country=IN` default). Episode sync service (`POST /titles/{src}/{id}/episodes/sync`): TMDB per-season fetches, AniList/Jikan count stubs, MangaDex chapters — idempotent. Migrations: `users.hashed_password` + external-id columns widened 32→64 (MangaDex UUIDs). `LibraryEntry.title` relationship with `lazy="selectin"` (async sessions can't lazy-load).

**Tests:** 83 passed (was 36), 86.1% coverage on `app`, ruff clean. Auth matrix: expired/malformed/missing/wrong-secret/refresh-as-access all 401. Data isolation: B's read/modify/delete of A's entries → 404. Live smoke: register → login → fetch NARUTO → add to library → sync 220 episodes → mark ep1 (count=1) → second user isolation 404 → refresh OK.

**Issues/deviations:** OAuth2PasswordRequestForm required `python-multipart` (added). Tests caught: fake-verify must be sync (run_in_threadpool), MangaDex UUID > varchar(32). Rate limiting on auth endpoints deferred to v2 hardening (documented in design.md §5b). Frontend holds tokens via httpOnly cookie BFF pattern — Phase 3.

**Next:** Phase 3 — frontend MVP: auth flow (JWT + Google button), search UI, title detail pages, library dashboard, episode progress tracker.

---

## 2026-08-30 — Phase 1: Backend core

**Done:** DB schema + Alembic (async template, settings-driven env.py; migration `13f74a4c16e8` with explicit enum `DROP TYPE` in downgrade — autogenerate omits it, which broke re-upgrade). 5 service clients (TMDB/RAWG/AniList/Jikan/MangaDex) normalized into source-agnostic Pydantic schemas, wrapped in a Redis cache-aside `CacheLayer` (24h/1h TTLs, degrades on Redis failure/corrupt entries). Unified `/search` fan-out with per-source error isolation; `/titles/{source}/{external_id}` upserting into the `titles` table. Key-gated sources (TMDB/RAWG) auto-disable without keys. Jikan backoff on 429; RAWG request counter (class+instance).

**Tests:** 36 passed, 87.7% coverage on `app/services` (criterion ≥80%), ruff clean. Live smoke: rebuilt backend container → `/search?q=naruto` returned 20 real AniList results; `/titles/anilist/20` fetched NARUTO and persisted a `titles` row (verified via psql). Round-trip verified: alembic downgrade → upgrade clean.

**Issues/deviations:** external ids stored as dedicated indexed columns (not one JSONB dict per design.md §3) for indexed lookups — design.md updated accordingly. Dev DB port moved to host 5433 (native Windows Postgres owns 5432). Real bugs caught by tests: missing `get_redis` import in registry, AniList `season` enum ≠ season count (not mapped), MangaDex wrapper-`data` handling. Live TMDB/RAWG tests still blocked on API keys. CI-container test run deferred to Phase 5.

**Next:** Phase 2 — auth (Cognito/Auth0 or self-hosted JWT), protect endpoints, `library_entries`/`progress` CRUD, watch-provider India filtering.

---

## 2026-08-30 — Phase 0: Foundations scaffold

**Done:** monorepo scaffolded (`backend/`, `frontend/`, `infra/`, `scripts/`, `.github/workflows/`, `docs/`; all prior root docs moved into `docs/`). Backend: FastAPI with `/health` (liveness) + `/health/ready` (DB+Redis checks), `app/{api,core}` structure per design.md §2, deps pinned via pip freeze. Frontend: Next.js 16.3.3 (TS, App Router, Tailwind v4, `src/`, standalone output for Docker). Dockerfiles (multi-stage, non-root) + docker-compose (postgres:17, redis:7). Terraform skeleton (6 placeholder modules per design.md §7, staging/prod environments, remote-state bootstrap guide in `infra/README.md`). `.env.example`, `.gitignore`, README, root `AGENTS.md`. `scripts/check_apis.py` — one real request against all 5 external APIs.

**Tests:** backend pytest 2/2 passed; ruff clean. `terraform init`/`validate` green for root + staging + prod (local backend; remote-state block prepared but commented until AWS bootstrap). `docker compose up --build`: all 4 containers healthy, `/health` 200, `/health/ready` 200 (database ok, redis ok), frontend HTTP 200 on :3000.

**Issues/deviations:** compose runs production builds (Next `output: standalone`) instead of dev servers — intentional, avoids Windows bind-mount file-watching issues; revisit in Phase 5 if dev-mode compose is wanted. Terraform remote state not activated — blocked on AWS credentials (bootstrap steps in `infra/README.md`). Docker Desktop was not running; started it to verify the stack. FastAPI readiness endpoint returns `JSONResponse` (tuple `(dict, status)` return shape failed response validation — caught by test).

**Next:** user actions: TMDB/RAWG API keys (then `python scripts/check_apis.py`), AWS creds for remote-state bootstrap, decision on git init + GitHub push. Then Phase 1: DB schema + Alembic, service clients for TMDB/RAWG/AniList/Jikan/MangaDex with Redis cache-aside.

---

## 2026-09-01 — Phase 6: AWS Terraform modules (code-complete)

**Done:** All 6 Terraform modules written with real HCL (previously placeholders). Network (VPC, 2-AZ subnets, IGW, NAT, 5 SGs), RDS (Postgres 17, db.t4g.micro, encrypted), Elasticache (Redis 7, cache.t4g.micro), ECR (backend + frontend repos, lifecycle policy), IAM (GitHub OIDC + ECR push + pod execution roles), EKS (cluster v1.31, SPOT node group, ALB controller IAM). All modules validated with terraform init -backend=false + validate.

**Next:** Phase 7 CI/CD (ECR push + deploy), Phase 8 observability.

---
## 2026-09-01 — Phase 7: Full CI/CD to EKS (code-complete)

**Done:** Extended ci.yml with deploy chain: push-images (ECR build+push via OIDC), deploy-staging (kubectl apply + ALB smoke test), deploy-prod (gated by environment protection rules — required reviewers in repo settings). K8s manifests in k8s/ (backend + frontend Deployments, Services, ALB Ingress, namespace, ConfigMap). Prod Terraform workspace verified as independent root module. actionlint: 0 findings. All blocked on AWS bootstrap.

**Next:** Phase 8 observability (Prometheus, Grafana, alerts, load test, architecture diagram).

---
## 2026-09-01 — Phase 8: Observability + polish (code-complete)

**Done:** Prometheus metrics wired into backend (prometheus-fastapi-instrumentator at /metrics + custom external-api-call counter per source). Grafana dashboard JSON, Alertmanager + Prometheus alert rules (error-rate, pod crash loops, DB down), AWS Budgets Terraform module ( staging /  prod, wired + validated), k6 load-test script. README updated with full EKS/observability pipeline diagram and all-phase status.

**Retrospective (what shipped):** Phases 0-8 code-complete. Live and verified locally: search across 5 sources, JWT + Google auth, library/progress, import/export, CI green, graphify. Code-complete but blocked on AWS apply: Terraform modules, EKS deploy pipeline, observability.

**Deferred to v2:** TMDB/RAWG live quota monitoring, refresh-token rotation (auth rate-limiting shipped 2026-09-02), frontend import/export full UX polish beyond toolbar, PWA/browser extension.

**Lessons:** test-first caught real bugs (Base UI #31, missing migrations, Pydantic property serialization, vitest reporter); docs drift treated as bug per AGENTS.md; single-workflow CI keeps GitHub clean; 95%-sure rule avoided several rabbit holes.

---
<!-- Add new entries above this line -->


