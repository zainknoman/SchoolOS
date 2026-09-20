# Known Security and Isolation Gaps

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Owner:** project owner
> Consolidates every `CODE ISSUE DISCOVERED` that has a security or data-isolation impact, and absorbs the archived `access-control-scoping-progress.md`. **None has been fixed by the documentation program.** Severity is an initial triage for the owner, not a risk assessment.

| ID | Sev. | Gap | Evidence | Related |
|---|---|---|---|---|
| KG-1 | **High** | **School-wide circulars are delivered to every parent in the database** (no school filter) | `circulars/circulars.service.ts:55-57` | TENANT-1 |
| KG-2 | High | `.env.example` ships `JWT_ACCESS_SECRET="change-me"` (and unused `JWT_REFRESH_SECRET="change-me"`); a copied file boots in production with a publicly-known secret because the fail-fast only triggers when the variable is **unset** | `.env.example`, `jwt-secret.ts:12-18` | — |
| KG-3 | High | `NODE_ENV` unset ⇒ "development": JWT fallback secret, stub/logging adapters and localhost CORS become active | `jwt-secret.ts:11`, `*-config.ts`, `gateway-config.ts:8`, `cors.config.ts` | — |
| KG-4 | High | With SMTP unset (any environment) `LoggingMailAdapter` writes the full password-reset link, containing the token, to the application log | `notifications/logging-mail.adapter.ts:13` | AUTH |
| KG-5 | High | `npm audit` (2026-09-20): backend 18 vulnerabilities, 9 high, incl. direct `multer`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/schedule`, `prisma`; no dependency scanning in CI | `backend/package.json`, audit output | — |
| KG-6 | High | Holidays: caller-supplied `campusId` unchecked on create; `campusId = null` applies to every campus of every school (holidays block attendance) | `holidays/holidays.service.ts:40-70` | TENANT-2 |
| KG-7 | High | `AcademicSession` global; activation deactivates all sessions; "first active" lookups attach records to the wrong session | `academic-session.service.ts:49-53`, `student.service.ts:69`, `fee-vouchers.service.ts:30`, `students-bulk-import.service.ts:100` | TENANT-3, Q1 |
| KG-8 | Med | Four list endpoints not school-scoped: `GET /academic-sessions`, `/terms`, `/subjects`, `/fee-structures`; `Subject.name` globally unique | `docs/archive/access-control-scoping-progress.md`, `schema.prisma` | TENANT-4/5, Q2/Q3 |
| KG-9 | Med | Staff console stores access **and** refresh token in `localStorage` | `staff-console/src/stores/auth.ts:77` | AUTH-3 |
| KG-10 | Med | JWT strategy does not re-check the user: lock/delete/role change effective only after ≤ 15 min; no revoke-all/logout endpoint | `auth/strategies/jwt.strategy.ts`, `auth.controller.ts` | AUTH-1, AUTHZ-2 |
| KG-11 | Med | `mustChangePassword` not enforced server-side (client redirect only) | `auth.service.ts` only | AUTH-2 |
| KG-12 | Med | No security headers (`helmet`); no CSP | `main.ts` | — |
| KG-13 | Med | Rate limiting behind a reverse proxy: no `trust proxy` configuration; effective client identity unknown | `main.ts`, `app.module.ts` | — |
| KG-14 | Med | File upload: extension blacklist, client-reported MIME stored, no malware scan; local-disk storage under app directory | `files.controller.ts:28-66`, `local-disk-storage.adapter.ts` | — |
| KG-15 | Med | Query-string access token accepted on 4 download routes (leaks via logs/history/referrer) | `jwt.strategy.ts:22-41` | — |
| KG-16 | Med | 32 routes rely solely on service-level scoping; no automated guard against a missing `assert*` | [ENDPOINTS](../api/ENDPOINTS.md) | AUTHZ-1 |
| KG-17 | Med | Hard deletes of student/staff PII with no retention or soft-delete policy; FK behaviour mixed | `student.service.ts:155-166` | Q7, DB-5 |
| KG-18 | Med | Payment gateways never verified against live systems; EasyPaisa hash field order unconfirmed; SMS sender targets a placeholder URL | `fees/gateways/*`, `sms-sender.ts:18` | — |
| KG-19 | Low | No global exception filter / request logging; error shape and diagnostics inconsistent | [API-OVERVIEW](../api/API-OVERVIEW.md) | API-2 |
| KG-20 | Low | Seed creates known-password accounts with no production guard; real-sounding demo school name | `prisma/seed.ts` | SEED-3/4 |
| KG-21 | Low | No CHANGELOG/LICENSE/SECURITY contact; `package.json` says `UNLICENSED` | repo root | — |
| KG-23 | Med | `User.isLocked` exists in the schema but is never read or written by application logic, and no endpoint unlocks or disables an account; the only way to stop a compromised account is deleting it or editing the database | `schema.prisma:138`; `auth.service.ts:66` checks only `lockedUntil`; `isLocked` appears in `src/` only as a fixture field in `auth.service.spec.ts` | — |
| KG-22 | Low | Notification failures swallowed, no retry/alerting | `notifications.service.ts:72` | — |

## Verification standard
An item moves out of this list only when a code change lands **and** a test or documented verification proves it. Owner decisions (Q1–Q9 in [BUSINESS-RULES](../product/BUSINESS-RULES.md)) gate KG-6, KG-7, KG-8, KG-17.
