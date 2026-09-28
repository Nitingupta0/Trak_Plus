"""Library export & import endpoints (design.md §6).

- GET  /library/export?format=json|csv  → download your library (Trakt-compatible)
- GET  /library/export/template          → generic CSV import template
- POST /library/import                   → upload a JSON/CSV file to bulk-populate
"""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models import User
from app.schemas.import_export import ImportResult
from app.services.export_service import export_csv, export_trakt
from app.services.import_service import import_csv, import_trakt_json

logger = logging.getLogger(__name__)

router = APIRouter(tags=["import_export"])

CSV_HEADER = "source,external_id,media_type,status,rating,notes\n"
CSV_TEMPLATE_EXAMPLE = (
    "tmdb,27205,movie,completed,9,Loved the dream heist\n"
    "anilist,20,anime,watching,,Rewatching for the 4th time\n"
)


@router.get("/library/export", name="export_library")
async def export_library(
    format: str = Query("json", pattern="^(json|csv)$"),  # noqa: A002
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Response:
    """Export the authenticated user's library as Trakt-compatible JSON or CSV."""
    if format == "json":
        trakt = await export_trakt(session, str(user.id))
        body = trakt.model_dump_json(indent=2)
        media_type = "application/json"
        filename = "trakplus-library.json"
    else:
        body = await export_csv(session, str(user.id))
        media_type = "text/csv; charset=utf-8"
        filename = "trakplus-library.csv"

    return Response(
        content=body,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/library/export/template", name="export_template")
async def export_template() -> Response:
    """Return a generic CSV template showing accepted columns."""
    return Response(
        content=CSV_HEADER + CSV_TEMPLATE_EXAMPLE,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="trakplus-import-template.csv"'},
    )


@router.post("/library/import", response_model=ImportResult, name="import_library")
async def import_library(
    file: UploadFile,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ImportResult:
    """Import a library from a JSON or CSV file.

    Auto-detects format:
      - JSON: Trakt-style export (history/ratings/watchlist arrays) or our own
        export shape.
      - CSV: generic template (source, external_id, media_type, status, rating, notes).
    Duplicate (user, title) rows are skipped. Unresolvable rows are reported
    per-row in `errors` — never silently dropped.
    """
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="empty file")

    content = raw.decode("utf-8-sig")  # tolerate BOM
    trimmed = content.lstrip()

    try:
        if trimmed.startswith(("{", "[")):
            # JSON import (Trakt or our own)
            # Validate JSON before committing to DB
            json.loads(trimmed)
            result = await import_trakt_json(content, session, str(user.id))
        else:
            result = await import_csv(content, session, str(user.id))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"invalid JSON: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return result
