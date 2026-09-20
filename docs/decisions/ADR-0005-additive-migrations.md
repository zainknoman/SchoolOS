# ADR-0005: Migrations are additive-only

**Status:** Accepted (retroactive) · **Verified:** 2026-09-20 against `main@15362b7`

## Context
Existing data must survive schema growth without data-loss migrations.

## Decision
New tables or new nullable/defaulted columns only; nothing is removed, renamed or made required without a backfill. Rollback = restore from backup (no down migrations).

## Evidence
- Policy statement: `docs/database/migration-plan.md` (archived copy under `docs/archive/database/`) and `docs/database/MIGRATIONS.md`.
- 13 migrations under `backend/prisma/migrations/`.

## Consequences
Low-risk deploys; but schema debt accumulates (e.g. `Subject`, `AcademicSession` never gained a school column).

## Review trigger
Revisit for the multi-tenant/school-scoped session change (needs a data backfill).
