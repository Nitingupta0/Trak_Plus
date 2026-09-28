import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    # bcrypt hash; NULL for OAuth-only accounts (e.g. Google sign-in).
    hashed_password: Mapped[str | None] = mapped_column(String(255))
    # Set for federated accounts (e.g. Google "sub" claim); NULL for password accounts.
    auth_provider_id: Mapped[str | None] = mapped_column(String(255), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
