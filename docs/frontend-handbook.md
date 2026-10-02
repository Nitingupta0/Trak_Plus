# TrakPlus — Frontend Handbook

> **Purpose:** Everything a frontend developer needs to design and build the UI effectively.
> **Date:** 2026-09-01
> **Tech:** Next.js 16.3 (App Router, `src/`), Tailwind v4, Base UI (shadcn), TanStack Query v5

---

## 1. Routes & Pages

### 1.1 App Router pages (filesystem)

| Route | Type | Component | Auth Required | Description |
|---|---|---|---|---|
| `/` | Server | `src/app/page.tsx` | — | Redirects to `/library` if logged in, else `/login` |
| `/login` | Server | `src/app/login/page.tsx` | No | Login/register form + Google sign-in button |
| `/search` | Client | `src/app/search/page.tsx` | No | Debounced search bar, results grouped by media type |
| `/library` | Client | `src/app/library/page.tsx` | Yes | Status-tabbed grid of library entries |
| `/titles/[source]/[externalId]` | Server | `src/app/titles/[...]/page.tsx` | No | Full metadata, cast, providers, progress tracker, add-to-library |

### 1.2 BFF route handlers (Next.js API routes)

| Route | Methods | Purpose |
|---|---|---|
| `/api/auth/login` | POST | Email/password login proxy |
| `/api/auth/register` | POST | Create account proxy |
| `/api/auth/refresh` | POST | Rotate JWT pair proxy |
| `/api/auth/logout` | POST | Clear auth cookies |
| `/api/auth/me` | GET | Current user info |
| `/api/auth/google` | POST | Google id_token sign-in |
| `/api/bff/[...path]` | GET/POST/PATCH/DELETE | **Main BFF proxy** — forwards to backend with auth cookie |

---

## 2. Page-by-Page Content

### 2.1 `/login` — Login Page

**Layout:** Centered card (max-w-sm) on a full-screen background.

**Sections:**
- **Card header:** "TrakPlus" title + "Track everything you watch, play, and read — in one place" subtitle.
- **Tabs:** "Log in" / "Sign up" (2-tab grid).
- **Login tab:** Email + Password fields, full-width "Log in" button.
- **Register tab:** Email + Password (min 8 chars) fields, field validation inline, "Create account" button.
- **Google button:** renders below the tabs when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set.

**States:**
- Loading: buttons show `disabled` with no spinner.
- Error: toast notification (e.g., "Login failed — incorrect email or password").
- Success: redirect to `/library`.

**Components used:** `LoginForm`, `GoogleButton`, `Card`, `Field`, `Input`, `Button`, `Tabs`, `Toast`.

### 2.2 `/search` — Search Page

**Layout:** `AppLayout` (dark icon-rail sidebar + content column), search bar below, results grid.

**Sections:**
- **AppSidebar:** persistent dark icon rail — serif "T" logo (→ `/library`), Search + Library icon links (active state highlighted), user avatar dropdown (email, logout) or Log-in icon at the bottom.
- **Search bar:** debounced (300ms) input, search icon on left, loading spinner on right while debouncing.
- **Empty state** (query ≤ 1 char): "Search across every source" — TMDB (movies/TV), RAWG (games), AniList (anime), MangaDex (manga).
- **Loading state:** 6 skeleton cards in a grid.
- **No results:** "No results for {query}" + "Try a different spelling."
- **Results grid:** 2-6 column grid (responsive: `grid-cols-2 sm:grid-cols-4 lg:grid-cols-6`), grouped by media type with section headings ("Movie · 10", "Anime · 7", etc.).

**Result card:** `ResultCard` shows:
- Poster image (2:3 aspect ratio, object-cover) or emoji placeholder 🎬
- Media type badge (e.g., "Movie")
- Title (line-clamp-2)
- Year · source

**Data source:** `queries.search(q)` → `publicApi("/search", { q, type: "all" })` → `GET /api/search?q=&type=all`.

### 2.3 `/library` — Library Dashboard

**Layout:** `AppLayout` (dark icon-rail sidebar + content column), "Your library" heading + title count + import/export toolbar, tabbed entry grid.

**Sections:**
- **AppSidebar** (persistent on every page).
- **Header row:** "Your library" (h1), "{N} titles · add more" link, `ImportExportToolbar`.
- **Tab bar:** 7 tabs by status: Watching, Playing, Reading, Plan to, Completed, Dropped, On Hold. Each tab shows count badge.
- **Content per tab:** Empty state ("Nothing in {status} yet.") or 2-column grid of `EntryCard` components.
- **Empty overall state:** "Your library is empty — Search for a movie, game, or anime and add it with a status to get started."
- **Loading state:** 4 skeleton cards.

**EntryCard components:** Poster thumbnail (2:3), media type badge, title (link to detail page), rating, "Remove" button, `StatusSelector` toggle-group (chips).

**Import/Export toolbar:** Dropdown menu for "Download JSON" / "Download CSV", and an "Import" button that opens a file picker.

**Data source:** `queries.library()` → `bff("/library")` → `GET /api/bff/library`.

### 2.4 `/titles/[source]/[externalId]` — Title Detail Page

**Layout:** `AppLayout` (dark icon-rail sidebar + content column), **three-column desktop grid** (info panel / main content / notes rail), collapses to single column on mobile.

**Sections (three-column grid):**
- **Left column (sticky):** Poster image (2:3), media-type/year/runtime/season/episode/source badges, AddToLibrary.
- **Center column:** Original title, serif H1 title, genre badges, synopsis, **Where to stream (India)** (3 cols: Stream / Rent / Buy with provider badges, only if providers exist), **Top cast** (max 10, profile photos + name + character, only if cast exists), **Progress tracker**.
- **Right column (sticky, notes rail):** `NotesRail` — editable personal notes textarea + Save/Discard; shows "add to library to leave notes" hint when the title isn't in the library.
- Collapses to a single column below `lg` breakpoint.

**Progress tracker states:** If not synced: "Load episode list" button. If not in library: "Add this title to your library to track progress." Loading: skeleton rows. Loaded: numbered checkbox list (S{season}·E{number} format, or just E{number} for anime/manga). Empty-after-sync: "No chapter/episode data available for this title at its source."

**Data source:** `fetchTitleServer(source, externalId, mediaType)` server-side → `GET /titles/{source}/{external_id}` (server-rendered for SEO).

---

## 3. Data Types (TypeScript interfaces)

All in `src/lib/types.ts`:

```typescript
MediaType = "movie" | "tv" | "game" | "anime" | "manga"
LibraryStatus = "watching" | "playing" | "reading" | "plan_to" | "completed" | "dropped" | "on_hold"
OfferType = "stream" | "rent" | "buy"

UserRead         { id, email, created_at }
SearchItem       { source, source_id, media_type, title, year, poster_url, overview }
SearchResponse   { query, count, results: SearchItem[] }
CastMember       { name, character, profile_url }
ProviderOffer    { country, provider_name, offer_type }
TitleDetail      { id, source, source_id, media_type, title, original_title, synopsis,
                   release_date, genres, poster_url, backdrop_url, runtime_minutes,
                   episode_count, season_count, cast: CastMember[], providers: ProviderOffer[],
                   external_ids: Record<string, string> }
EpisodeRow       { id, number, season, name, air_date }
TitleBrief       { id, title, media_type, release_date, poster_url, source, source_id }
LibraryEntry     { id, status, rating, notes, added_at, updated_at, title: TitleBrief }
ProgressSummary  { library_entry_id, watched_count, total_episodes, watched_episode_ids[] }
SyncResult       { created, total, message? }
ImportResult     { created, updated, skipped, errors: { row?, reason }[] }
```

---

## 4. API Contracts

### 4.1 Backend endpoints (FastAPI)

| Endpoint | Auth | Method | Request | Response |
|---|---|---|---|---|
| `/health` / `/health/ready` | — | GET | — | `{ status, app, environment, version }` |
| `/auth/register` | — | POST | `{ email, password }` | `UserRead` (201) |
| `/auth/login` | — | POST | form `username`, `password` | `Token` (access_token, refresh_token, token_type) |
| `/auth/refresh` | refresh | POST | `{ refresh_token }` | `Token` |
| `/auth/google` | — | POST | `{ credential }` (id_token) | `Token` |
| `/auth/me` | Bearer | GET | — | `UserRead` |
| `/search?q=&type=all` | — | GET | query params | `SearchResponse` |
| `/titles/{source}/{external_id}` | — | GET | `?media_type=` | `TitleDetail` |
| `/titles/{source}/{external_id}/episodes` | — | GET | — | `EpisodeRow[]` |
| `/titles/{source}/{external_id}/episodes/sync` | — | POST | `?media_type=` | `SyncResult` |
| `/library` | Bearer | GET | — | `LibraryEntry[]` |
| `/library` | Bearer | POST | `{ title_id, status, rating? }` | `LibraryEntry` |
| `/library/{id}` | Bearer | PATCH | `{ status?, rating?, notes? }` | `LibraryEntry` |
| `/library/{id}` | Bearer | DELETE | — | 204 |
| `/library/{entry_id}/progress` | Bearer | GET | — | `ProgressSummary` |
| `/library/{entry_id}/progress/{episode_id}` | Bearer | POST | — | `ProgressSummary` |
| `/library/{entry_id}/progress/{episode_id}` | Bearer | DELETE | — | `ProgressSummary` |
| `/library/export?format=json|csv` | Bearer | GET | — | file download |
| `/library/export/template` | Bearer | GET | — | CSV template |
| `/library/import` | Bearer | POST | multipart file | `ImportResult` |
| `/metrics` | — | GET | — | Prometheus metrics |

### 4.2 BFF proxy (`/api/bff/[...path]`)

The BFF proxies all `/library` and `/progress` endpoints. The browser calls:
- `/api/bff/library` → backend `/library` (with auth cookie injected)
- `/api/bff/library/{id}` → backend `/library/{id}`
- `/api/bff/library/{entry_id}/progress/{episode_id}` → backend `/library/{entry_id}/progress/{episode_id}`

**Silent refresh:** If the backend returns 401, the BFF tries to refresh the token via `/auth/refresh`. If successful, retries the original request. If refresh fails, clears cookies and returns 401.

---

## 5. Component Inventory

### 5.1 UI components (`src/components/ui/`) — shadcn/Base UI primitives

| Component | File | Base | Notes |
|---|---|---|---|
| `Avatar`, `AvatarFallback` | `avatar.tsx` | Base UI | Circular user avatar |
| `Badge` | `badge.tsx` | Base UI | `variant: "default" \| "secondary" \| "outline"` |
| `Button` | `button.tsx` | Base UI | `variant: "default" \| "ghost" \| "outline"`, `size: "sm" \| "default"`, supports `render` prop for `<Link>` |
| `Card`, `CardContent`, `CardHeader`, `CardDescription`, `CardTitle` | `card.tsx` | Base UI | Container with header/body |
| `Dialog` | `dialog.tsx` | Base UI | Modal overlay |
| `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuGroup`, `DropdownMenuLabel`, `DropdownMenuSeparator` | `dropdown-menu.tsx` | Base UI | Context menus |
| `Empty`, `EmptyHeader`, `EmptyTitle`, `EmptyDescription` | `empty.tsx` | Custom | Empty state pattern |
| `Field`, `FieldGroup`, `FieldLabel`, `FieldDescription` | `field.tsx` | Base UI | Form field layout |
| `Input` | `input.tsx` | Base UI | Text input |
| `Label` | `label.tsx` | Base UI | Form label |
| `Progress` | `progress.tsx` | Base UI | Progress bar (0-100) |
| `Separator` | `separator.tsx` | Base UI | Horizontal rule (thin 1px) |
| `Skeleton` | `skeleton.tsx` | Base UI | Loading placeholder |
| `Spinner` | `spinner.tsx` | Base UI | Loading spinner |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | `tabs.tsx` | Base UI | Tabbed interfaces |
| `Toast` | `toast.tsx` | Base UI + Sonner | Notification toasts |
| `Toggle`, `ToggleGroup` | `toggle.tsx`, `toggle-group.tsx` | Base UI | Toggle buttons |

### 5.2 Feature components

| Component | File | Purpose |
|---|---|---|
| `AppLayout` | `layout/app-layout.tsx` | Page shell: dark icon-rail sidebar + content column |
| `AppSidebar` | `layout/app-sidebar.tsx` | Persistent dark icon rail (logo, Search/Library links with active state, avatar dropdown / log-in icon) |
| `SearchBar` | `search/search-bar.tsx` | Debounced search input with icon + loading spinner |
| `EntryCard` | `library/entry-card.tsx` | Library entry card with poster, status, rating, remove |
| `StatusSelector` | `library/status-selector.tsx` | Toggle group to change library status |
| `ImportExportToolbar` | `library/import-export-toolbar.tsx` | Export JSON/CSV dropdown + import upload |
| `LoginForm` | `auth/login-form.tsx` | Create/Login mode toggle + email/password fields |
| `GoogleButton` | `auth/google-button.tsx` | Google Identity Services sign-in button (renderButton, warm-tinted) |
| `AddToLibrary` | `titles/add-to-library.tsx` | Status selector + auto-save rating (no save button) |
| `ProgressTracker` | `titles/progress-tracker.tsx` | Episode/chapter list with checkboxes + progress bar |
| `EpisodeRowItem` | `titles/episode-row.tsx` | One episode row (checkbox, label, date) |
| `Providers` | `providers.tsx` | Root layout provider wrapper (TanStack Query) |

---

## 6. Data Fetching Patterns

### 6.1 Three API clients (`src/lib/client/api.ts`)

| Function | Use Case | Base URL | Auth |
|---|---|---|---|
| `bff<T>(path, init?)` | Authenticated endpoints | `/api/bff/{path}` | httpOnly cookie (injected by BFF) |
| `publicApi<T>(path, params?)` | Public endpoints | `NEXT_PUBLIC_API_URL` + path | None |
| `authPost(path, body?)` | Auth endpoints | `/api/auth/{path}` | None (sets cookies on success) |

### 6.2 TanStack Query keys

| Query Key | Function | Description |
|---|---|---|
| `["me"]` | `queries.me()` | Current user — returns `UserRead \| null` |
| `["library"]` | `queries.library()` | All library entries — `LibraryEntry[]` |
| `["search", query]` | `queries.search(query)` | Cross-source search — `SearchResponse` |
| `["episodes", source, externalId]` | `queries.episodes(source, id)` | Episode/chapter list — `EpisodeRow[]` |
| `["progress", entryId]` | `queries.progress(entryId)` | Progress summary — `ProgressSummary` |

---

## 7. Auth Flow

### 7.1 Cookie-based session (BFF pattern)

- **Access cookie:** `tp_access` (httpOnly, secure, sameSite=lax, path=/, 1h)
- **Refresh cookie:** `tp_refresh` (httpOnly, secure, sameSite=lax, path=/, 7d)
- Browser never sees raw JWTs.
- Silent refresh: BFF catches 401, calls `/auth/refresh`, retries, updates cookies.
- On refresh failure: cookies cleared, 401 returned, client redirects to `/login`.

### 7.2 Google sign-in

- Frontend loads Google Identity Services library (`accounts.google.com/gsi/client`).
- Button renders only when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set.
- Callback sends `{ credential: id_token }` to `POST /api/auth/google`.
- Route handler proxies to `POST /auth/google` on backend.
- Backend verifies: RS256 signature via Google JWKS, issuer (`accounts.google.com`), audience (`GOOGLE_CLIENT_ID`).
- On success: upserts user, issues JWT pair, `setAuthCookies` sets `tp_access` + `tp_refresh`.
- Browser redirects to `/library`.

### 7.3 Email/password login

- Frontend sends `{ email, password }` to `POST /api/auth/login`.
- Route handler calls `POST /auth/login` (OAuth2 form) on backend.
- Backend verifies bcrypt password hash, issues JWT pair.
- `setAuthCookies` sets cookies.

---

## 8. Styling & Design Tokens

### 8.1 Current theme (globals.css) — the archive aesthetic, implemented

- **Color space:** OKLCH, warm hue (~85°) throughout
- **Light mode:** cream background `oklch(0.934 0.015 90.2)` (≈ #EDE9DE), dark charcoal foreground, **near-black sidebar** `oklch(0.210 0.007 78.2)`, translucent hairline borders (`/ 0.4`), transparent cards
- **Dark mode (`.dark` class):** inverted — near-black background, cream foreground, sidebar even darker with subtle borders
- **Border radius:** `--radius: 0px` — **sharp corners everywhere** (archive look)
- **Fonts:** `Source Serif 4` for headings (`--font-serif`, `font-heading`), `Geist` sans for body, Geist mono for small-caps labels (uppercase + `tracking-widest`)

### 8.2 Design conventions (implemented in the redesign)

- **Hairline rows instead of boxed cards** — library entries are `border-b` rows; cards are `transparent` with `ring-1 ring-foreground/10`
- **Small uppercase tracked labels** — `font-mono text-xs uppercase tracking-widest` on badges/section headings
- **Serif display headlines** — `font-serif text-4xl font-bold` on page titles, big serif for item titles
- **Layout:** `AppLayout` = sticky dark icon-rail sidebar (w-16) + `max-w-6xl` content column; detail pages use a three-column grid (info panel / main content / notes rail)
- **Muted gray placeholders** — `bg-muted` blocks for missing posters (🎬 emoji fallback)
- **Dark mode:** same archive aesthetic inverted; CSS variables fully defined, sidebar toggle button (sun/moon)

### 8.3 Tailwind configuration

- `@theme inline` block in `globals.css` defines all CSS variables as Tailwind tokens (incl. `--font-serif` → Source Serif 4).
- Custom variants: `@custom-variant dark (&:is(.dark *))`.
- Default classes in `@layer base`: `border-border`, `outline-ring/50`, `bg-background text-foreground`, `font-sans`.

---

## 9. Key Dependencies

| Package | Version | Purpose |
|---|---|---|
| `next` | 16.3.3 | Framework (App Router, server components, BFF route handlers) |
| `react` / `react-dom` | 19.2.8 | UI library |
| `@base-ui/react` | ^1.7.0 | Headless UI primitives (shadcn uses Base UI) |
| `@tanstack/react-query` | ^5.102.8 | Server state, caching, mutations |
| `lucide-react` | ^1.37.0 | Icon set |
| `tailwindcss` | ^4 | Utility CSS |
| `tw-animate-css` | ^1.4.0 | Tailwind animation plugin |
| `class-variance-authority` | ^0.7.1 | Component variant props |
| `clsx` / `tailwind-merge` | — | Class merging |

---

## 10. Routing & Response Flow (Caddy → frontend → backend)

```
Browser → https://trak-plus.lucifer07o.tech/
  ↓
Caddy reverse proxy
  ├── /api/bff/*     → frontend (Next.js route handlers)
  ├── /api/auth/*    → frontend (Next.js route handlers)
  ├── /api/*         → backend (FastAPI, /api prefix stripped)
  └── /*             → frontend (Next.js pages)
```

### Important notes for frontend devs

1. `NEXT_PUBLIC_API_URL` is the **browser-side API base URL**. It's set to `/api` in production (via Caddy), so the browser calls `/api/search` which Caddy proxies to the backend. In local dev it's `http://localhost:8000`.

2. `API_URL` is the **server-side API URL** (BFF → backend). It's `http://backend:8000` in Docker Compose, and `http://localhost:8000` in local dev.

3. The BFF proxy at `/api/bff/[...path]` handles **silent JWT refresh** — the browser never needs to manage tokens.

4. All `NEXT_PUBLIC_*` env vars are **inlined at build time** into the client JS bundle. They must be set during `next build`, not at runtime.

5. The `publicApi` function handles relative URL bases (e.g., `/api`) by resolving against `window.location.origin`.