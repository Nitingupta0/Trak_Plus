# Checks that external API credentials/integration work with a single real request each.
# Usage:
#   TMDB_API_KEY=... RAWG_API_KEY=... python scripts/check_apis.py
#   (or fill .env at repo root — values are read from environment; .env is loaded if present)
# AniList / Jikan / MangaDex need no key.
# Exit code 0 = all attempted checks passed.

import asyncio
import os
import sys
from pathlib import Path

import httpx

try:
    for line in (Path(__file__).resolve().parent.parent / ".env").read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip("'\""))
except FileNotFoundError:
    pass

TMDB_API_KEY = os.environ.get("TMDB_API_KEY", "")
RAWG_API_KEY = os.environ.get("RAWG_API_KEY", "")


def check(name: str, ok: bool, detail: str) -> bool:
    print(f"[{'PASS' if ok else 'FAIL'}] {name}: {detail}")
    return ok


async def check_tmdb(client: httpx.AsyncClient) -> bool:
    if not TMDB_API_KEY:
        return check("TMDB", False, "no key set (skip registration? see docs/plan.md Phase 0)")
    headers, params = (
        ({"Authorization": f"Bearer {TMDB_API_KEY}"}, {})
        if TMDB_API_KEY.startswith("eyJ")
        else ({}, {"api_key": TMDB_API_KEY})
    )
    r = await client.get(
        "https://api.themoviedb.org/3/search/movie",
        params={**params, "query": "Inception", "page": 1},
        headers=headers,
    )
    results = r.json().get("results", []) if r.status_code == 200 else []
    return check("TMDB", r.status_code == 200 and bool(results), f"HTTP {r.status_code}, {len(results)} results")


async def check_rawg(client: httpx.AsyncClient) -> bool:
    if not RAWG_API_KEY:
        return check("RAWG", False, "no key set")
    r = await client.get(
        "https://api.rawg.io/api/games",
        params={"key": RAWG_API_KEY, "search": "elden ring", "page_size": 1},
    )
    count = r.json().get("count", 0) if r.status_code == 200 else 0
    return check("RAWG", r.status_code == 200 and count > 0, f"HTTP {r.status_code}, count={count}")


async def check_anilist(client: httpx.AsyncClient) -> bool:
    query = '{ Media(search: "Death Note", type: ANIME) { title { romaji } } }'
    r = await client.post("https://graphql.anilist.co", json={"query": query})
    title = (r.json().get("data", {}).get("Media", {}) or {}).get("title", {}).get("romaji", "")
    return check("AniList", r.status_code == 200 and bool(title), f"HTTP {r.status_code}, got '{title}'")


async def check_jikan(client: httpx.AsyncClient) -> bool:
    r = await client.get("https://api.jikan.moe/v4/anime", params={"q": "death note", "limit": 1})
    rows = r.json().get("data", []) if r.status_code == 200 else []
    return check("Jikan", r.status_code == 200 and bool(rows), f"HTTP {r.status_code}, {len(rows)} results")


async def check_mangadex(client: httpx.AsyncClient) -> bool:
    r = await client.get("https://api.mangadex.org/manga", params={"title": "one piece", "limit": 1})
    rows = r.json().get("data", []) if r.status_code == 200 else []
    return check("MangaDex", r.status_code == 200 and bool(rows), f"HTTP {r.status_code}, {len(rows)} results")


async def main() -> int:
    async with httpx.AsyncClient(timeout=15) as client:
        results = await asyncio.gather(
            check_tmdb(client),
            check_rawg(client),
            check_anilist(client),
            check_jikan(client),
            check_mangadex(client),
        )
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
