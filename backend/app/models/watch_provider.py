import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import OfferType


class WatchProvider(Base):
    __tablename__ = "watch_providers"
    __table_args__ = (
        UniqueConstraint(
            "title_id", "country", "provider_name", "offer_type", name="uq_provider_offer"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("titles.id", ondelete="CASCADE"), index=True
    )
    country: Mapped[str] = mapped_column(String(2))
    provider_name: Mapped[str] = mapped_column(String(200))
    offer_type: Mapped[OfferType] = mapped_column(
        Enum(OfferType, name="offer_type", native_enum=True)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
