import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Progress(Base):
    """One row per watched episode / read chapter."""

    __tablename__ = "progress"
    __table_args__ = (UniqueConstraint("library_entry_id", "episode_id", name="uq_entry_episode"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    library_entry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("library_entries.id", ondelete="CASCADE"), index=True
    )
    episode_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("episodes.id", ondelete="CASCADE"), index=True
    )
    watched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
