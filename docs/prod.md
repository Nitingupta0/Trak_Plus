# Product Requirements — Multi-Media Tracker

## 1. Vision
A single self-hosted web app to track everything you consume — movies, TV series, games, anime, and manga — in one place, with rich metadata, episode-level progress tracking, and India-specific "where to stream" info. Built to double as a portfolio-grade DevOps/full-stack project.

## 2. Target user
Primary: you (multi-user from day one, so friends/other users can sign up too).

## 3. Core user stories (MVP)
- As a user, I can sign up / log in (self-hosted JWT auth, or one-tap via Google OAuth) and get a personal library.
- As a user, I can search across movies, TV, games, anime, and manga in one search bar.
- As a user, I can add any title to my library with a status: Watching/Playing/Reading, Plan to, Completed, Dropped, On-Hold.
- As a user, I can see full metadata per title: synopsis, genres, release date, cast (movies/TV), episode list, runtime/episode count.
- As a user, for movies/TV I can see where it's streaming in India (provider name + subscription/rent/buy).
- As a user, I can track progress episode-by-episode for TV/anime (mark episode N watched) and chapter-by-chapter for manga.
- As a user, I can rate a title (1–10) and add a short note.
- As a user, I can export my library/history as CSV or JSON in a Trakt-compatible schema.
- As a user, I can import a CSV/JSON (Trakt export format, or IMDb/Letterboxd export) to bulk-populate my library.
- As a user, my data is private to my account by default.

## 4. Post-MVP / stretch features
- Friends/following + activity feed.
- Recommendations based on library (genre/tag overlap).
- Airing/release calendar (upcoming episodes, seasons, game release dates).
- Browser extension or mobile-friendly PWA.
- Public shareable profile page.

## 5. Non-goals
- No video/streaming playback — metadata and tracking only.
- No piracy-adjacent scraping (JustWatch scraping avoided; TMDB's official watch-provider data used instead).
- Not attempting full social-network feature parity with Trakt/AniList at launch.

## 6. Success criteria for resume purposes
- Deployed, publicly reachable app on AWS (EKS) with a working CI/CD pipeline (build → test → containerize → deploy).
- Infra fully defined in Terraform (reproducible from scratch).
- Basic observability: metrics + alerting on at least API latency/error rate and pod health.
- Clean, documented repo(s) that read well in a resume/portfolio walkthrough.

## 7. Data source dependencies (see design.md for details)
TMDB (movies/TV + streaming providers), RAWG (games), AniList + Jikan (anime), MangaDex (manga). All free tiers; caching layer (Redis) required to stay within rate limits.
