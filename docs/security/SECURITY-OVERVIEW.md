# Security Overview and Control Status

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** cited per row · **Owner:** Security Owner (Engineering Lead until assigned)
> This is an **inventory of what the code does**, not an audit or a statement that SchoolOS is secure (decision G8: no "sufficient/secure" claims; disclosure contact left `REQUIRES-DECISION`). No penetration test, dependency scan or threat model exists in the repository. Nothing was fixed by this phase; every weakness is a `CODE ISSUE DISCOVERED`, consolidated in [KNOWN-GAPS.md](KNOWN-GAPS.md).
> **Classification:** Implemented · Partial · Configuration required · External dependency · Missing · Unknown.

| # | Control | Class | Evidence / notes |
|---|---|---|---|
| 1 | Password hashing | Implemented | argon2 default parameters (`auth.service.ts:195`, `create-*-user.ts`) |
| 2 | Password policy | Partial | `MinLength(8)` on new passwords only; no complexity/breach checks |
| 3 | Login brute-force protection | Implemented | 5 failures → 15-min lock; 5/min throttle ([AUTHENTICATION](../api/AUTHENTICATION.md)) |
| 4 | Account enumeration defence | Implemented | generic login/forgot/reset messages (`auth.constants.ts`) |
| 5 | Access token (JWT) | Implemented / Configuration required | 15-min TTL; `JWT_ACCESS_SECRET` required outside dev/test — but `.env.example` ships `change-me`, which passes the "is set" check (see KG-2) |
| 6 | Refresh tokens | Implemented | hashed, rotating, 30 days; no logout/revoke-all endpoint (Partial) |
| 7 | Session invalidation on lock/role change | Partial | strategy does not re-read user; delay ≤ 15 min (AUTHZ-2) |
| 8 | RBAC | Implemented | global `RolesGuard`, `@Roles` on 147 of 185 routes (32 any-authenticated, 6 public) ([ENDPOINTS](../api/ENDPOINTS.md)) |
| 9 | Object-level authorization | Implemented / Partial | `StudentAccessService`, `FilesAccessService`; 32 routes rely on service checks alone (AUTHZ-1) |
| 10 | Tenant / campus isolation | **Partial** | `OrgScopeService`; TENANT-1..5 unresolved ([TENANCY](../database/TENANCY.md)) |
| 11 | Input validation | Implemented | global `ValidationPipe({whitelist, transform})` (unknown fields stripped, not rejected) |
| 12 | SQL injection | Implemented (by construction) | Prisma only; no `$queryRaw`/`$executeRaw` in `src/` (grep) |
| 13 | XSS (server) | Implemented | JSON API; downloads forced as attachments with `nosniff` (`files.controller.ts:90-101`) |
| 14 | XSS (staff console) | Unknown | Vue escapes by default; `v-html` usage and CSP not reviewed. Tokens sit in `localStorage` so any XSS yields both tokens (AUTH-3) |
| 15 | CSRF | Not applicable (bearer header) | No cookies used for auth; `?access_token=` on 4 download routes is a leakage risk, not CSRF |
| 16 | Security headers (HSTS, CSP, X-Frame-Options…) | **Missing** | no `helmet`; only `nosniff` on file downloads |
| 17 | CORS | Implemented / Configuration required | allow-list from `CORS_ORIGINS`; dev/test allow any localhost (`cors.config.ts`) |
| 18 | Rate limiting | Partial | global 100/min + auth 5/min; keyed by client IP — behind a proxy without `trust proxy` (not set) all clients may share one bucket: **Unknown** in deployment |
| 19 | File upload security | Partial | 10 MB limit; **extension blacklist** (not allowlist); random storage key; forced download; MIME type client-reported and stored; no malware scan; no per-user quota |
| 20 | Secrets management | Configuration required | env vars only; no vault/rotation procedure; startup fail-fast for partial provider config |
| 21 | Production-mode detection | Implemented (2026-09-24, BL-51) | `NODE_ENV` is required at boot (`config/env.validation.ts`); unset or unknown values refuse to start; outside dev/test placeholder/short JWT secrets and missing `DATABASE_URL`/`CORS_ORIGINS`/`FRONTEND_URL` refuse to start |
| 22 | Audit logging | Partial | `AuditLog` on many writes; no old/new values, no reads, completeness unproven ([HISTORY](../database/HISTORY.md)) |
| 23 | Application logging hygiene | Partial | 4 `console.*` calls + Nest `Logger`; **`LoggingMailAdapter` logs full password-reset links/tokens when SMTP is unset (in any environment)** (KG-4); no PII-redaction policy |
| 24 | Error leakage | Unknown | no exception filter; Nest defaults hide stack traces in the response; unhandled Prisma errors return 500 generic body |
| 25 | PII protection at rest | External dependency | plaintext columns (CNIC, B-Form, medical, addresses, phones); encryption depends on database/disk (see [DATA-PROTECTION](DATA-PROTECTION.md)) |
| 26 | Transport security | External dependency | app serves HTTP; TLS must be terminated upstream (no deployment defined) |
| 27 | Payment webhook authenticity | Implemented / Configuration required | signature check per gateway; stub webhook secret required outside dev/test; **live gateway signatures never verified** (EasyPaisa field order unconfirmed) |
| 28 | Dependency vulnerability management | **Missing** (process) — and findings exist | no `npm audit`/Dependabot/SCA in `ci.yml`. **`npm audit` run 2026-09-20:** backend 18 vulnerabilities (9 high, 9 moderate; 17 in production deps) incl. direct deps `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/schedule`, `multer` (file upload), `prisma`; staff-console 0; parent-app: 7 dependencies constrained below resolvable versions (`flutter pub outdated`) (KG-5) |
| 29 | Static analysis / secret scanning | Missing | none in CI |
| 30 | Backup encryption / DR | External dependency | not defined ([operations](../operations/BACKUP-RESTORE.md)) |
| 31 | Mobile app hardening | Partial | tokens in secure storage; no certificate pinning/obfuscation configuration reviewed |
| 32 | Least-privilege database access | Unknown | single `DATABASE_URL` user; privileges are deployment-defined |
| 33 | Security testing | Partial | e2e authz/tenant/rate-limit/CORS specs exist; no fuzzing, DAST or pen-test |

Related: [DATA-PROTECTION](DATA-PROTECTION.md) · [HARDENING-CHECKLIST](HARDENING-CHECKLIST.md) · [KNOWN-GAPS](KNOWN-GAPS.md) · [../../SECURITY.md](../../SECURITY.md).
