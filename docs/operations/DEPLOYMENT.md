# Deployment, Runtime Constraints and Scaling

> **Status:** PARTIAL — requirements only · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** repo root listing, `ci.yml`, `backend/package.json`, `nest-cli.json` · **Owner:** project owner
> **`NOT IMPLEMENTED`: the repository defines no deployment target.** There is no Dockerfile, compose file, IaC, process-manager config, reverse-proxy config or deploy job in CI (`find` for Dockerfile/compose/render/Procfile: none; `.github/workflows/` contains only `ci.yml`). This document therefore states **what a deployment must provide** and the exact build/run commands that exist. Hosting choice: `REQUIRES-DECISION` (gate G9).

## Artifacts and commands that exist
| Component | Build | Run | Output |
|---|---|---|---|
| Backend | `npm ci && npx prisma generate && npm run build` (`nest build`) | `npm run start:prod` (`node dist/main`) after `npx prisma migrate deploy` | `dist/` (Node ≥ 22 assumed; CI uses Node 24) |
| Staff console | `npm ci && npm run build` (`vue-tsc` + `vite build`) with `VITE_API_BASE_URL` set | static files from `dist/` behind any web server | static SPA (needs SPA fallback routing) |
| Parent app | `flutter build apk|appbundle|ios` with `--dart-define=API_BASE_URL=…` | store distribution (no signing/store config documented; `flutter run -d chrome` is dev only) | mobile binaries |

## Minimum topology a deployment must provide
1. **One** backend process (jobs and file storage assume a single instance — see below) behind a TLS-terminating reverse proxy.
2. PostgreSQL 16+ with backups ([BACKUP-RESTORE](BACKUP-RESTORE.md)).
3. Persistent, backed-up volume for `UPLOADS_DIR`.
4. Static hosting for the staff console with its origin listed in `CORS_ORIGINS`.
5. Environment configuration per [ENVIRONMENT](ENVIRONMENT.md) and the [hardening checklist](../security/HARDENING-CHECKLIST.md).
6. Monitoring/log collection ([MONITORING-LOGGING](MONITORING-LOGGING.md)); the API has no health endpoint, so use TCP or an authenticated/`GET /` probe with the caveat that `GET /` does not touch the database.

## Database deployment
Run `npx prisma migrate deploy` before starting a new backend version (forward-only, additive; see [MIGRATIONS](../database/MIGRATIONS.md)). Take a backup first; there are no down migrations. **Initial data:** no documented bootstrap for the first SUPER_ADMIN — the only creator in the repository is the development seed (do not use it in production): gap `NOT IMPLEMENTED`.

## Release and rollback
No release process, versioning or tagging exists (see [release docs](../release/RELEASE-CHECKLIST.md)). Rollback = redeploy the previous build **and** restore the pre-migration database backup if a migration ran.

## Runtime constraints (why one instance)
| Constraint | Detail | Evidence |
|---|---|---|
| Scheduled jobs | `AttendanceRiskJob` (03:00 daily) and `DigestDispatchJob` (every 15 min) run inside every instance; two instances ⇒ duplicate flags/digests | `attendance-risk.constants.ts`, `digest-dispatch.job.ts:9` |
| File storage | Uploaded files live on the instance's local disk (`UPLOADS_DIR` or `./uploads`); a second instance or an ephemeral container filesystem loses/hides files | `local-disk-storage.adapter.ts:9` |
| Rate limiting | in-memory counters per process | `ThrottlerModule` default storage |
| Sessions | stateless JWT + DB refresh tokens — horizontally safe | `auth.service.ts` |

## Scaling notes (unmeasured)
No load test or capacity data exists. Unbounded list endpoints (no pagination, [API-OVERVIEW](../api/API-OVERVIEW.md)) and PDF generation in-process are the obvious first bottlenecks. Horizontal scaling requires: shared object storage (adapter to be written), job leader-election or an external scheduler, shared throttler storage.
