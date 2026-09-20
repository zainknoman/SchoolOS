# SchoolOS Staff Console

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Owner:** project owner

Vue 3 + Vite + TypeScript single-page app for school staff (Super Admin, School Admin/Principal, Accounts, Teacher). Project overview: [`../README.md`](../README.md).

## Run

```bash
npm install
npm run dev          # http://localhost:5173
```

Requires Node `^22.18.0` or `>=24.12.0`. The API base URL comes from `VITE_API_BASE_URL` (default `http://localhost:3000`, see `src/lib/api.ts`). Log in with a seeded account (see the root README).

## Scripts

| Script | Purpose |
|---|---|
| `npm run build` | Type-check and production build |
| `npm test` | Vitest (component/view/store specs) |
| `npm run type-check` | `vue-tsc --build` |
| `npm run lint` | oxlint + ESLint (blocking in CI) |

## Layout

`src/views/` pages (`*PageView.vue` wraps the feature view) · `src/components/` shared UI kit (AppShell, EntityTable, StatusPill, …) · `src/router/index.ts` routes with `meta.requiresRole` / `requiresPrincipal` guards · `src/stores/auth.ts` session · `src/lib/api.ts` API client · `src/locales/{en,ur}.json` i18n · `design-system/` token spec (`MASTER.md`).

Client-side guards only shape the UI; authorization is enforced by the backend. Design rules: [`../DESIGN.md`](../DESIGN.md).
