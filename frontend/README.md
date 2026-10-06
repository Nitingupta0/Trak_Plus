# TrakPlus frontend

Next.js 16 (App Router, TypeScript, Tailwind v4, shadcn/ui) — the UI for [TrakPlus](../README.md).

## Develop

```bash
npm install
npm run dev        # http://localhost:3000 (expects the backend on :8000)
```

## Verify

```bash
npm run lint       # ESLint
npm run test       # vitest + React Testing Library (component tests, no backend needed)
npm run build      # production build (standalone output for Docker)
npm run test:e2e   # Playwright — full user journey; needs the compose stack running
```

## Notes

- Backend calls go through two paths: **BFF route handlers** (`src/app/api/auth/*`, `src/app/api/bff/[...path]`) for authenticated requests (httpOnly cookies, never raw JWTs in the browser) and **direct calls** (`src/lib/client/api.ts → publicApi`) for public search/detail.
- Next.js 16 has breaking changes — consult the bundled docs at `node_modules/next/dist/docs/` before writing code (also flagged in `AGENTS.md`).
- UI components are shadcn/ui (Base UI primitives): `npx shadcn@latest add <component>`.
