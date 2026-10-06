import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import MediaType


class Title(Base):
    """A tracked media title, cached from an external source (design.md §3).

    External ids are dedicated indexed columns (not one JSONB dict) so lookups
    like "find title by tmdb id" stay indexed. Unstructured extras live in
    raw_metadata JSONB.
    """

    __tablename__ = "titles"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    media_type: Mapped[MediaType] = mapped_column(
        Enum(MediaType, name="media_type", native_enum=True), index=True
    )

    # 64 chars: MangaDex ids are 36-char UUIDs; keep headroom.
    tmdb_id: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    rawg_id: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    anilist_id: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    mal_id: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    mangadex_id: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)

    title: Mapped[str] = mapped_column(String(500))
    original_title: Mapped[str | None] = mapped_column(String(500))
    synopsis: Mapped[str | None] = mapped_column(Text)
    release_date: Mapped[date | None] = mapped_column(Date)
    genres: Mapped[list[str]] = mapped_column(ARRAY(String(100)), default=list, server_default="{}")
    poster_url: Mapped[str | None] = mapped_column(String(1000))
    backdrop_url: Mapped[str | None] = mapped_column(String(1000))

    raw_metadata: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    _SOURCE_ATTRS = ("tmdb_id", "rawg_id", "anilist_id", "mal_id", "mangadex_id")

    @property
    def primary_source(self) -> str | None:
        """First populated external id column, e.g. 'tmdb' — used to build detail URLs."""
        for attr in self._SOURCE_ATTRS:
            if getattr(self, attr):
                return attr.removesuffix("_id")
        return None

    @property
    def primary_source_id(self) -> str | None:
        for attr in self._SOURCE_ATTRS:
            value = getattr(self, attr)
            if value:
                return value
        return None
