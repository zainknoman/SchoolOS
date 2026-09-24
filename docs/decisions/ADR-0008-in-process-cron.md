# ADR-0008: Scheduled work runs in-process

**Status:** Accepted (retroactive) · **Verified:** 2026-09-20 against `main@15362b7`

## Context
Only two periodic tasks exist (attendance risk, digest dispatch).

## Decision
Use `@nestjs/schedule` `@Cron` inside the API process; no queue or separate worker.

## Evidence
- `attendance-risk/attendance-risk.job.ts`, `notifications/digest-dispatch.job.ts`, `app.module.ts` `ScheduleModule.forRoot()`.

## Consequences
No extra infrastructure; but running more than one backend instance duplicates jobs, and there is no retry or job history.

## Review trigger
Revisit before horizontal scaling.

## Update 2026-09-25 (BL-39)
Kept in-process scheduling, and added cluster-wide mutual exclusion: each job runs inside `JobLockService.runExclusive`, which holds `pg_try_advisory_xact_lock(<job key>)` for the run (no schema change; lock released with the transaction). Jobs stay idempotent so a skewed second run is a no-op. Verified by e2e `job-lock` (two app instances, concurrent runs: one digest, one risk notification).
