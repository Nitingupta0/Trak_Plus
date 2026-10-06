"""Response schemas for the unified chronological schedule."""

import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel

from app.models.enums import LibraryStatus, MediaType


class ScheduleItem(BaseModel):
    """A dated planned title or an unwatched episode/chapter."""

    kind: Literal["title", "episode"]
    # Stable client-side key. It is namespaced because title and episode UUIDs
    # can otherwise collide if a consumer uses a single event map.
    event_id: str
    entry_id: uuid.UUID
    title_id: uuid.UUID
    title: str
    media_type: MediaType
    poster_url: str | None = None
    source: str | None = None
    source_id: str | None = None
    status: LibraryStatus
    scheduled_date: date

    # Kept as a compatibility field for existing episode consumers. New code
    # should use scheduled_date for both event kinds.
    air_date: date | None = None

    episode_id: uuid.UUID | None = None
    episode_number: int | None = None
    season: int | None = None
    episode_name: str | None = None


class ScheduleResponse(BaseModel):
    # Both arrays are independently chronological. Together they retain the
    # existing API envelope while allowing title and episode events to coexist.
    upcoming: list[ScheduleItem]
    backlog: list[ScheduleItem]
