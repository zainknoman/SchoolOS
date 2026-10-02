# Restore and Rollback Rehearsal — 2026-10-02 (local)

> **Status:** CURRENT (record) · **Environment:** developer laptop, PostgreSQL 17 (local service), no object storage · **Data:** synthetic BL-15 load set (`schoolos_load`, no real personal data) · **Owner:** Technical Owner
> This is a **local** rehearsal of the tooling and the procedure. It does **not** pass [PILOT-EXIT-CHECKLIST](PILOT-EXIT-CHECKLIST.md) A2 or B5: those need the same run on staging with the managed database and the bucket (BL-13).

## Tooling
- `npm run db:backup -- --out <dir>` — `pg_dump` (custom format) of `DATABASE_URL` plus a manifest `<dump>.json`: SHA-256, size, applied migrations, exact row count per table.
- `npm run db:restore -- --file <dump> --target-url <url> [--overwrite <db>]` — checks the checksum, recreates the target database, `pg_restore`, then compares migrations and every table's row count with the manifest; refuses a target whose name does not contain scratch/restore/rehearsal unless `--overwrite` repeats its name.
- `PG_BIN` points at the PostgreSQL client tools when they are not on the PATH (here `C:/Program Files/PostgreSQL/17/bin`).

## Steps and results
| # | Step | Result | Duration |
|---|---|---|---|
| 1 | Backup `schoolos_load` (73 tables, 177,569 rows, 36 migrations) | dump 6.7 MB + manifest | 3.5 s |
| 2 | Restore into `schoolos_restore_rehearsal`, verify against the manifest | 36 migrations and 177,569 rows match | 14.7 s |
| 2b | Restore into the dev database `schoolportal` without `--overwrite` | refused (guard works) | — |
| 3 | "Deploy" this release (`4a4b954`) on the restored copy: `prisma migrate deploy` (3 new migrations), start the API, `npm run smoke` (4 roles, read-only) | migrations applied; smoke 10 passed, 0 failed, 11 skipped (no super admin/console/writes configured; manual items) | migrate 7 s |
| 4 | Roll back: restore the pre-deploy dump over the migrated copy, start the **previous** release build (`ce70653`), `npm run smoke` | restore verified (36 migrations, 177,569 rows); smoke 10 passed, 0 failed | restore 15.3 s; previous build 174 s |
| 5 | Clean-up | rehearsal database dropped, temporary build removed; the dump stayed outside the repository | — |

Measured restore time for this data size: ~15 s, far inside the 4 h RTO (Q26). A production-sized database and the bucket will take longer — the staging run measures that.

## What staging must add (A2, B5)
1. Use the managed database's point-in-time restore **and** `npm run db:backup` before each migration release; restore the bucket to the same point (versioning).
2. Run `npm run smoke` with `SMOKE_WRITES=1` on the test school and `SMOKE_CONSOLE_URL` set.
3. Record date, people, durations and the smoke output here (or a new dated record) and link it from the checklist.
