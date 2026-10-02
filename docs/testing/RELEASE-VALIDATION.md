# Release Validation

> **Status:** CURRENT (procedure) · **Verified:** 2026-09-20 against `main@15362b7` · **Owner:** Engineering Lead
> What must be run and confirmed before a build is released. Items marked **(gap)** have no automation today and would have to be done manually or built. Nothing here has been executed as a release; the first row set was executed once on 2026-09-20 as documentation evidence ([TESTING-STRATEGY](TESTING-STRATEGY.md)).

## 1. Automated gates (exist)
| Gate | Command | Pass criterion |
|---|---|---|
| Backend build | `cd backend && npm ci && npx prisma generate && npm run build` | exit 0 |
| Backend unit | `npm test` | all pass |
| Migrations on empty DB | `npx prisma migrate deploy` against a fresh database | all migrations apply |
| Backend e2e | `npm run test:e2e` (needs PostgreSQL) | all pass |
| Console | `cd staff-console && npm ci && npm run lint && npm test && npm run build` | exit 0 |
| Parent app | `cd parent-app && flutter analyze && flutter test` | no issues; all pass |
| Backend lint / format / types | `npm run lint && npm run format:check && npm run typecheck` | exit 0 (0 errors, 0 warnings; blocking in CI since BL-37) |

## 2. Manual/pre-release checks (gaps)
| Check | Detail |
|---|---|
| Migration rehearsal **(gap)** | restore last production-like backup → `migrate deploy` → `migrate status` → run smoke tests |
| Dependency audit **(gap)** | `npm audit` for backend/console; review `flutter pub outdated`; current backend result: 18 vulnerabilities (KG-5) |
| Config validation **(gap)** | [HARDENING-CHECKLIST](../security/HARDENING-CHECKLIST.md) all configuration items ticked |
| Integration sandbox runs **(gap)** | one signed test transaction per gateway; one push, one email, one SMS/WhatsApp delivered ([INTEGRATIONS](../operations/INTEGRATIONS.md)) |
| Backup exists **(gap)** | pre-deploy backup taken and restorable |
| Known-defect review | [KNOWN-GAPS](../security/KNOWN-GAPS.md): each High item fixed or explicitly accepted by the owner |

## 3. Production smoke test (automated 2026-10-02: `npm run smoke`)
`backend/src/cli/smoke-test.ts` is a black-box HTTP runner; it calls only the public API, so it runs the same against local, staging and production. Run it from `backend/` after `npm run build`:

```
SMOKE_BASE_URL=https://api.[PRODUCTION_DOMAIN] SMOKE_CONSOLE_URL=https://console.[PRODUCTION_DOMAIN] \
SMOKE_SCHOOL_ADMIN_IDENTIFIER=… SMOKE_SCHOOL_ADMIN_PASSWORD=… (and SUPER_ADMIN / ACCOUNTS / TEACHER / PARENT) \
npm run smoke
```

| Variable | Use |
|---|---|
| `SMOKE_BASE_URL` | API origin (required); anything but localhost must be HTTPS |
| `SMOKE_CONSOLE_URL` | console origin — checks the page and its Content-Security-Policy |
| `SMOKE_<ROLE>_IDENTIFIER` / `_PASSWORD` | test accounts for SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTS, TEACHER, PARENT (a role without one is skipped). Create them by a controlled process on a **test school**; keep the values in the secret store |
| `SMOKE_WRITES=1` + `SMOKE_SECTION_ID`, `SMOKE_STUDENT_ID`, `SMOKE_SUBJECT_ID` | marks today's attendance, posts a diary entry and uploads a 1×1 PNG on the test school, and checks the parent sees them — **test school only** |
| `SMOKE_FOREIGN_STUDENT_ID` | a student of another school: the school admin must get 403/404 |
| `SMOKE_CHECK_RATE_LIMIT=1` | sends 8 failed logins and expects a 429 (blocks logins from that IP for a minute) |

Output: one line per check (PASS / FAIL / SKIP with the reason); exit code 1 when anything fails. The e2e `smoke-test` runs it against the in-process API on every CI run. Checks:
1. API reachable over HTTPS; `GET /health/live` and `GET /health/ready` (database) return 200.
2. Login as each of SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTS, TEACHER, PARENT (test accounts created by a controlled process); wrong password → 401; repeated failed logins → 429 (opt-in). A login answered 429 is retried once after 61 s.
3. Staff console page loads with a Content-Security-Policy (automated); role-appropriate nav and logout — manual.
4. Read paths: `/schools` (super admin), `/admin/students` (admin), `/fee-structures` (accounts), `/teachers/me/day` (teacher), `/me/children` (parent).
5. One write per critical flow on a test school: mark attendance and post a diary entry, each seen by the parent (automated, opt-in); issue a voucher — manual.
6. File upload and download round-trip; a disallowed type is refused (automated, opt-in); the 10 MB limit — manual.
7. Cross-tenant check: an admin of school A cannot read a school-B student (403/404).
8. Payment: gateway redirect and webhook round-trip in sandbox — skipped while gateways are off (RD-14).
9. Scheduled jobs log a run (attendance risk 03:00, digest every 15 min, notification retry every minute) — check the logs.
10. Parent app (release build) connects to the production API URL, logs in, receives a push — manual (BL-43/BL-54/BL-14).

## 4. Acceptance to release
All §1 gates green, §2 items complete, smoke test §3 passes on staging, rollback path confirmed ([BACKUP-RESTORE](../operations/BACKUP-RESTORE.md), `docs/release/ROLLBACK.md`).
