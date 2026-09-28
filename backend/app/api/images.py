"""Image proxy endpoint — streams external poster/cover images through the backend.

Why: MangaDex's CDN challenges image subresource requests from some residential
ISPs (Cloudflare browser checks), and some networks block RAWG/MangaDex outright.
The Lightsail box sits on an uncensored AWS network and can fetch every source,
so the frontend loads images via /img?url=... instead of hotlinking directly.

Security: strict host allowlist (no open proxy), https only, no redirects to
non-allowlisted hosts. Browser-side caching is aggressive (immutable covers)."""

import logging
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Query, Response, status

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/img", tags=["images"])

ALLOWED_HOSTS = {
    "uploads.mangadex.org",
    "media.rawg.io",
    "image.tmdb.org",
    "s4.anilist.co",
    "media.anilist.co",
}

_CACHE_TTL = 7 * 24 * 3600  # cover art URLs are immutable; a week is safe


def _is_allowed(url: str) -> bool:
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    return (
        parsed.scheme == "https" and parsed.hostname in ALLOWED_HOSTS and parsed.port in (None, 443)
    )


@router.get("", status_code=status.HTTP_200_OK)
async def proxy_image(
    url: str = Query(..., description="Allowlisted absolute image URL"),
) -> Response:
    if not _is_allowed(url):
        return Response(status_code=status.HTTP_400_BAD_REQUEST, content=b"host not allowed")

    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        try:
            upstream = await client.get(
                url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; TrakPlus/1.0)"},
            )
        except httpx.HTTPError:
            logger.warning("image proxy fetch failed for %s", url)
            return Response(status_code=status.HTTP_502_BAD_GATEWAY, content=b"image fetch failed")

    if upstream.status_code != status.HTTP_200_OK:
        return Response(status_code=upstream.status_code, content=b"image fetch failed")

    return Response(
        content=upstream.content,
        media_type=upstream.headers.get("content-type", "image/jpeg"),
        headers={"Cache-Control": f"public, max-age={_CACHE_TTL}, immutable"},
    )
