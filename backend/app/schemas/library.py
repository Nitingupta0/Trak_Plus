import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import LibraryStatus, MediaType


class EpisodeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    number: int
    season: int
    name: str | None = None
    air_date: date | None = None
    description: str | None = None
    thumbnail_url: str | None = None


class LibraryEntryCreate(BaseModel):
    title_id: uuid.UUID
    status: LibraryStatus
    rating: int | None = Field(default=None, ge=1, le=10)
    notes: str | None = Field(default=None, max_length=2000)
    playtime_minutes: int | None = Field(default=None, ge=0)


class LibraryEntryUpdate(BaseModel):
    status: LibraryStatus | None = None
    rating: int | None = Field(default=None, ge=1, le=10)
    notes: str | None = Field(default=None, max_length=2000)
    playtime_minutes: int | None = Field(default=None, ge=0)


class TitleBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    media_type: MediaType
    release_date: date | None = None
    poster_url: str | None = None
    # Primary external reference for building detail URLs (/titles/{source}/{source_id}).
    source: str | None = None
    source_id: str | None = None


class LibraryEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: LibraryStatus
    rating: int | None = None
    notes: str | None = None
    playtime_minutes: int | None = None
    added_at: datetime
    updated_at: datetime | None = None
    title: TitleBrief


class ProgressSummary(BaseModel):
    library_entry_id: uuid.UUID
    watched_count: int
    total_episodes: int | None = None
    watched_episode_ids: list[uuid.UUID]
