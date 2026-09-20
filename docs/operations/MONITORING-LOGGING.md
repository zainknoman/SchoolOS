# Monitoring, Logging, Health and Alerting

> **Status:** PARTIAL — as-is inventory plus gaps · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** `backend/src/**` (grep for `Logger`, `console.*`, `helmet`, health), `package.json` · **Owner:** project owner

## What exists
| Capability | State | Evidence |
|---|---|---|
| Application logs | Nest default logger to stdout/stderr; a few `Logger.log` calls (adapters) and 4 `console.*` calls (`auth.service.ts:179`, `main.ts:22`, `logging-push.adapter.ts:12`, `notifications.service.ts:75`) | grep |
| Request/access logs | **None** in the app (no logging interceptor/middleware); rely on the reverse proxy | no `APP_INTERCEPTOR` |
| Structured logging / correlation ids | **NOT IMPLEMENTED** | — |
| Health/readiness endpoint | **NOT IMPLEMENTED.** `GET /` returns `"Hello World!"` without touching the database — not a health check | `app.controller.ts`, `app.service.ts` |
| Metrics (Prometheus etc.) | **NOT IMPLEMENTED** | `package.json` |
| Error tracking (Sentry etc.) | **NOT IMPLEMENTED** | `package.json` |
| Alerting | **NOT IMPLEMENTED** | — |
| Audit trail (business) | `AuditLog` table, many writes ([HISTORY](../database/HISTORY.md)) | schema |
| Client crash/analytics | none in staff console or parent app | dependencies |

## Sensitive data in logs
Password-reset links with tokens are logged when SMTP is unset (KG-4); push no-op logs user id and title; notification failures log the error object. No redaction policy.

## Minimum production expectations (to be built)
Liveness + readiness endpoints (DB check); JSON logs with request id; log retention and access control; alerts on 5xx rate, cron failure, payment webhook failures, disk usage of `UPLOADS_DIR`, database connectivity/space; uptime probe of the API and staff console.

## Where failures are silent today
Notification delivery (caught, logged, not retried); email delivery on password reset (caught, logged); cron jobs (an exception in a job is logged by Nest scheduler at best); payment webhook rejections (401 only).
