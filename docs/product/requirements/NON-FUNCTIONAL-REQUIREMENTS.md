# SchoolOS — Non-Functional Requirements

> **Status:** PARTIAL · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** `backend/src/config/*`, `auth/auth.constants.ts`, `app.module.ts`, `.env.example`, `ci.yml`, client `package.json`/`pubspec.yaml` · **Owner:** project owner
> Column **Basis**: `OBSERVED` = a value/behaviour present in code or config; `ASPIRATIONAL` = stated in archived planning docs or recommended, **not evidenced in code**; `NONE` = no target exists (a gap). No performance targets exist in the repository; none are invented here.

| ID | Area | Requirement | Basis | Evidence / status |
|---|---|---|---|---|
| NFR-SEC-01 | Security | Passwords hashed with argon2; never returned | OBSERVED | `auth.service.ts` |
| NFR-SEC-02 | Security | Access token TTL default 15 min (`JWT_ACCESS_TTL`), refresh 30 days, rotate on use, stored hashed | OBSERVED | `auth.constants.ts` |
| NFR-SEC-03 | Security | 5 failed logins → 15-minute lockout | OBSERVED | `auth.constants.ts` |
| NFR-SEC-04 | Security | Auth routes ≤ 5 req/min, global ≤ 100 req/min per client (non-test) | OBSERVED | `throttler.config.ts` (behaviour behind a reverse proxy: UNKNOWN) |
| NFR-SEC-05 | Security | Input validated by DTOs; unknown properties stripped | OBSERVED | `main.ts` `ValidationPipe({whitelist, transform})` |
| NFR-SEC-06 | Security | CORS restricted to an allow-list outside dev/test | OBSERVED | `cors.config.ts`, e2e `cors` |
| NFR-SEC-07 | Security | Secrets come from env; partial provider config fails startup outside dev/test | OBSERVED | `.env.example` comments; `jwt-secret.ts` |
| NFR-SEC-08 | Security | HTTP security headers | NONE | No `helmet` found |
| NFR-SEC-09 | Security | Tenant isolation on all endpoints | PARTIAL | 4 unscoped lists (BR-ORG-03) |
| NFR-AUD-01 | Auditability | State-changing operations write an `AuditLog` row | OBSERVED (partial) | Many services (`grep AuditLog`); completeness unproven |
| NFR-I18N-01 | Localisation | English and Urdu with RTL | OBSERVED | `staff-console/src/locales`, `parent-app/lib/l10n` |
| NFR-A11Y-01 | Accessibility | Accessibility audit tooling in staff console (axe-core) and accessibility sprints | OBSERVED | `staff-console/package.json`; conformance level: UNKNOWN |
| NFR-OFF-01 | Resilience | Parent app degrades to cached data | OBSERVED | `parent-app/lib/src/cache/` |
| NFR-DEV-01 | Compatibility | Low/mid-range Android phones and weak connections | ASPIRATIONAL | Archived `PRD.md`; no device matrix |
| NFR-PERF-01 | Performance | Response-time / throughput / concurrency targets | NONE | Not defined; no load tests |
| NFR-AVL-01 | Availability | Uptime target, health checks, graceful degradation | NONE | No health endpoint; no SLO |
| NFR-DAT-01 | Data | PostgreSQL only; additive migrations; FK delete behaviour is a mix of Restrict/Cascade/SetNull (see ERD) | OBSERVED | `schema.prisma`, `migrations/` |
| NFR-DAT-02 | Data | Backup, restore, retention | NONE | Nothing in repo (Q7) |
| NFR-OPS-01 | Operability | Logging, metrics, alerting | NONE | Default Nest logger only |
| NFR-SCL-01 | Scalability | Multi-instance safe (jobs, storage) | NONE | In-process cron; local-disk storage |
| NFR-QLT-01 | Quality | CI runs backend build/unit/e2e, console lint/test/build, Flutter analyze/test on PR and `main` | OBSERVED | `.github/workflows/ci.yml`; backend lint non-blocking |
| NFR-REL-01 | Release | Versioning, changelog, rollback | NONE | No tags/CHANGELOG (Phase 12) |
| NFR-PRV-01 | Privacy | Protection of student PII (CNIC, B-Form, medical) | NONE (policy) | Q7 |

Items with basis `NONE` are engineering/decision gaps carried to Phase 12 (readiness), not documentation gaps.
