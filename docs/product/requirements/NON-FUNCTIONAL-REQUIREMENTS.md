# SchoolOS — Non-Functional Requirements

> **Status:** PARTIAL · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** `backend/src/config/*`, `auth/auth.constants.ts`, `app.module.ts`, `.env.example`, `ci.yml`, client `package.json`/`pubspec.yaml` · **Owner:** Product Owner
> Column **Basis**: `OBSERVED` = a value/behaviour present in code or config; `ASPIRATIONAL` = stated in archived planning docs or recommended, **not evidenced in code**; `NONE` = no target exists (a gap). `DECIDED` = an owner-set target/policy (2026-09-20) that the code does **not** yet meet or measure.

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
| NFR-SEC-09 | Security | Tenant isolation on all endpoints (school-scoped data is the default) | PARTIAL | 4 unscoped lists (BR-ORG-03); BL-01..03, BL-20 |
| NFR-AUD-01 | Auditability | State-changing operations write an `AuditLog` row | OBSERVED (partial) | Many services (`grep AuditLog`); completeness unproven |
| NFR-I18N-01 | Localisation | English and Urdu with RTL | OBSERVED | `staff-console/src/locales`, `parent-app/lib/l10n` |
| NFR-A11Y-01 | Accessibility | Accessibility audit tooling in staff console (axe-core) and accessibility sprints | OBSERVED | `staff-console/package.json`; conformance level: UNKNOWN |
| NFR-A11Y-02 | Accessibility | **Target WCAG 2.1 AA** for web apps: keyboard navigation, semantic controls, visible focus, contrast, accessible form errors, labels, responsive layout; parent app follows Android accessibility guidelines | DECIDED 2026-09-20 (not verified) | BL-55 |
| NFR-OFF-01 | Resilience | Parent app degrades to cached data | OBSERVED | `parent-app/lib/src/cache/` |
| NFR-DEV-01 | Compatibility | **Android 9+**, low-memory devices, slow/intermittent networks, small screens, common Android makers; not only high-end devices | DECIDED 2026-09-20 (no device matrix yet) | BL-54 |
| NFR-PERF-01 | Performance | Pilot targets: API p95 < 500 ms (normal CRUD), auth p95 < 1 s, >= 100 concurrent active users; to be load-tested before expansion | DECIDED 2026-09-20 (not measured) | BL-15, BL-40 |
| NFR-AVL-01 | Availability | **99.5 % monthly availability** during the pilot; health/readiness endpoints; uptime monitoring | DECIDED 2026-09-20 (no health endpoint yet) | BL-11 |
| NFR-DAT-01 | Data | PostgreSQL only; additive migrations; FK delete behaviour is a mix of Restrict/Cascade/SetNull (see ERD) | OBSERVED | `schema.prisma`, `migrations/` |
| NFR-DAT-02 | Data | Daily backups (PITR preferred), **RPO <= 24 h, RTO <= 4 h, retention >= 30 days**; tested restore | DECIDED 2026-09-20 (nothing built) | BL-13 |
| NFR-OPS-01 | Operability | Structured logs, Sentry with PII scrubbing, provider DB monitoring, external uptime monitoring | DECIDED 2026-09-20 (nothing built) | BL-11 |
| NFR-SCL-01 | Scalability | Single instance acceptable for the pilot, but horizontally scalable design: object storage, job locking/idempotency, no in-memory distributed state | DECIDED 2026-09-20 (in-process cron and local disk today) | BL-10, BL-39 |
| NFR-QLT-01 | Quality | CI runs backend build/unit/e2e, console lint/test/build, Flutter analyze/test on PR and `main` | OBSERVED | `.github/workflows/ci.yml`; backend lint non-blocking. **Decided:** backend lint becomes blocking after the backlog is cleaned; CI progressively enforces format, lint, type-check, unit, e2e, build (BL-37) |
| NFR-REL-01 | Release | Semantic Versioning, Git tags, first release 1.0.0, PR-based flow, staging validation, owner approval | DECIDED 2026-09-20 (no tags yet) | [RELEASE-CHECKLIST](../../release/RELEASE-CHECKLIST.md) |
| NFR-PRV-01 | Privacy | Privacy-by-design for children's data; retention/archive (no auto-deletion), consent/notice, controlled exports, breach procedures, PII scrubbing; no legal-compliance claim until counsel review | DECIDED 2026-09-20 (controls not built) | [DATA-PROTECTION](../../security/DATA-PROTECTION.md), BL-07, BL-56 |

Items marked `DECIDED` are engineering gaps with an owner decision attached (see [BACKLOG](BACKLOG.md)); remaining `NONE` items were not addressed by the owner.
