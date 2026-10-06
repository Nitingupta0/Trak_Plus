"""Auth endpoints: register, OAuth2 password login, refresh, me, Google sign-in.
See design.md §5b."""

import logging

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.db import get_db
from app.core.rate_limit import make_scope_dependency
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_google_id_token,
    verify_password,
)
from app.models import User
from app.schemas.auth import GoogleAuthRequest, RefreshRequest, Token, UserCreate, UserRead

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

# Per-IP brute-force protection on the unauthenticated endpoints (§5b).
_limit_register = make_scope_dependency("auth:register")
_limit_login = make_scope_dependency("auth:login")
_limit_refresh = make_scope_dependency("auth:refresh")
_limit_google = make_scope_dependency("auth:google")


def _issue_tokens(user: User) -> Token:
    return Token(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_limit_register)],
)
async def register(payload: UserCreate, session: AsyncSession = Depends(get_db)) -> User:
    email = payload.email.lower()
    existing = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email already registered")
    user = User(email=email, hashed_password=hash_password(payload.password))
    session.add(user)
    await session.commit()
    await session.refresh(user)
    logger.info("user registered: %s", user.id)
    return user


@router.post("/login", response_model=Token, dependencies=[Depends(_limit_login)])
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_db),
) -> Token:
    user = (
        await session.execute(select(User).where(User.email == form.username.lower()))
    ).scalar_one_or_none()
    if (
        user is None
        or user.hashed_password is None
        or not verify_password(form.password, user.hashed_password)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _issue_tokens(user)


@router.post("/refresh", response_model=Token, dependencies=[Depends(_limit_refresh)])
async def refresh(payload: RefreshRequest, session: AsyncSession = Depends(get_db)) -> Token:
    try:
        claims = decode_token(payload.refresh_token, expected_type="refresh")
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid refresh token"
        ) from None
    user = (
        await session.execute(select(User).where(User.id == claims["sub"]))
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid refresh token"
        )
    return _issue_tokens(user)


@router.get("/me", response_model=UserRead)
async def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.post("/google", response_model=Token, dependencies=[Depends(_limit_google)])
async def google_login(
    payload: GoogleAuthRequest, session: AsyncSession = Depends(get_db)
) -> Token:
    settings = get_settings()
    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="google sign-in not configured",
        )
    try:
        claims = await run_in_threadpool(verify_google_id_token, payload.credential)
    except jwt.InvalidTokenError as exc:
        logger.warning("google id_token rejected: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid google credential"
        ) from None
    except Exception as exc:  # noqa: BLE001 - JWKS fetch/network errors → 401, never 500
        logger.warning("google id_token verification failed: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid google credential"
        ) from None

    if not claims.get("email_verified", False):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="google email not verified"
        )
    google_sub = claims["sub"]
    email = claims.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="google account has no email"
        )
    email = email.lower()

    try:
        user = (
            await session.execute(select(User).where(User.auth_provider_id == google_sub))
        ).scalar_one_or_none()
        if user is None:
            user = (
                await session.execute(select(User).where(User.email == email))
            ).scalar_one_or_none()
            if user is not None:
                user.auth_provider_id = google_sub  # link existing password account
            else:
                user = User(email=email, auth_provider_id=google_sub)
                session.add(user)
            await session.commit()
            await session.refresh(user)
        return _issue_tokens(user)
    except HTTPException:
        raise
    except Exception:  # noqa: BLE001 - never leak a 500 to the client
        logger.exception("google login failed for %s", email)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="google sign-in failed",
        ) from None
