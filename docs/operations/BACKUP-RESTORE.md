# Backup, Restore and Disaster Recovery

> **Status:** PARTIAL — requirements only · **Verified:** 2026-09-20 against `main@15362b7` · **Owner:** Operations/Deployment Owner
> **`NOT IMPLEMENTED`:** the repository contains no backup script, schedule, restore procedure, retention setting, or DR plan (grep for `pg_dump`, `backup`, `restore` in non-doc files: none). Nothing below is a procedure that exists; it is what must be decided and built. Verified only: the migrations apply cleanly to an empty PostgreSQL database (13/13, 2026-09-20) — this proves rebuild-from-schema, **not** data recovery.

## What must be protected
| Asset | Location | Notes |
|---|---|---|
| Database | PostgreSQL `DATABASE_URL` | all business data and PII |
| Uploaded files | `UPLOADS_DIR` (local disk) | referenced by `File` rows; database and files must be restored **consistently** or downloads 404 |
| Secrets/config | environment | needed to restart; JWT secret change invalidates sessions |
| Migrations/code | git | reproducible |

## Decided initial targets (owner, 2026-09-20) — tooling NOT IMPLEMENTED
| Target | Value |
|---|---|
| Backup frequency | **daily minimum**; automated **point-in-time recovery preferred** (managed PostgreSQL) |
| RPO (maximum data loss) | **24 hours** |
| RTO (maximum restore time) | **4 hours** |
| Backup retention | **30 days minimum** |
| Uploaded files | held in external object storage (BL-10) with versioning/lifecycle so files and database restore consistently |
Targets may be tightened after the pilot. Pilot exit requires a **tested** restore (BL-13, BL-57): rehearsal result and duration recorded in `docs/release/`.

## Still `REQUIRES-DECISION`
Backup encryption keys and off-site copy location (depends on hosting, RD-3); who is authorised to restore (Operations/Deployment Owner unnamed, RD-5); restore-test cadence after the pilot; interaction of backup retention with the future PII retention policy (RD-6).

## Minimal procedure to write once tooling is chosen
1. Scheduled logical (`pg_dump`) or physical backup of the database **and** snapshot of `UPLOADS_DIR` at the same time.
2. Before every deploy that runs migrations: on-demand backup (rollback depends on it).
3. Restore rehearsal into a scratch database: restore dump → `npx prisma migrate status` → start the API against it → smoke tests ([RELEASE-VALIDATION](../testing/RELEASE-VALIDATION.md)).
4. Record the result and duration of each rehearsal.

## Disaster scenarios (not yet covered by any plan)
Database loss · disk loss (uploads) · compromised secret (rotate `JWT_ACCESS_SECRET`; all sessions end) · accidental hard delete of student/staff records (no soft delete — restore is the only recovery, Q7) · region/host loss.
