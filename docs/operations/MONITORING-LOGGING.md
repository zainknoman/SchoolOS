# Monitoring, Logging, Health and Alerting

> **Status:** CURRENT · **Verified:** 2026-09-25 against `wave-0/foundations` (BL-11) · **Sources:** `backend/src/observability/*`, `backend/src/main.ts`, e2e `observability`, unit `observability.spec.ts` · **Owner:** Engineering Lead
> The monitoring *provider* is not chosen (RD-4). Everything below is configured by environment and has no provider hard-coded.

## What exists
| Capability | State | Evidence |
|---|---|---|
| Liveness | `GET /health/live` → `200 {"status":"ok"}` — process up; no dependency checked; unauthenticated, not throttled | `observability/health.controller.ts` |
| Readiness | `GET /health/ready` → `200 {"status":"ok","checks":{"database":"up"}}` or `503 {"status":"unavailable","checks":{"database":"down"}}` (runs `SELECT 1`; never exposes error text) | same; e2e `observability` |
| Request ids | Every response carries `X-Request-Id`: a safe incoming id (`[A-Za-z0-9._-]{8,128}`, e.g. from the load balancer) is kept, anything else replaced by a UUID. The id is in every log line written during the request and in every error body (`requestId`) | `observability/request-context.ts`, `http-observability.ts` |
| Structured logs | `LOG_FORMAT=json` (default outside development/test): one JSON object per line — `time`, `level`, `context`, `requestId`, `message`/fields, `stack` for errors. `LOG_LEVEL` (default `log`) | `observability/json-logger.ts`, `main.ts` |
| Access log | One line per request: `msg:"request"`, method, **path without query string**, status, `durationMs` | `http-observability.ts` |
| Global exception filter | HTTP errors keep their body shape (`statusCode`, `message`, `error`, plus any extra field such as `code`) and gain `requestId`. Unexpected errors return a generic `500 {"statusCode":500,"message":"Internal server error","requestId":…}` — no internals — and are logged with stack and reported | `observability/all-exceptions.filter.ts` |
| Error tracking | Built-in Sentry-envelope client (Sentry or compatible, e.g. GlitchTip), on when `SENTRY_DSN` is set; 5xx and unexpected errors only; best-effort (never affects the request). No SDK dependency | `observability/error-reporter.ts` |
| Audit trail (business) | `AuditLog` table ([HISTORY](../database/HISTORY.md)) | schema |
| Metrics (Prometheus etc.) | **NOT IMPLEMENTED** — use the access log (`durationMs`, `status`) and the provider's host metrics | — |
| Client crash reporting | **NOT IMPLEMENTED** in staff console / parent app (Sentry decided for later) | — |

## PII and secret scrubbing
Everything that leaves the process for a log sink or error tracker passes through `observability/scrub.ts`:
- **by key** (any depth): `password*`, `*secret*`, `*token*`, `authorization`, `cookie`, `apiKey`, `cnic`, `bForm*`, `medical*`, `allerg*`, `diagnos*`, `medication`, `blood*`, `disabilit*`, `temporaryPassword`, `signature` → `[redacted]`;
- **by value** (inside free text): JWTs, CNIC numbers (`#####-#######-#`), 13-digit ID numbers (B-Form/CNIC without dashes), 64-hex reset/refresh tokens, `Bearer …`, `?access_token=`/`token=`/`refreshToken=` query values.
Error events carry only an opaque user id — never identifier, e-mail or name. Request bodies are never logged or reported. The unit "scrub test" (`observability.spec.ts`) asserts this; the BL-51 e2e asserts reset links never reach any log.

## Configuration
| Variable | Default | Meaning |
|---|---|---|
| `LOG_FORMAT` | `json` outside development/test, else `pretty` | `json` \| `pretty` |
| `LOG_LEVEL` | `log` | `verbose` \| `debug` \| `log` \| `warn` \| `error` \| `fatal` (JSON logger) |
| `SENTRY_DSN` | unset (reporting off) | DSN of the chosen error tracker; an invalid DSN refuses to boot |
| `SENTRY_ENVIRONMENT` / `APP_RELEASE` | `NODE_ENV` / unset | tags on reported events |

## Uptime probe and alert rules (provider-agnostic)
Configure in whichever uptime/log/error provider is chosen (T-3):
| Rule | Source | Threshold | Severity (RD-13) |
|---|---|---|---|
| API down | uptime probe on `GET /health/live` from outside the network, every 1 min | 2 consecutive failures | P1 |
| API not ready (DB) | uptime probe on `GET /health/ready` | 3 consecutive failures (≈3 min) | P1 |
| 5xx rate | access log `status >= 500` | > 2 % of requests over 5 min, or > 20 in 5 min | P2 |
| New error type | error tracker | first occurrence of an issue | P3 (triage next business day) |
| Slow API | access log `durationMs` p95 | > 500 ms over 15 min (CRUD) | P3 |
| Auth abuse | access log `path=/api/v1/auth/login`, `status=429` | > 50 in 10 min | P2 |
| Scheduled job failure | log `level=error` with job context | any | P2 |
| Malware scanner unavailable | access log `status=503` on `POST /api/v1/files` | any | P2 |
Targets: 99.5 % monthly availability, API p95 < 500 ms (CRUD), auth p95 < 1 s ([NFR](../product/requirements/NON-FUNCTIONAL-REQUIREMENTS.md)).

## Where failures are still silent
Notification delivery (caught, logged, not retried); e-mail delivery on password reset (caught, logged). Both now appear as JSON log lines with a request id, so a log-based alert can watch for them.
