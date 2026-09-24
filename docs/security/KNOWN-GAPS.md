# Known Security and Isolation Gaps

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Owner:** Security Owner (Engineering Lead until assigned)
> Consolidates every `CODE ISSUE DISCOVERED` that has a security or data-isolation impact, and absorbs the archived `access-control-scoping-progress.md`. **None has been fixed by the documentation program.** Owner decisions of 2026-09-20 ([OWNER-DECISIONS](../product/OWNER-DECISIONS.md)) now attach a decided remediation to each item (table below); all remain **open engineering work**. Severity is an initial triage for the owner, not a risk assessment.

| ID | Sev. | Gap | Evidence | Related |
|---|---|---|---|---|
| KG-1 | **High** | **School-wide circulars are delivered to every parent in the database** (no school filter) | `circulars/circulars.service.ts:55-57` | TENANT-1 — *root cause:* `Circular` has no school anchor (only optional `sectionId`); fix needs `schoolId` (M2, BL-20) — **Closed 2026-09-25 (BL-20, M2):** circulars carry `schoolId`; school-wide recipients = parents of children actively enrolled in that school (a campus principal: their campus) |
| KG-2 | High | `.env.example` ships `JWT_ACCESS_SECRET="change-me"` (and unused `JWT_REFRESH_SECRET="change-me"`); a copied file boots in production with a publicly-known secret because the fail-fast only triggers when the variable is **unset** | `.env.example`, `jwt-secret.ts:12-18` | **Closed 2026-09-24 (BL-51):** `validateEnv` rejects short/placeholder secrets outside dev/test; `.env.example` ships an empty secret and no refresh secret |
| KG-3 | High | `NODE_ENV` unset ⇒ "development": JWT fallback secret, stub/logging adapters and localhost CORS become active | `jwt-secret.ts:11`, `*-config.ts`, `gateway-config.ts:8`, `cors.config.ts` | **Closed 2026-09-24 (BL-51):** unset `NODE_ENV` refuses to boot; every dev/test check uses `isDevOrTestEnv` (unset = strict) |
| KG-4 | High | With SMTP unset (any environment) `LoggingMailAdapter` writes the full password-reset link, containing the token, to the application log | `notifications/logging-mail.adapter.ts:13` | AUTH — **Closed 2026-09-24 (BL-51):** the adapter logs only masked recipient, subject and body length; delivery failures log only the error message; e2e `auth-password-reset` asserts no link/token in any log |
| KG-5 | High | `npm audit` (2026-09-20): backend 18 vulnerabilities, 9 high, incl. direct `multer`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/schedule`, `prisma`; no dependency scanning in CI | `backend/package.json`, audit output | **Closed 2026-09-24 (BL-12):** High findings fixed (`npm audit fix`; overrides `deepmerge-ts` ^8.0.2, `mysql2` ^3.24.4 under Prisma 7.10); CI fails on High/Critical (`npm audit --omit=dev --audit-level=high`, backend + console). 8 Moderate remain in the `firebase-admin` → google-cloud chain (fix needs `firebase-admin` 14, a major upgrade) |
| KG-6 | High | Holidays: caller-supplied `campusId` unchecked on create; `campusId = null` applies to every campus of every school (holidays block attendance) | `holidays/holidays.service.ts:40-70` | TENANT-2 — *root cause:* `Holiday` has only a nullable `campusId`; fix needs `schoolId` (M2, BL-20) — **Closed 2026-09-25 (BL-20, M2):** holidays carry `schoolId`; create/update/delete are scope-checked (foreign campus → 403); a campus-less holiday applies only within its own school |
| KG-7 | High | `AcademicSession` global; activation deactivates all sessions; "first active" lookups attach records to the wrong session | `academic-session.service.ts:49-53`, `student.service.ts:69`, `fee-vouchers.service.ts:30`, `students-bulk-import.service.ts:100` | TENANT-3, Q1 — **Closed 2026-09-25 (BL-01, M3):** sessions per school; per-school activation; per-school active-session lookups |
| KG-8 | Med | Four list endpoints not school-scoped: `GET /academic-sessions`, `/terms`, `/subjects`, `/fee-structures`; `Subject.name` globally unique | `docs/archive/access-control-scoping-progress.md`, `schema.prisma` | TENANT-4/5, Q2/Q3 — **Partly closed 2026-09-25:** sessions (BL-01) and subjects (BL-02) are school-scoped; terms and fee structures remain (BL-03) |
| KG-9 | Med | Staff console stores access **and** refresh token in `localStorage` | `staff-console/src/stores/auth.ts:77` | AUTH-3 |
| KG-10 | Med | JWT strategy does not re-check the user: lock/delete/role change effective only after ≤ 15 min; no revoke-all/logout endpoint | `auth/strategies/jwt.strategy.ts`, `auth.controller.ts` | AUTH-1, AUTHZ-2 — **Closed 2026-09-24 (BL-21):** JwtStrategy re-reads the user on every request (deleted/disabled/revoked → 401, role from DB); `User.tokenVersion` revocation; `POST /auth/logout`, `/auth/logout-all`, admin `revoke-sessions` |
| KG-11 | Med | `mustChangePassword` not enforced server-side (client redirect only) | `auth.service.ts` only | AUTH-2 — **Closed 2026-09-24 (BL-21):** global `PasswordChangeGuard` answers 403 `PASSWORD_CHANGE_REQUIRED` except change-password, logout-all and `GET /me` |
| KG-12 | Med | No security headers (`helmet`); no CSP | `main.ts` | **Closed 2026-09-24 (BL-12):** `helmet` defaults (CSP, HSTS, nosniff, frame, referrer) via `config/app-security.ts`; CORP `cross-origin` for console `<img>` embeds; e2e `security-headers` |
| KG-13 | Med | Rate limiting behind a reverse proxy: no `trust proxy` configuration; effective client identity unknown | `main.ts`, `app.module.ts` | **Closed 2026-09-24 (BL-12):** `TRUST_PROXY` env; default trusts no proxy (spoofed `X-Forwarded-For` ignored); e2e proves the throttler keys on the forwarded IP behind one trusted hop |
| KG-14 | Med | File upload: extension blacklist, client-reported MIME stored, no malware scan; local-disk storage under app directory | `files.controller.ts:28-66`, `local-disk-storage.adapter.ts` | **Upload part closed 2026-09-24 (BL-52):** type decided from the bytes against an allow-list (PDF, PNG/JPEG/GIF/WebP/HEIC, Office, text/CSV), extension must match, detected MIME stored, empty files refused, optional fail-closed clamd scan (`CLAMAV_HOST`). Storage part remains → BL-10 — **Storage part closed 2026-09-25 (BL-10):** S3-compatible object storage; no local persistent writes outside dev/test |
| KG-15 | Med | Query-string access token accepted on 4 download routes (leaks via logs/history/referrer) | `jwt.strategy.ts:22-41` | — |
| KG-16 | Med | 32 routes rely solely on service-level scoping; no automated guard against a missing `assert*` | [ENDPOINTS](../api/ENDPOINTS.md) | AUTHZ-1 |
| KG-17 | Med | Hard deletes of student/staff PII with no retention or soft-delete policy; FK behaviour mixed | `student.service.ts:155-166` | Q7, DB-5 |
| KG-18 | Med | Payment gateways never verified against live systems; EasyPaisa hash field order unconfirmed; SMS sender targets a placeholder URL | `fees/gateways/*`, `sms-sender.ts:18` | — |
| KG-19 | Low | No global exception filter / request logging; error shape and diagnostics inconsistent | [API-OVERVIEW](../api/API-OVERVIEW.md) | API-2 |
| KG-20 | Low | Seed creates known-password accounts with no production guard; real-sounding demo school name | `prisma/seed.ts` | SEED-3/4 |
| KG-21 | Low | Proprietary `LICENSE` notice and `SECURITY.md` now exist as **placeholders** (`[LEGAL_ENTITY_NAME]`, `[SECURITY_EMAIL]`); real entity, domain and mailbox pending (RD-1/RD-2); `package.json` stays `UNLICENSED` (correct for closed source) | repo root | — |
| KG-23 | Med | `User.isLocked` exists in the schema but is never read or written by application logic, and no endpoint unlocks or disables an account; the only way to stop a compromised account is deleting it or editing the database | `schema.prisma:138`; `auth.service.ts:66` checks only `lockedUntil`; `isLocked` appears in `src/` only as a fixture field in `auth.service.spec.ts` | **Closed 2026-09-24 (BL-21):** `isLocked` = disabled; admin `POST /admin/users/:id/disable|enable|revoke-sessions` (scoped, audited); enable also clears the failed-login lockout |
| KG-22 | Low | Notification failures swallowed, no retry/alerting | `notifications.service.ts:72` | — |

## Decided remediation (owner, 2026-09-20) — all NOT YET IMPLEMENTED
| Gap | Decision / work item | Phase |
|---|---|---|
| KG-1, KG-6 | Fix isolation; regression tests — BL-20 | B |
| KG-2, KG-3, KG-4 | Reject placeholder secrets, require explicit `NODE_ENV`, never log reset links — BL-51 | A |
| KG-5, KG-12, KG-13 | Dependency scanning + audit fixes, `helmet`, `trust proxy` — BL-12 | A |
| KG-7 | School-scoped sessions (Q1) — BL-01 | B |
| KG-8 | School-scoped subjects/terms/fee structures (Q2, Q3) — BL-02, BL-03 | B |
| KG-9, KG-15 | Token-storage hardening review, remove query-string tokens (Q42) — BL-36 | A (decision at security review) |
| KG-10, KG-11, KG-23 | Server-side disable/unlock/revocation/`mustChangePassword` — BL-21 | A |
| KG-14 | Object storage + upload hardening (Q40) — BL-10, BL-52 | A |
| KG-16 | Add guard/test that every service-scoped route asserts scope — BL-18 | H |
| KG-17 | Archive instead of hard delete (Q7) — BL-07 | C |
| KG-18 | Gateways behind feature config, post-pilot; FCM/SMTP verified for pilot — BL-14; SMS adapter — BL-38 | F / post-pilot |
| KG-19 | Global exception filter, request logging — BL-11 | A |
| KG-20 | Neutral demo data, production guard on seed — BL-34 | H |
| KG-22 | Delivery status, retry, alerting — BL-11, BL-14 | A / F |
| new | Privacy/breach/incident processes — BL-56 (non-code) | H |

## Verification standard
An item moves out of this list only when a code change lands **and** a test or documented verification proves it. Q1–Q9 are decided ([BUSINESS-RULES §8](../product/BUSINESS-RULES.md)); the remaining owner inputs (RD-6 retention periods, RD-11 migration approach) gate the final design of KG-7, KG-8 and KG-17.
