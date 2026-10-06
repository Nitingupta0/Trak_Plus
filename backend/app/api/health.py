import asyncio
from typing import Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.config import get_settings
from app.core.db import engine
from app.core.redis import get_redis

router = APIRouter(tags=["health"])

_CHECK_TIMEOUT_SECONDS = 3


@router.get("/health")
async def health() -> dict[str, Any]:
    """Liveness probe: app is up. Never checks dependencies (always 200)."""
    settings = get_settings()
    return {
        "status": "ok",
        "app": settings.app_name,
        "environment": settings.environment,
        "version": "0.1.0",
    }


@router.get("/health/ready")
async def readiness() -> JSONResponse:
    """Readiness probe: verifies Postgres and Redis connectivity. 503 if any is down."""
    components = {
        "database": await _check_database(),
        "redis": await _check_redis(),
    }
    ready = all(c["ok"] for c in components.values())
    return JSONResponse(
        status_code=200 if ready else 503,
        content={
            "status": "ready" if ready else "degraded",
            "components": components,
        },
    )


async def _check_database() -> dict[str, Any]:
    try:
        async with engine.connect() as conn:
            await asyncio.wait_for(conn.execute(text("SELECT 1")), timeout=_CHECK_TIMEOUT_SECONDS)
        return {"ok": True}
    except Exception as exc:  # noqa: BLE001 - health endpoints report any failure
        return {"ok": False, "error": type(exc).__name__}


async def _check_redis() -> dict[str, Any]:
    try:
        client = get_redis()
        await asyncio.wait_for(client.ping(), timeout=_CHECK_TIMEOUT_SECONDS)
        await client.aclose()
        return {"ok": True}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": type(exc).__name__}
