import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Episode(Base):
    """Episode (TV/anime) or chapter (manga) of a title (design.md §3).

    season=0 is used where seasons do not apply (anime flat episode lists,
    manga chapter numbers) so the (title, season, number) unique constraint
    works without NULL pitfalls.
    """

    __tablename__ = "episodes"
    __table_args__ = (UniqueConstraint("title_id", "season", "number", name="uq_episode_number"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("titles.id", ondelete="CASCADE"), index=True
    )
    number: Mapped[int] = mapped_column(Integer)
    season: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    name: Mapped[str | None] = mapped_column(String(500))
    air_date: Mapped[date | None] = mapped_column(Date)
    description: Mapped[str | None] = mapped_column(Text)
    thumbnail_url: Mapped[str | None] = mapped_column(String(1000))
