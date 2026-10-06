import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import LibraryStatus

if TYPE_CHECKING:
    from app.models.title import Title


class LibraryEntry(Base):
    __tablename__ = "library_entries"
    __table_args__ = (
        UniqueConstraint("user_id", "title_id", name="uq_user_title"),
        CheckConstraint("rating IS NULL OR (rating BETWEEN 1 AND 10)", name="ck_rating_range"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("titles.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[LibraryStatus] = mapped_column(
        Enum(LibraryStatus, name="library_status", native_enum=True)
    )
    rating: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    playtime_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Eager-loaded (selectin) so async sessions never implicitly lazy-load.
    title: Mapped["Title"] = relationship("Title", lazy="selectin")
