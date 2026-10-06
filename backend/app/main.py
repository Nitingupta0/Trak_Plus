from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.api.images import router as images_router
from app.api.import_export import router as import_export_router
from app.api.library import router as library_router
from app.api.progress import router as progress_router
from app.api.schedule import router as schedule_router
from app.api.search import router as search_router
from app.api.titles import router as titles_router
from app.core.config import get_settings
from app.core.db import engine
from app.services import registry


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield
    await registry.aclose_all()
    await engine.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(search_router)
    app.include_router(titles_router)
    app.include_router(library_router)
    app.include_router(progress_router)
    app.include_router(schedule_router)
    app.include_router(import_export_router)
    app.include_router(images_router)

    # Prometheus metrics endpoint at /metrics (request latency, error rate, request count).
    Instrumentator().instrument(app).expose(app)

    return app


app: FastAPI = create_app()
