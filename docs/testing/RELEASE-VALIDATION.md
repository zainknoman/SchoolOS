# Release Validation

> **Status:** CURRENT (procedure) · **Verified:** 2026-09-20 against `main@15362b7` · **Owner:** project owner
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
| Backend lint | `npm run lint` | currently **fails** (2,014 errors; non-blocking in CI) |

## 2. Manual/pre-release checks (gaps)
| Check | Detail |
|---|---|
| Migration rehearsal **(gap)** | restore last production-like backup → `migrate deploy` → `migrate status` → run smoke tests |
| Dependency audit **(gap)** | `npm audit` for backend/console; review `flutter pub outdated`; current backend result: 18 vulnerabilities (KG-5) |
| Config validation **(gap)** | [HARDENING-CHECKLIST](../security/HARDENING-CHECKLIST.md) all configuration items ticked |
| Integration sandbox runs **(gap)** | one signed test transaction per gateway; one push, one email, one SMS/WhatsApp delivered ([INTEGRATIONS](../operations/INTEGRATIONS.md)) |
| Backup exists **(gap)** | pre-deploy backup taken and restorable |
| Known-defect review | [KNOWN-GAPS](../security/KNOWN-GAPS.md): each High item fixed or explicitly accepted by the owner |

## 3. Production smoke test (to be automated; no suite exists)
1. API reachable over HTTPS; `GET /` returns 200 (**note: does not test the database**); add a DB-backed health endpoint (BL-11).
2. Login as each of SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTS, TEACHER, PARENT (test accounts created by a controlled process); wrong password → 401; 6th attempt within a minute → 429.
3. Staff console loads, role-appropriate nav shown; logout clears the session.
4. Read paths: `/me/children` (parent), `/admin/students` (admin), `/teachers/me/day` (teacher).
5. One write per critical flow on a test school: mark attendance; post diary; issue a voucher; parent views it.
6. File upload and download (10 MB limit, blocked extension rejected).
7. Cross-tenant check: an admin of school A cannot read a school-B student (403/404).
8. Payment: gateway redirect and webhook round-trip in sandbox.
9. Scheduled jobs log a run (03:00 / 15-min) once.
10. Parent app (release build) connects to the production API URL, logs in, receives a push.

## 4. Acceptance to release
All §1 gates green (or lint exception recorded), §2 items complete, smoke test §3 passes on staging, rollback path confirmed ([BACKUP-RESTORE](../operations/BACKUP-RESTORE.md), `docs/release/ROLLBACK.md`).
