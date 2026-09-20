# Deployment, Runtime Constraints and Scaling

> **Status:** PARTIAL — requirements only · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** repo root listing, `ci.yml`, `backend/package.json`, `nest-cli.json` · **Owner:** Operations/Deployment Owner
> **`NOT IMPLEMENTED`: the repository defines no deployment target.** There is no Dockerfile, compose file, IaC, process-manager config, reverse-proxy config or deploy job in CI (`find` for Dockerfile/compose/render/Procfile: none; `.github/workflows/` contains only `ci.yml`). This document therefore states **what a deployment must provide** and the exact build/run commands that exist. Hosting provider/region: `REQUIRES-DECISION` (RD-3); the owner decided (2026-09-20) that the design must be **provider-agnostic** — no cloud provider is hard-coded.

## Decided target environments (owner, 2026-09-20) — NOT IMPLEMENTED
| Environment | Host name (placeholder) | Purpose |
|---|---|---|
| Development | local | developer machines |
| Staging | `staging.<production-domain>` | PR/release validation; separate database, secrets and Firebase project |
| Production | `app.<production-domain>` (or equivalent) | live pilot |
Domains stay placeholders until finalised (RD-2). Each environment needs: **HTTPS**, **managed PostgreSQL**, environment-specific secrets (never shared across environments), **external S3-compatible object storage** (BL-10), automated backups (BL-13), Sentry/uptime monitoring (BL-11). A **single backend instance is acceptable for the pilot**, but the design must stay horizontally scalable: no persistent uploads on local disk, storage behind an abstraction, background jobs with safe locking/idempotency (BL-39), no in-memory state for distributed workflows.
Release flow (owner): feature branch → PR/review → staging deployment → automated tests → acceptance verification → production tag (`vMAJOR.MINOR.PATCH`, first release `1.0.0`) with Product/Engineering approval — see [RELEASE-CHECKLIST](../release/RELEASE-CHECKLIST.md). No direct commits to the production branch.
**First SUPER_ADMIN:** decided to be created only by a **one-time controlled bootstrap** (secrets from the environment/secret manager, forced password change, mechanism disabled afterwards, no public registration) — `NOT IMPLEMENTED` (BL-22).

## Artifacts and commands that exist
| Component | Build | Run | Output |
|---|---|---|---|
| Backend | `npm ci && npx prisma generate && npm run build` (`nest build`) | `npm run start:prod` (`node dist/main`) after `npx prisma migrate deploy` | `dist/` (Node ≥ 22 assumed; CI uses Node 24) |
| Staff console | `npm ci && npm run build` (`vue-tsc` + `vite build`) with `VITE_API_BASE_URL` set | static files from `dist/` behind any web server | static SPA (needs SPA fallback routing) |
| Parent app | `flutter build apk|appbundle|ios` with `--dart-define=API_BASE_URL=…` | store distribution (no signing/store config documented; `flutter run -d chrome` is dev only) | mobile binaries |

## Minimum topology a deployment must provide
1. **One** backend process for the pilot (jobs and file storage currently assume a single instance — see below; decided to be removed by BL-10/BL-39) behind a TLS-terminating reverse proxy.
2. PostgreSQL 16+ with backups ([BACKUP-RESTORE](BACKUP-RESTORE.md)).
3. Today: persistent, backed-up volume for `UPLOADS_DIR`. **Decided replacement:** S3-compatible object storage (BL-10); local disk must not hold permanent uploads in production.
4. Static hosting for the staff console with its origin listed in `CORS_ORIGINS`.
5. Environment configuration per [ENVIRONMENT](ENVIRONMENT.md) and the [hardening checklist](../security/HARDENING-CHECKLIST.md).
6. Monitoring/log collection ([MONITORING-LOGGING](MONITORING-LOGGING.md)); the API has no health endpoint, so use TCP or an authenticated/`GET /` probe with the caveat that `GET /` does not touch the database.

## Database deployment
Run `npx prisma migrate deploy` before starting a new backend version (forward-only, additive; see [MIGRATIONS](../database/MIGRATIONS.md)). Take a backup first; there are no down migrations. **Initial data:** no documented bootstrap for the first SUPER_ADMIN — the only creator in the repository is the development seed (do not use it in production): gap `NOT IMPLEMENTED`.

## Release and rollback
No release automation or tags exist yet; the convention is decided (Semantic Versioning, Git tags, first release 1.0.0; see [release docs](../release/RELEASE-CHECKLIST.md)). Rollback = redeploy the previous build **and** restore the pre-migration database backup if a migration ran.

## Runtime constraints (why one instance)
| Constraint | Detail | Evidence |
|---|---|---|
| Scheduled jobs | `AttendanceRiskJob` (03:00 daily) and `DigestDispatchJob` (every 15 min) run inside every instance; two instances ⇒ duplicate flags/digests | `attendance-risk.constants.ts`, `digest-dispatch.job.ts:9` |
| File storage | Uploaded files live on the instance's local disk (`UPLOADS_DIR` or `./uploads`); a second instance or an ephemeral container filesystem loses/hides files | `local-disk-storage.adapter.ts:9` |
| Rate limiting | in-memory counters per process | `ThrottlerModule` default storage |
| Sessions | stateless JWT + DB refresh tokens — horizontally safe | `auth.service.ts` |

## Scaling notes (unmeasured)
No load test or capacity data exists. Unbounded list endpoints (no pagination, [API-OVERVIEW](../api/API-OVERVIEW.md)) and PDF generation in-process are the obvious first bottlenecks. Horizontal scaling requires: shared object storage (adapter to be written), job leader-election or an external scheduler, shared throttler storage.
