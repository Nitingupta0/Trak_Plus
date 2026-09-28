"""Shared FastAPI dependencies. get_current_user protects every user-scoped
route; the user is ALWAYS resolved from the token, never from client input."""

import uuid

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import decode_token
from app.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

_CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = decode_token(token, expected_type="access")
    except jwt.InvalidTokenError:
        raise _CREDENTIALS_ERROR from None

    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise _CREDENTIALS_ERROR from None

    user = (await session.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise _CREDENTIALS_ERROR
    return user
