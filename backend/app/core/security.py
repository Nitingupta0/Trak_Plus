"""Security primitives: password hashing, JWT issue/decode, Google id_token
verification. See design.md §5b."""

import logging
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import jwt
from passlib.context import CryptContext

from app.core.config import get_settings

logger = logging.getLogger(__name__)

TokenType = Literal["access", "refresh"]

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
_GOOGLE_ISSUER = "https://accounts.google.com"

_jwks_client: jwt.PyJWKClient | None = None


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


def _create_token(user_id: str, token_type: TokenType, expires_delta: timedelta) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": user_id,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: str) -> str:
    return _create_token(
        user_id, "access", timedelta(minutes=get_settings().access_token_expire_minutes)
    )


def create_refresh_token(user_id: str) -> str:
    return _create_token(
        user_id, "refresh", timedelta(days=get_settings().refresh_token_expire_days)
    )


def decode_token(token: str, expected_type: TokenType) -> dict[str, Any]:
    """Decode a JWT and assert its `type` claim matches (refresh ≠ access)."""
    settings = get_settings()
    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError(f"expected {expected_type} token, got {payload.get('type')}")
    return payload


def verify_google_id_token(id_token: str) -> dict[str, Any]:
    """Verify a Google Identity Services id_token: RS256 signature via Google's
    JWKS, correct issuer and audience. Returns the claim set (sub, email, ...)."""
    global _jwks_client
    settings = get_settings()
    if _jwks_client is None:
        _jwks_client = jwt.PyJWKClient(_GOOGLE_JWKS_URL)
    signing_key = _jwks_client.get_signing_key_from_jwt(id_token)
    return jwt.decode(
        id_token,
        signing_key.key,
        algorithms=["RS256"],
        audience=settings.google_client_id,
        issuer=_GOOGLE_ISSUER,
        # Google and the local container can differ by a few seconds. Allow
        # normal clock skew without weakening signature/audience validation.
        leeway=60,
    )
