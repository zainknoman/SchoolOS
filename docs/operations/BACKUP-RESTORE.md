# Backup, Restore and Disaster Recovery

> **Status:** PARTIAL — on-demand backup/restore tooling exists and was rehearsed locally (2026-10-02); scheduling, retention and the provider restore depend on the hosting choice (BL-13) · **Verified:** 2026-10-02 · **Owner:** Operations/Deployment Owner

## Tooling (2026-10-02)
- `npm run db:backup -- --out <dir>`: `pg_dump` custom-format dump of `DATABASE_URL` and a manifest (SHA-256, size, applied migrations, row count per table). Run it **before every release that has a migration**; keep the dump in the secret store/backup bucket, never in the repository.
- `npm run db:restore -- --file <dump> --target-url <url> [--overwrite <db>]`: verifies the checksum, recreates the target, restores and checks migrations and row counts against the manifest. Refuses a non-disposable target unless `--overwrite` names it.
- Needs PostgreSQL client tools 16+ (`PG_BIN` when not on the PATH). Uploaded files are **not** in the dump — restore the bucket to the same point (versioning).
- Local rehearsal record: [RESTORE-REHEARSAL-2026-10-02](../release/RESTORE-REHEARSAL-2026-10-02.md) (backup 3.5 s, verified restore ~15 s on 177,569 rows; rollback to the previous build smoke-tested).

## What must be protected
| Asset | Location | Notes |
|---|---|---|
| Database | PostgreSQL `DATABASE_URL` | all business data and PII |
| Uploaded files | S3-compatible bucket (`STORAGE_DRIVER=s3`, BL-10); `UPLOADS_DIR` only in development/test | referenced by `File` rows; database and bucket must be restored **consistently** or downloads 404 — enable bucket versioning so a restored database can point at the object versions it knew |
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
Restore must use the **provider-supported restore capability** of the (TBD) managed PostgreSQL and object-storage services. Backups are a retention category in the [privacy retention policy](../security/DATA-PROTECTION.md) (period TBD). Targets may be tightened after the pilot. Pilot exit requires a **tested** restore (BL-13, BL-57): rehearsal result and duration recorded in `docs/release/`.

## Still open (vendor-dependent)
Backup encryption keys and off-site copy location (depends on the TBD hosting provider); who is authorised to restore (role `[OPS_OWNER]`; person not yet assigned); restore-test cadence after the pilot; interaction of backup retention with the future PII retention policy (retention periods TBD, BL-63).

## Procedure (scheduling still depends on the provider)
1. Scheduled logical (`npm run db:backup`) or physical/PITR backup of the database **and** the bucket's versioning/lifecycle (or a bucket snapshot) covering the same point in time (`UPLOADS_DIR` only for development/test).
2. Before every deploy that runs migrations: on-demand backup (rollback depends on it).
3. Restore rehearsal into a scratch database: `npm run db:restore` (verifies against the manifest) → start the API against it → `npm run smoke` ([RELEASE-VALIDATION](../testing/RELEASE-VALIDATION.md)).
4. Record the result and duration of each rehearsal.

## Disaster scenarios (not yet covered by any plan)
Database loss · disk loss (uploads) · compromised secret (rotate `JWT_ACCESS_SECRET`; all sessions end) · accidental hard delete of student/staff records (no soft delete — restore is the only recovery, Q7) · region/host loss.
