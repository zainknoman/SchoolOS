# Seeding

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** `backend/prisma/seed.ts` (296 lines), `backend/package.json` (`prisma:seed`), `.env.example` · **Owner:** Engineering Lead

**Purpose:** development/demo data only. **Never run against a production database** — the script has no environment guard and creates well-known demo accounts.

| Item | Fact | Evidence |
|---|---|---|
| Command | `npm run prisma:seed` (ts-node) | `package.json` |
| Required env | `SEED_PASSWORD` (throws if missing); `DATABASE_URL`; **`NODE_ENV` must be `development` or `test`** — the seed refuses otherwise (BL-22) | `seed.ts` |
| Real systems | Use `npm run bootstrap:super-admin` for the first administrator ([DEPLOYMENT](../operations/DEPLOYMENT.md)); the demo seed is never run outside development/test | `src/cli/bootstrap-super-admin.ts` |
| Idempotent? | **No.** Uses `createMany`; there are no deletes/upserts, so it is meant for an empty database (a second run hits unique constraints) | `seed.ts` |
| Organisation | 2 schools (first named "Beacon House" — a real-sounding school brand; contact fields use `*.example.edu.pk` / `*.schoolportal.local`), several campuses each, 2 sessions per school (`2025-2026` inactive, `2026-2027` **active in both schools**), 8 grades × sections per campus, subjects | `seed.ts:17-160` |
| People | superadmin, per-school admin/principal/accounts, teachers per section, students with parents, staff, support staff, addresses, files (campus logos) | `seed.ts:161-238` |
| Academic data | enrollments, timetable, attendance, diary, admissions, hiring examples | `seed.ts` (see README history for the older description) |
| Identifiers | `@schoolportal.local` (rebrand leftover); parents `<prefix>.<gr>@parent.schoolportal.local`; password = `SEED_PASSWORD` for all | `seed.ts:161-230` |

## Code issues discovered (recorded, not fixed)
| ID | Issue | Impact |
|---|---|---|
| SEED-1 | Seeds one `isActive: true` session per school; the API allows only one active session platform-wide (BR-ORG-01) | Seeded state cannot be reproduced through the product; multi-school "first active session" lookups pick arbitrarily |
| SEED-2 | `schoolId` is placed on the in-memory session object but `createMany` is given the copy without it (`seed.ts:155-156`) — harmless because the schema has no such column, but misleading | Confusion when reading the seed |
| SEED-3 | Demo school name looks like a real institution ("Beacon House") | Trademark/PII hygiene; previous README described them as generic placeholders |
| SEED-4 | No production guard | Accidental run creates known-password admin accounts |

Documentation-folder copies (`docs/archive/database/seed-data.ts`, `seed-expanded.ts`) are stale archives, not the seed.
