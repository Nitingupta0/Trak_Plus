from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "TrakPlus API"
    environment: str = "local"
    debug: bool = True

    # Infra (Phase 0: compose services; Phase 1: real schema)
    # Host port 5433 — this dev machine runs a native Postgres on 5432.
    database_url: str = "postgresql+asyncpg://trakplus:trakplus@localhost:5433/trakplus"
    redis_url: str = "redis://localhost:6379/0"

    # Auth (design.md §5b: self-hosted JWT + Google OAuth)
    # Default is dev-only (≥32 bytes to satisfy HS256 key-length rules); set a
    # real secret in production: python -c "import secrets; print(secrets.token_hex(32))"
    jwt_secret_key: str = "dev-insecure-change-me-0123456789abcdef"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    google_client_id: str = ""

    # Per-IP auth rate limiting (design.md §5b hardening): 10 attempts/min
    # per scope. Set 0 to disable (e.g. load tests).
    auth_rate_limit_per_minute: int = 10

    # External API keys (registered manually — see docs/plan.md Phase 0)
    tmdb_api_key: str = ""
    rawg_api_key: str = ""
    # Local Docker may sit behind a TLS-inspecting proxy; production must keep
    # certificate verification enabled (see compose overrides).
    external_api_verify_ssl: bool = True

    # CORS
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
    ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
