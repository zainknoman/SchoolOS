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
