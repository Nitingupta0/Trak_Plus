# Requirements — Personal Media-Tracking Website

> **Status:** Draft (requirements gathered, pre-build)
> **Date:** 2026-09-01
> **Product:** A personal media-tracking website with a dark-sidebar / cream-parchment "archive" aesthetic.

---

## 1. Scope & Content

### 1.1 Media types tracked
- **Anime** — series, films, OVAs
- **Manga** — series, volumes, chapters
- **Games** — video games (any platform)
- **Movies / TV** — films and television series
- (Books: **not** selected)

### 1.2 User model
- **Multi-user** — requires login/accounts; each user gets their own collection.

### 1.3 Collection size
- **Hundreds** of items expected (~50–500).

### 1.4 Privacy
- **Fully private** — no public-facing or shareable profile page.

### 1.5 Extras beyond core
- **Schedule / session tracking** — weekly release & "currently consuming" awareness, and/or session history (e.g. when I last touched an item).

---

## 2. Core Pages / Views

| Page | Needed? | Notes |
|---|---|---|
| **Collection / Dashboard grid** | ✅ Yes | Cards with cover art, progress %, status. **Top priority.** |
| **Item Detail page** | ✅ Yes | Synopsis, metadata, episode/chapter log, personal notes/observations sidebar. |
| **Schedule / Calendar view** | ✅ Yes | Weekly release & session tracker. |
| **Analysis / Stats dashboard** | ⚠️ TBD | Hours logged, charts, status breakdown, heatmap — *not explicitly confirmed; implied by reference*. |
| **Directory** | ✅ Yes | Browse / filter all entries by category. |
| **Profile / Settings** | ✅ Yes | Identity, category toggles, data export, account actions. |
| **"New Entry" add-item modal/form** | ✅ Yes | Add new titles to the collection. |
| **Anything else** | — | Schedule/session tracking (see §1.5). |

---

## 3. Data & Storage

- **Data location:** Real database (e.g. Postgres) — **not** browser localStorage.
- **Metadata fetching:** **Auto from API** — search/add by name; app pulls title, cover art, episode/chapter counts automatically.
- **Import/export:** **Yes** — CSV/JSON.
- **Cross-device:** **Yes** — must persist across devices (requires a backend + database).

---

## 4. Tech Stack

- **Framework:** **Next.js / React** (App Router; chosen as best fit given existing familiarity, dashboard-heavy UI, and DB + auth + cross-device needs).
- **Styling:** **Tailwind CSS**.
- **Backend:** Required — database + authentication + external API sync (metadata fetching).
- **Deployment:** **AWS** (Lightsail/similar; the existing TrakPlus-style single-box stack is a natural fit).

---

## 5. Visual Design Direction

### 5.1 Color palette
- Warm off-white / cream background — **~#EDE9DE**
- **Near-black** sidebar
- **Dark charcoal** body text
- **Muted gray** placeholder blocks for images

### 5.2 Typography
- **Serif display font** for headlines / titles (old-style serif feel)
- **Small-caps sans-serif** for labels / meta text
- **Clean sans-serif** for body copy

### 5.3 Layout
- Persistent **dark left icon-rail sidebar**
- **Three-column desktop layout** on detail pages (info panel / main content / right "notes" rail)
- **Top nav tabs** (Collection, Schedule, Analysis, Directory) on dashboard pages

### 5.4 Component style
- **Thin 1px hairline dividers** instead of boxed cards
- **Minimal shadows**
- **Generous whitespace**
- **Small uppercase tracked labels** above data values
- **Big serif numerals** for stats

### 5.5 Changes from reference
- **Keep the reference aesthetic as-is** (cream archive, serif headlines, hairline rules)
- **Plus: add dark mode** toggle

---

## 6. Interactions & Behavior

- **Hover actions:** The "Vary strong / Change style / Shuffle layout" buttons are **from the design tool, NOT needed.** Real hover actions (Edit / Delete / Mark Complete) — ⚠️ **TBD** (assume minimal edit/delete affordances unless specified otherwise).
- **Animations / transitions:** **Some transitions** — calm page/route transitions and subtle card hover states; not over-animated.
- **Mobile responsiveness:** **Desktop-only** for now.

---

## 7. Priorities & Constraints

- **Single most important feature to get right first:** **Collection / Dashboard grid.**
- **Deadline:** **ASAP** (no hard date specified).
- **Current setup / skills:** Computer Engineering student; already comfortable with Next.js, Vercel, and GitHub deployment workflows. This runs on **AWS**.
- **Constraint:** The visual language of the reference mockups (dark sidebar + cream archive, serif + small-caps, hairline rules, minimal shadows) is the design target; dark mode is an explicit addition.

---

## 8. Open Questions / TBDs

- **Analysis / Stats dashboard** — confirm whether this page is in scope for v1.
- **External API source(s)** — which metadata providers? (AniList / MAL / Trakt / Steam / IGDB — **TBD**.)
- **Auth provider** — self-hosted JWT / OAuth, or managed provider? (**TBD.**)
- **Hover action set** on cards (Edit / Delete / Mark Complete) — **TBD.**
- **Session tracking scope** — what does a "session" mean per media type? (**TBD.**)
