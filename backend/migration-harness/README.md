# Migration test harness (BL-65)

Rehearses data-changing migrations **before** they touch shared data (gate for BL-01/02/03/20/23/60/61/25; see BL-62 and `docs/release/EXECUTION-PLAN.md`).

What a run does (`npm run migration:harness -- <scenario>`; scenarios live in `scenarios/`):
1. creates a throwaway database named `schoolos_scratch_<id>` (the harness **refuses to touch any other database name** and drops it afterwards; use `--keep` to inspect);
2. applies the LEGACY schema (`legacyUpTo`, default: all current migrations) and builds the production-like dataset in `fixtures/legacy-dataset.mjs`;
3. applies the migration(s) under test (`target.after` in the repo migrations, or `target.dir`) and the optional idempotent `backfill`;
4. runs the backfill a **second time** and fails the scenario if anything changed (idempotency);
5. writes `out/<scenario>-*.json` (reconciliation counts before/after per table, check results, review rows) and `*-review.csv` (the ambiguity / manual-review list).

`dry-run.mjs` is the **read-only BL-62 dry-run classifier** (rules and review categories: `docs/database/MIGRATION-STRATEGY.md`). Run it against any real database copy with `npm run migration:dry-run -- [--url <postgres-url>]` (default `DATABASE_URL`/`.env`): it runs inside a `READ ONLY` transaction, writes `out/dry-run-<db>-*.json` and `-review.csv`, and prints any **blocking** rows. It reports split-required and unreferenced sessions, unresolvable session dependents, multiple active sessions, cloneable/unreferenced subjects (Timetable, Assessment, DiaryEntry), fee-structure attribution by voucher label, guardian duplicate candidates (shared phone/e-mail — never names), `LEFT` rows with/without a matching `TRANSFERRED_OUT` promotion, circular/holiday rows without a school anchor, and attendance rows whose real actor can be recovered from `AuditLog` (`attendance.mark`, `attendance.mark-bulk`, `leave-request.approve`).

Server: `MIGRATION_HARNESS_ADMIN_URL` (else `DATABASE_URL`, else `backend/.env`) — the role needs `CREATEDB`. Tests: `npm run migration:harness:test` (skips when no server is reachable). Rollback rehearsal = restore of a pre-migration dump into another scratch database and re-running the checks (add as a scenario step when a real migration exists).
