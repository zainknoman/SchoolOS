# Migration Checklist

> **Status:** CURRENT (procedure) · **Verified:** 2026-09-20 · **Sources:** [MIGRATIONS](../database/MIGRATIONS.md), `prisma.config.ts`, `ci.yml` · **Owner:** project owner

Migrations are forward-only and additive (ADR-0005). Use this list for every release that includes a new folder under `backend/prisma/migrations/`.

**Authoring**
- [ ] New migration is additive: new tables or nullable/defaulted columns; no `DROP`/rename; if a column must become required, ship a backfill first
- [ ] Prisma schema and migration SQL agree (`prisma migrate diff` or a fresh `migrate dev` yields no drift)
- [ ] New tenant-relevant data has a path to a school/campus (see [TENANCY](../database/TENANCY.md)) — do not add another unscoped table
- [ ] Data-dictionary/ERD regenerated (docs are generated from `schema.prisma`) and `MIGRATIONS.md` history row added

**Verification**
- [ ] Applies to an **empty** database (`migrate deploy`) — CI does this
- [ ] Applies to a **copy of production-like data**; row counts and key constraints checked; duration measured (large `ALTER TABLE` can lock)
- [ ] Backend unit + e2e green against the migrated database

**Deployment**
- [ ] Backup taken immediately before (rollback = restore)
- [ ] Maintenance window agreed if the migration locks large tables
- [ ] `npx prisma migrate deploy` run once (single runner); `npx prisma migrate status` shows no pending/failed
- [ ] Smoke test passed; failed migration handling: do **not** edit applied migrations; resolve with `prisma migrate resolve` only after a documented review

**Known caveats**
Earlier columns (`User.schoolId`, `User.campusId`) were added nullable without backfill — existing users without them are denied org-scoped access until updated (DB-1). No migration tests exist beyond apply-to-empty.
