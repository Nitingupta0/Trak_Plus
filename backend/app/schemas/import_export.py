"""Pydantic schemas for import/export (design.md §6).

- Export: Trakt-compatible JSON (history, ratings, watchlist) + generic CSV.
- Import: accepts Trakt JSON, generic CSV, our own JSON format.
"""

from typing import Any

from pydantic import BaseModel, Field

# ── Export schemas ───────────────────────────────────────────────────────────


class TraktIds(BaseModel):
    """External IDs matching Trakt's `ids` object shape."""

    tmdb: str | None = None
    imdb: str | None = None
    tvdb: str | None = None
    anilist: str | None = None
    mal: int | None = None
    mangadex: str | None = None
    rawg: str | None = None


class TraktMovie(BaseModel):
    title: str
    year: int | None = None
    ids: TraktIds


class TraktShow(BaseModel):
    title: str
    year: int | None = None
    ids: TraktIds


class TraktEpisode(BaseModel):
    season: int
    number: int
    title: str | None = None
    ids: TraktIds


class TraktHistoryItem(BaseModel):
    """One row in Trakt's history.json export."""

    watched_at: str
    action: str = "watch"
    type: str
    movie: TraktMovie | None = None
    episode: TraktEpisode | None = None
    show: TraktShow | None = None


class TraktRatingItem(BaseModel):
    """One row in Trakt's ratings.json export."""

    rated_at: str
    rating: int = Field(ge=1, le=10)
    type: str
    movie: TraktMovie | None = None
    show: TraktShow | None = None


class TraktWatchlistItem(BaseModel):
    """One row in Trakt's watchlist.json export."""

    listed_at: str
    type: str
    movie: TraktMovie | None = None
    show: TraktShow | None = None


class TraktExport(BaseModel):
    """Full Trakt-compatible export — wraps all three arrays."""

    history: list[TraktHistoryItem] = Field(default_factory=list)
    ratings: list[TraktRatingItem] = Field(default_factory=list)
    watchlist: list[TraktWatchlistItem] = Field(default_factory=list)


# ── Import schemas ───────────────────────────────────────────────────────────


class ImportRow(BaseModel):
    """One row from a generic CSV import file."""

    source: str
    external_id: str
    media_type: str | None = None
    status: str = "plan_to"
    rating: int | None = Field(default=None, ge=1, le=10)
    notes: str | None = None


class ImportResult(BaseModel):
    created: int = 0
    updated: int = 0
    skipped: int = 0
    errors: list[dict[str, Any]] = Field(default_factory=list)
