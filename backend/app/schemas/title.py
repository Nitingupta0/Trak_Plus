"""Normalized, source-agnostic shapes shared by all external API clients.

Every client converts its provider's raw payloads into these schemas so the
frontend and the rest of the backend never need to know where data came from
(design.md §4).
"""

from datetime import date

from pydantic import BaseModel, Field

from app.models.enums import ExternalSource, MediaType, OfferType


class CastMember(BaseModel):
    name: str
    character: str | None = None
    profile_url: str | None = None


class ProviderOffer(BaseModel):
    country: str = Field(min_length=2, max_length=2, examples=["IN"])
    provider_name: str
    offer_type: OfferType


class SearchItem(BaseModel):
    source: ExternalSource
    source_id: str
    media_type: MediaType
    title: str
    year: int | None = None
    poster_url: str | None = None
    overview: str | None = None


class TitleDetail(BaseModel):
    # Internal `titles.id` UUID — populated by /titles endpoints after upsert.
    # None for search results (not yet persisted).
    id: str | None = None
    source: ExternalSource
    source_id: str
    media_type: MediaType
    title: str
    original_title: str | None = None
    synopsis: str | None = None
    release_date: date | None = None
    genres: list[str] = Field(default_factory=list)
    poster_url: str | None = None
    backdrop_url: str | None = None
    runtime_minutes: int | None = None
    episode_count: int | None = None
    season_count: int | None = None
    cast: list[CastMember] = Field(default_factory=list)
    providers: list[ProviderOffer] = Field(default_factory=list)
    external_ids: dict[str, str] = Field(default_factory=dict)
