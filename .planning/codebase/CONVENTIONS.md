# Coding Conventions

**Analysis Date:** 2026-08-31

## Naming Patterns

**Files:**
- Python: `snake_case.py`, one module per responsibility — `backend/app/services/tmdb.py`, `backend/app/api/library.py`
- External API clients named after the source: `anilist.py`, `jikan.py`, `mangadex.py`, `rawg.py`, `tmdb.py` in `backend/app/services/`
- Test files: `test_<module_or_feature>.py` in `backend/tests/` (e.g. `backend/tests/test_tmdb.py`, `backend/tests/test_isolation.py`)
- Frontend: Next.js App Router conventions — `page.tsx`, `layout.tsx` under `frontend/src/app/`

**Functions:**
- `snake_case` for all functions; async everywhere in backend (`async def search(...)` in `backend/app/services/tmdb.py`)
- Private helpers prefixed with `_`: `_parse_date()` (`backend/app/services/tmdb.py:24`), `_get_owned_entry()` (`backend/app/api/library.py:17`), `_create_token()` (`backend/app/core/security.py:33`)
- Route handler names describe the verb + resource: `list_library`, `add_entry`, `update_entry`, `delete_entry` (`backend/app/api/library.py`)

**Variables:**
- Module-level constants in `UPPER_SNAKE_CASE`: `TTL_24H = 24 * 3600`, `IMAGE_BASE` (`backend/app/services/tmdb.py:20-21`), `DEFAULT_TIMEOUT_SECONDS` (`backend/app/services/base.py:9`), `VALID_TYPES` (`backend/app/api/search.py:18`)
- Private module singletons with leading underscore: `_pwd_context`, `_jwks_client` (`backend/app/core/security.py:17,22`), `_instances` (`backend/app/services/registry.py:18`)

**Types:**
- Pydantic schema classes use `*Create` / `*Update` / `*Read` suffixes: `LibraryEntryCreate`, `LibraryEntryUpdate`, `LibraryEntryRead` (`backend/app/schemas/library.py`)
- SQLAlchemy models are bare domain nouns: `LibraryEntry`, `Title`, `User`, `Progress` in `backend/app/models/`
- Enums are singular nouns: `MediaType`, `LibraryStatus`, `ExternalSource`, `OfferType` (`backend/app/models/enums.py`)
- Type alias via `Literal`: `TokenType = Literal["access", "refresh"]` (`backend/app/core/security.py:15`)

## Code Style

**Formatting (backend):**
- Tool: ruff (both lint + format), config in `backend/pyproject.toml`
- Key settings: `line-length = 100`, `target-version = "py311"`, `extend-exclude = ["alembic/versions"]`
- Lint rules: `select = ["E", "F", "I", "B", "UP"]` — pycodestyle, pyflakes, isort, bugbear, pyupgrade
- `B008` ignored with justification comment: `# B008: Depends()/Query() in FastAPI parameter defaults is the framework idiom.` (`backend/pyproject.toml:18`)
- Inline `noqa` always carries a reason: `# noqa: BLE001 - cache must never break a request` (`backend/app/services/cache.py:32`), `# noqa: A002` for the `type` query param shadowing a builtin (`backend/app/api/search.py:24`)
- Verify: `cd backend && ruff check .`

**Formatting (frontend):**
- ESLint flat config in `frontend/eslint.config.mjs`: `defineConfig([...nextVitals, ...nextTs])` with `globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"])`
- No Prettier config detected; formatting governed by eslint-config-next
- TypeScript `strict: true` in `frontend/tsconfig.json`, path alias `"@/*": ["./src/*"]`
- Verify: `cd frontend && npm run lint && npm run build`

**Typing style (backend):**
- Modern PEP 604 unions everywhere (`str | None`, `int | None`), builtin generics (`dict[str, Any]`, `list[SearchItem]`) — enforced by ruff `UP`
- Full type hints on public functions and SQLAlchemy 2.0 `Mapped[...]` columns (`backend/app/models/library_entry.py:31-46`)

## Import Organization

**Order (ruff isort, `backend/app/services/tmdb.py:8-16`):**
1. Stdlib (`import logging`, `from datetime import date`)
2. Third-party (`import httpx`, `from fastapi import APIRouter`)
3. Local app (`from app.models.enums import ...`, `from app.services.base import BaseClient`)

**Path Aliases:**
- Backend: absolute imports rooted at `app.` (`from app.core.db import get_db`) — no relative imports
- Frontend: `@/*` maps to `frontend/src/*` (`frontend/tsconfig.json:21-23`)

## Error Handling

**Patterns:**
- HTTP errors: raise `HTTPException` with `status.HTTP_*` constants and a short `detail` string (`backend/app/api/library.py:28,61,72`)
- Shared error instances hoisted to module level: `_CREDENTIALS_ERROR = HTTPException(...)` with `WWW-Authenticate` header (`backend/app/api/deps.py:18-22`)
- Exception chaining: use `raise ... from None` when the original exception is intentionally hidden (`backend/app/api/deps.py:32,37`)
- Narrow catches with intent: `except (KeyError, ValueError)` for payload parsing (`backend/app/api/deps.py:36`)
- External-service failures must degrade, never propagate: CacheLayer wraps every Redis call in broad `except Exception` (with `noqa: BLE001` + reason) and logs a warning (`backend/app/services/cache.py:30-34,47-50`)
- Fan-out resilience: `await asyncio.gather(*tasks, return_exceptions=True)` then skip failed sources with `logger.warning` (`backend/app/api/search.py:50-56`)
- Unrecoverable shutdown cleanup also swallows + logs (`backend/app/services/registry.py:64-69`)
- Do NOT invent a global exception middleware — each router handles its own errors explicitly

## Logging

**Framework:** stdlib `logging` — `logger = logging.getLogger(__name__)` at module top (`backend/app/services/tmdb.py:18`, `backend/app/services/cache.py:15`, `backend/app/api/search.py:14`)

**Patterns:**
- Lazy %-style args, never f-strings in log calls: `logger.warning("redis GET failed for %s; fetching live", key)` (`backend/app/services/cache.py:33`)
- Log cache HIT/MISS at INFO (`backend/app/services/cache.py:39,45`); source failures at WARNING (`backend/app/api/search.py:54`)
- Never log secrets/API keys (root `AGENTS.md` ground rule)

## Comments

**When to Comment:**
- Every module opens with a docstring stating its purpose and cross-referencing the design doc: `"""Redis cache-aside layer (design.md §2). ..."""` (`backend/app/services/cache.py:1-6`), `"""Library CRUD — all queries scoped by the token's user_id (data isolation)."""` (`backend/app/api/library.py:1`)
- Config fields carry "why" comments, including dev-only warnings and secrets-handling instructions (`backend/app/core/config.py:19-35`)
- Non-obvious choices get inline notes: eager-loading rationale (`backend/app/models/library_entry.py:48`), sync-fn requirement for threadpool execution (`backend/tests/test_auth.py:223`)
- Schema-drift is treated as a bug: if code diverges from `docs/design.md`, fix the docs too (root `AGENTS.md`)

**JSDoc/TSDoc:**
- Not observed (frontend is starter code only: `frontend/src/app/page.tsx`, `frontend/src/app/layout.tsx`)

## Function Design

**Size:** Handlers stay small; mapping/parsing logic is extracted into private `_to_*` / `_*_of` helpers (`backend/app/services/tmdb.py:103-181`)

**Parameters:** FastAPI DI via `Depends()` in signatures — `user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db)` (`backend/app/api/library.py:40-41`); client constructors take `api_key` + optional `cache`/`http` for test injection (`backend/app/services/tmdb.py:37-48`)

**Return Values:** Routers declare `response_model` and return ORM objects / typed lists; delete returns `None` with `status_code=204` (`backend/app/api/library.py:101-109`); search returns a plain dict envelope `{"query", "count", "results"}` (`backend/app/api/search.py:58-62`)

## Module Design

**Exports:**
- Routers expose exactly one `router = APIRouter(prefix="...", tags=["..."])`; `backend/app/main.py` imports each as `router as x_router` and includes it in `create_app()` (`backend/app/main.py:7-13,38-43`)
- Singletons via `@lru_cache` factory functions, key-gated by settings (`backend/app/services/registry.py:26-61`)

**Barrel Files:**
- Light re-export barrels: `backend/app/models/__init__.py`, `backend/app/schemas/__init__.py` (tests import `from app.models import Title`, `from app.schemas import SearchItem`)

## Architectural Conventions (from root `AGENTS.md` — mandatory)

- Python 3.11, **async everywhere**, pytest, ruff line 100
- Backend layout is fixed: `backend/app/{api,core,models,schemas,services}`
- External API clients live in `backend/app/services/`, **one per source**, wrapped in Redis cache-aside via `BaseClient._cached()` (`backend/app/services/base.py:39-42`)
- New client checklist: subclass `BaseClient`, set class attrs `base_url` + `source`, implement `search()`/`detail()` normalizing into `SearchItem`/`TitleDetail`, cache the `model_dump()` payload and re-validate on read (`backend/app/services/tmdb.py:53-82`), register an `@lru_cache` getter in `backend/app/services/registry.py`, include in `aclose_all()` teardown
- Env vars via `.env` (see `.env.example`); settings defined in `backend/app/core/config.py` `Settings(BaseSettings)` accessed through `get_settings()`; never hardcode secrets
- Next.js 16 has breaking changes: consult `frontend/AGENTS.md` and the bundled docs at `frontend/node_modules/next/dist/docs/` before writing any Next.js code

---

*Convention analysis: 2026-08-31*
