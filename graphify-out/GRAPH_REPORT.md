# Graph Report - C:\Users\arpan.ARPAN\Desktop\projects\trakPlus  (2026-09-03)

## Corpus Check
- 165 files · ~166,901 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 835 nodes · 1571 edges · 104 communities detected
- Extraction: 56% EXTRACTED · 44% INFERRED · 0% AMBIGUOUS · INFERRED: 684 edges (avg confidence: 0.69)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 97|Community 97]]
- [[_COMMUNITY_Community 98|Community 98]]
- [[_COMMUNITY_Community 99|Community 99]]
- [[_COMMUNITY_Community 100|Community 100]]
- [[_COMMUNITY_Community 101|Community 101]]
- [[_COMMUNITY_Community 102|Community 102]]
- [[_COMMUNITY_Community 103|Community 103]]

## God Nodes (most connected - your core abstractions)
1. `GET()` - 113 edges
2. `POST()` - 72 edges
3. `MediaType` - 53 edges
4. `TMDBClient` - 42 edges
5. `ExternalSource` - 31 edges
6. `AniListClient` - 31 edges
7. `TrakPlus (Multi-Media Tracker)` - 28 edges
8. `LibraryStatus` - 25 edges
9. `get_settings()` - 24 edges
10. `FastAPI Backend (Python 3.11)` - 24 edges

## Surprising Connections (you probably didn't know these)
- `refresh()` --calls--> `title()`  [INFERRED]
  C:\Users\arpan.ARPAN\Desktop\projects\trakPlus\backend\app\api\auth.py → C:\Users\arpan.ARPAN\Desktop\projects\trakPlus\backend\tests\test_isolation.py
- `Export the authenticated user's library as Trakt-compatible JSON or CSV.` --uses--> `ImportResult`  [INFERRED]
  backend\app\api\import_export.py → C:\Users\arpan.ARPAN\Desktop\projects\trakPlus\backend\app\schemas\import_export.py
- `Return a generic CSV template showing accepted columns.` --uses--> `ImportResult`  [INFERRED]
  backend\app\api\import_export.py → C:\Users\arpan.ARPAN\Desktop\projects\trakPlus\backend\app\schemas\import_export.py
- `Episode/chapter progress tracking. Idempotent mark/unmark; per-entry watched cou` --uses--> `ProgressSummary`  [INFERRED]
  backend\app\api\progress.py → C:\Users\arpan.ARPAN\Desktop\projects\trakPlus\backend\app\schemas\library.py
- `Unified cross-source search (design.md §4): fans out across all enabled sources` --uses--> `MediaType`  [INFERRED]
  backend\app\api\search.py → C:\Users\arpan.ARPAN\Desktop\projects\trakPlus\backend\app\models\enums.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (76): AniListClient, _name_of(), _start_date(), BaseClient, _is_allowed(), proxy_image(), Image proxy endpoint — streams external poster/cover images through the backend., JikanClient (+68 more)

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (120): Repo Agent Guidelines (AGENTS.md), graphify-out Knowledge Graph, Rationale: Doc drift treated as bug, Rationale: E2E must pass 3x in a row (anti-flakiness), AniList API (GraphQL), AWS EKS (Kubernetes), scripts/check_apis.py, Docker Compose Local Stack (+112 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (69): refresh(), Episode, Episode (TV/anime) or chapter (manga) of a title (design.md §3).      season=0 i, DELETE(), POST(), _make_token(), Auth suite (todos.md Phase 2): expired / malformed / missing / valid tokens, reg, # NOTE: must be a plain sync function — the endpoint runs it via run_in_threadpo (+61 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (62): AniList client — anime via GraphQL. Search and detail are single round trips (fi, GoogleAuthRequest, Auth endpoints: register, OAuth2 password login, refresh, me, Google sign-in. Se, RefreshRequest, Token, UserCreate, UserRead, BaseClient (+54 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (34): google_login(), _issue_tokens(), login(), register(), BaseSettings, get_settings(), Application settings loaded from environment variables / .env file., Settings (+26 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (32): check(), check_anilist(), check_jikan(), check_mangadex(), check_rawg(), check_tmdb(), main(), client_ip() (+24 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (27): clearAuthCookies(), fastapi(), fastapiForm(), setAuthCookies(), Shared plumbing for external API clients (design.md §2: one client per source)., CacheLayer, Redis cache-aside layer (design.md §2).  Clients hand this a key + TTL + an asyn, api_client() (+19 more)

### Community 7 - "Community 7"
Cohesion: 0.13
Nodes (28): export_csv(), export_trakt(), _media_type_prefix(), Library export — generates Trakt-compatible JSON and generic CSV (design.md §6), Generate a CSV string from the user's library., Map our media types to Trakt's type strings., Build a Trakt-compatible export from the user's library., _trakt_ids() (+20 more)

### Community 8 - "Community 8"
Cohesion: 0.16
Nodes (20): _mangadex_rows(), _stub_rows(), sync_episodes(), _tmdb_rows(), cache_layer(), get_anilist(), get_jikan(), get_mangadex() (+12 more)

### Community 9 - "Community 9"
Cohesion: 0.15
Nodes (9): Base, Base, DeclarativeBase, Progress(), One row per watched episode / read chapter., A tracked media title, cached from an external source (design.md §3).      Exter, First populated external id column, e.g. 'tmdb' — used to build detail URLs., Title (+1 more)

### Community 10 - "Community 10"
Cohesion: 0.26
Nodes (13): add_entry(), delete_entry(), _get_owned_entry(), list_library(), _refetch_entry(), _serialize_entry(), update_entry(), get_progress() (+5 more)

### Community 11 - "Community 11"
Cohesion: 0.31
Nodes (8): _a_entry(), Data isolation (todos.md Phase 2, critical): user A's entries are invisible and, test_b_cannot_delete_a_entry(), test_b_cannot_modify_a_entry(), test_b_cannot_read_a_entries(), test_both_users_can_have_same_title(), test_random_entry_id_404(), title()

### Community 12 - "Community 12"
Cohesion: 0.25
Nodes (3): proxiedImageUrl(), isEpisodeMedia(), LibraryCard()

### Community 13 - "Community 13"
Cohesion: 0.33
Nodes (5): Run migrations in 'offline' mode (emit SQL without a DB connection)., Run migrations in 'online' mode (async engine against the live DB)., run_async_migrations(), run_migrations_offline(), run_migrations_online()

### Community 14 - "Community 14"
Cohesion: 0.33
Nodes (3): fetchTitleServer(), fetchTitle(), generateMetadata()

### Community 15 - "Community 15"
Cohesion: 0.29
Nodes (2): render(), renderWithProviders()

### Community 16 - "Community 16"
Cohesion: 0.33
Nodes (0): 

### Community 17 - "Community 17"
Cohesion: 0.33
Nodes (0): 

### Community 18 - "Community 18"
Cohesion: 0.33
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 0.4
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 0.4
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 0.5
Nodes (1): initial schema  Revision ID: 13f74a4c16e8 Revises:  Create Date: 2026-08-30 20:3

### Community 22 - "Community 22"
Cohesion: 0.5
Nodes (1): add episode descriptions and thumbnails  Revision ID: 7f2c1d9a4b6e Revises: b

### Community 23 - "Community 23"
Cohesion: 0.5
Nodes (1): add playtime and duration tracking  Revision ID: a1b2c3d4e5f6 Revises: 7f2c1d9a4

### Community 24 - "Community 24"
Cohesion: 0.5
Nodes (1): widen external id columns  Revision ID: bec220365eb9 Revises: 4979a28def16 Creat

### Community 25 - "Community 25"
Cohesion: 0.5
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 0.67
Nodes (2): ThemeToggle(), useMounted()

### Community 27 - "Community 27"
Cohesion: 0.5
Nodes (2): Badge(), cn()

### Community 28 - "Community 28"
Cohesion: 0.67
Nodes (2): get_db(), FastAPI dependency yielding an async database session.

### Community 29 - "Community 29"
Cohesion: 0.67
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 0.67
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 0.67
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 0.67
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 0.67
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 0.67
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 0.67
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (1): Application-level Prometheus metrics (in addition to the instrumentor's request

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Community 50"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Community 51"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Community 52"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Community 53"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Community 54"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Community 55"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Community 56"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Community 57"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Community 58"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Community 59"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "Community 60"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "Community 61"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Community 62"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Community 63"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "Community 64"
Cohesion: 1.0
Nodes (0): 

### Community 65 - "Community 65"
Cohesion: 1.0
Nodes (0): 

### Community 66 - "Community 66"
Cohesion: 1.0
Nodes (0): 

### Community 67 - "Community 67"
Cohesion: 1.0
Nodes (0): 

### Community 68 - "Community 68"
Cohesion: 1.0
Nodes (0): 

### Community 69 - "Community 69"
Cohesion: 1.0
Nodes (0): 

### Community 70 - "Community 70"
Cohesion: 1.0
Nodes (0): 

### Community 71 - "Community 71"
Cohesion: 1.0
Nodes (0): 

### Community 72 - "Community 72"
Cohesion: 1.0
Nodes (0): 

### Community 73 - "Community 73"
Cohesion: 1.0
Nodes (0): 

### Community 74 - "Community 74"
Cohesion: 1.0
Nodes (0): 

### Community 75 - "Community 75"
Cohesion: 1.0
Nodes (0): 

### Community 76 - "Community 76"
Cohesion: 1.0
Nodes (0): 

### Community 77 - "Community 77"
Cohesion: 1.0
Nodes (0): 

### Community 78 - "Community 78"
Cohesion: 1.0
Nodes (0): 

### Community 79 - "Community 79"
Cohesion: 1.0
Nodes (0): 

### Community 80 - "Community 80"
Cohesion: 1.0
Nodes (0): 

### Community 81 - "Community 81"
Cohesion: 1.0
Nodes (0): 

### Community 82 - "Community 82"
Cohesion: 1.0
Nodes (0): 

### Community 83 - "Community 83"
Cohesion: 1.0
Nodes (0): 

### Community 84 - "Community 84"
Cohesion: 1.0
Nodes (0): 

### Community 85 - "Community 85"
Cohesion: 1.0
Nodes (0): 

### Community 86 - "Community 86"
Cohesion: 1.0
Nodes (0): 

### Community 87 - "Community 87"
Cohesion: 1.0
Nodes (0): 

### Community 88 - "Community 88"
Cohesion: 1.0
Nodes (0): 

### Community 89 - "Community 89"
Cohesion: 1.0
Nodes (0): 

### Community 90 - "Community 90"
Cohesion: 1.0
Nodes (0): 

### Community 91 - "Community 91"
Cohesion: 1.0
Nodes (0): 

### Community 92 - "Community 92"
Cohesion: 1.0
Nodes (0): 

### Community 93 - "Community 93"
Cohesion: 1.0
Nodes (0): 

### Community 94 - "Community 94"
Cohesion: 1.0
Nodes (0): 

### Community 95 - "Community 95"
Cohesion: 1.0
Nodes (0): 

### Community 96 - "Community 96"
Cohesion: 1.0
Nodes (0): 

### Community 97 - "Community 97"
Cohesion: 1.0
Nodes (0): 

### Community 98 - "Community 98"
Cohesion: 1.0
Nodes (0): 

### Community 99 - "Community 99"
Cohesion: 1.0
Nodes (0): 

### Community 100 - "Community 100"
Cohesion: 1.0
Nodes (0): 

### Community 101 - "Community 101"
Cohesion: 1.0
Nodes (0): 

### Community 102 - "Community 102"
Cohesion: 1.0
Nodes (1): Unwatched, dated episodes across the user's library.      `days_back` bounds how

### Community 103 - "Community 103"
Cohesion: 1.0
Nodes (1): # NOTE: must be a plain sync function — the endpoint runs it via run_in_threadpo

## Ambiguous Edges - Review These
- `TrakPlus (Multi-Media Tracker)` → `GSD Workflow System`  [AMBIGUOUS]
  docs/skills2use.md · relation: conceptually_related_to
- `Build Plan (docs/plan.md)` → `Self-Hosted JWT Auth`  [AMBIGUOUS]
  docs/plan.md · relation: conceptually_related_to
- `shadcn/ui Components` → `impeccable Skill`  [AMBIGUOUS]
  frontend/README.md · relation: conceptually_related_to

## Knowledge Gaps
- **86 isolated node(s):** `Run migrations in 'offline' mode (emit SQL without a DB connection).`, `Run migrations in 'online' mode (async engine against the live DB).`, `initial schema  Revision ID: 13f74a4c16e8 Revises:  Create Date: 2026-08-30 20:3`, `add episode descriptions and thumbnails  Revision ID: 7f2c1d9a4b6e Revises: b`, `add playtime and duration tracking  Revision ID: a1b2c3d4e5f6 Revises: 7f2c1d9a4` (+81 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 36`** (2 nodes): `metrics.py`, `Application-level Prometheus metrics (in addition to the instrumentor's request`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (2 nodes): `layout.tsx`, `RootLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (2 nodes): `page.tsx`, `FilterChip()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (2 nodes): `page.tsx`, `LoginPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (2 nodes): `page.tsx`, `exportUrl()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (2 nodes): `providers.tsx`, `Providers()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (2 nodes): `stat-card.tsx`, `StatCard()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (2 nodes): `google-button.tsx`, `GoogleButton()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (2 nodes): `login-form.tsx`, `LoginForm()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (2 nodes): `AppLayout()`, `app-layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (2 nodes): `NavItem()`, `app-sidebar.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (2 nodes): `import-export-toolbar.tsx`, `ImportExportToolbar()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (2 nodes): `week-section.tsx`, `toggle()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (2 nodes): `search-bar.tsx`, `handleChange()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (2 nodes): `statusesFor()`, `add-to-library.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (2 nodes): `episode-row.tsx`, `formatDuration()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (2 nodes): `playtime-input-wrapper.tsx`, `PlaytimeInputWrapper()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (2 nodes): `progress-tracker.tsx`, `useEpisodes()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (2 nodes): `title-detail-animations.tsx`, `TitleDetailAnimations()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (2 nodes): `AnimatedCounter()`, `animated-counter.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (2 nodes): `cn()`, `button.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (2 nodes): `empty.tsx`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (2 nodes): `fade-in-stagger.tsx`, `FadeInStagger()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (2 nodes): `field.tsx`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (2 nodes): `input.tsx`, `Input()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (2 nodes): `label.tsx`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (2 nodes): `page-transition.tsx`, `PageTransition()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (2 nodes): `separator.tsx`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (2 nodes): `skeleton.tsx`, `Skeleton()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (2 nodes): `spinner.tsx`, `Spinner()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (2 nodes): `spring-hover.tsx`, `SpringHover()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (2 nodes): `tabs.tsx`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (2 nodes): `toggle.tsx`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 72`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 73`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 74`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 75`** (1 nodes): `eslint.config.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 76`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 77`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 78`** (1 nodes): `playwright.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 79`** (1 nodes): `postcss.config.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 80`** (1 nodes): `vitest.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 81`** (1 nodes): `flow.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 82`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 83`** (1 nodes): `donut-chart.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 84`** (1 nodes): `status-selector.test.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 85`** (1 nodes): `status-selector.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 86`** (1 nodes): `schedule-card.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 87`** (1 nodes): `search-bar.test.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 88`** (1 nodes): `back-to-search.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 89`** (1 nodes): `notes-rail.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 90`** (1 nodes): `animated-progress.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 91`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 92`** (1 nodes): `api.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 93`** (1 nodes): `setup.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 94`** (1 nodes): `load-test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 95`** (1 nodes): `extract-chunk-context.ps1`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 96`** (1 nodes): `extract-pubfn.ps1`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 97`** (1 nodes): `extract-publicapi.ps1`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 98`** (1 nodes): `get-title-error.ps1`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 99`** (1 nodes): `get-title-error2.ps1`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 100`** (1 nodes): `prod-sync-test.ps1`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 101`** (1 nodes): `scan-live-chunks.ps1`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 102`** (1 nodes): `Unwatched, dated episodes across the user's library.      `days_back` bounds how`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 103`** (1 nodes): `# NOTE: must be a plain sync function — the endpoint runs it via run_in_threadpo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `TrakPlus (Multi-Media Tracker)` and `GSD Workflow System`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Build Plan (docs/plan.md)` and `Self-Hosted JWT Auth`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `shadcn/ui Components` and `impeccable Skill`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `GET()` connect `Community 0` to `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 8`, `Community 11`?**
  _High betweenness centrality (0.158) - this node is a cross-community bridge._
- **Why does `POST()` connect `Community 2` to `Community 0`, `Community 11`, `Community 5`, `Community 6`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `MediaType` connect `Community 3` to `Community 0`, `Community 2`, `Community 7`, `Community 8`, `Community 9`, `Community 11`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Are the 112 inferred relationships involving `GET()` (e.g. with `google_login()` and `proxy_image()`) actually correct?**
  _`GET()` has 112 INFERRED edges - model-reasoned connections that need verification._