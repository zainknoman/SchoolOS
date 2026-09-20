# SchoolOS Backend

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Owner:** project owner

NestJS 11 + Prisma 7 + PostgreSQL API. Serves the staff console and the parent app under `/api/v1`. Project overview: [`../README.md`](../README.md).

## Run

```bash
npm install
cp .env.example .env         # DATABASE_URL, SEED_PASSWORD, JWT secrets — see comments in the file
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed          # development databases only
npm run start:dev            # http://localhost:3000 (PORT overrides)
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run build` / `start:prod` | Compile to `dist/` and run it |
| `npm test` | Unit specs (Prisma mocked) |
| `npm run test:e2e` | e2e specs in `test/` against a real PostgreSQL |
| `npm run lint` | ESLint (non-blocking in CI: known formatting backlog) |
| `npm run prisma:seed` | Development seed (`prisma/seed.ts`) |

## Layout

`src/<module>/` one folder per domain (auth, school, campus, student, fees, gradebook, …) · `src/common/` shared scoping/guard helpers (`org-scope`, `student-access`, create/delete guards) · `src/notifications/`, `src/storage/`, `src/fees/gateways/` adapters with dev fallbacks · `prisma/` schema, migrations, seed · `test/` e2e specs.

Documentation: API and database docs are planned in `../docs/api/` and `../docs/database/`; security and operations docs in `../docs/security/`, `../docs/operations/`.
