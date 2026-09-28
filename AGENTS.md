# AGENTS.md — TrakPlus

Guidance for AI coding agents working in this repo.

## Project

Multi-media tracker (movies/TV/games/anime/manga). FastAPI backend + Next.js 16 frontend, Postgres + Redis, Docker Compose locally, Terraform/EKS planned. Product spec: `docs/prod.md`. Architecture: `docs/design.md`. Build plan: `docs/plan.md`.

## Ground rules

- Read `docs/todos.md` before starting work — it defines phase order, task passing criteria, and testing/docs checkpoints. Do not skip ahead of the current phase.
- Update `docs/progress.md` (short entry, same day) whenever a 📝 checkpoint is reached.
- If code reality diverges from `docs/design.md`, fix the docs too — drift is treated as a bug.
- Never commit or push unless the user explicitly asks.

## Conventions

- Backend: Python 3.11, async everywhere, ruff (line length 100), pytest. Layout: `backend/app/{api,core,models,schemas,services}`. External API clients live in `app/services/`, one per source, wrapped in Redis cache-aside.
- Frontend: TypeScript, App Router with `src/` dir, Tailwind v4. Next 16 has breaking changes vs older knowledge — consult `frontend/AGENTS.md` and the bundled docs it points to before writing Next.js code.
- Env vars via `.env` (see `.env.example`). Never hardcode secrets; never log API keys.

## Verify before saying done

- Backend: `cd backend && .venv\Scripts\python -m pytest` and `ruff check .`
- Frontend: `cd frontend && npm run lint && npm run test && npm run build`
- E2E (needs the compose stack running): `cd frontend && npm run test:e2e` — must pass 3× in a row for UI changes to the core flow
- Full stack: `docker compose up --build` then `curl http://localhost:8000/health` and open http://localhost:3000

## Codebase map

`.planning/codebase/` holds a GSD-generated map (STACK, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, INTEGRATIONS, CONCERNS) — consult it before planning work; refresh with `/gsd-map-codebase` after significant changes.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
