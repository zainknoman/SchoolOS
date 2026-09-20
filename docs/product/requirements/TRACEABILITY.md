# SchoolOS — Requirements Traceability

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Owner:** Product Owner
> Completed in Phase 10 (2026-09-20). The chain Feature → Requirement → Rule → UI → API → Data → Authz → Tests is: [FEATURE-CATALOG](../FEATURE-CATALOG.md) (UI, API paths, models per feature) → this table (requirements, rules, tests) → [ENDPOINTS](../../api/ENDPOINTS.md) (roles per route, generated) → [DATA-DICTIONARY](../../database/DATA-DICTIONARY.md) (models/fields, generated). Test results: [TESTING-STRATEGY](../../testing/TESTING-STRATEGY.md); per-feature test coverage detail: [TEST-MATRIX](../../testing/TEST-MATRIX.md).

| Feature | Requirements | Rules | Backend e2e | Backend unit | Console UI test | Flutter test | Last run (all suites green) |
|---|---|---|---|---|---|---|---|
| F-AUTH-01/02/03/04 | FR-AUTH-01..08 | BR-AUTH-01..06, BR-SCOPE-01..04, BR-ORG-04 | `auth`, `auth-password-reset`, `rate-limiting`, `cors`, `cross-tenant-boundary`, `org-provisioning` | auth/common specs | `LoginView`, `ChangePasswordView`, `router` specs | `auth` tests | pass 2026-09-20 |
| F-ORG-01..07 | FR-ORG-01..04 | BR-ORG-01..06, BR-ATT-02 | `org-structure`, `sections-access`, `cascade-delete-restrictions`, `holidays-complaints-report-cards` | yes | management view specs | calendar | pass 2026-09-20 |
| F-PPL-01..07 | FR-PPL-01..06 | BR-STU-01..05, BR-STF-01/02, BR-IMP-01 | `people-crud`, `bulk-import` (staff/hiring: none) | staff/hiring specs | view specs | — | pass 2026-09-20 |
| F-ADM-01/02, F-ENR-01/02 | FR-ADM-01/02, FR-ENR-01/02 | BR-ADM-01..03, BR-ENR-01..04 | `admissions`, `promotions` | yes | Admissions/Promotion view specs | — | pass 2026-09-20 |
| F-TT-01, F-ATT-01/02, F-DIA-01/02 | FR-TT-01, FR-ATT-01/02, FR-DIA-01 | BR-TT-01, BR-ATT-01..04 | `timetable-attendance`, `diary-circulars` (risk job: none) | yes | Attendance/Diary/Timetable specs | calendar tests | pass 2026-09-20 |
| F-GRD-01, F-RC-01 | FR-GRD-01, FR-RC-01 | BR-GRD-01..03, BR-RC-01 | `gradebook`, `holidays-complaints-report-cards` | none for `gradebook/` | Marks/Categories specs | report-cards tests | pass 2026-09-20 |
| F-LV-01, F-CMP-01 | FR-LV-01, FR-CMP-01 | BR-LV-01/02, BR-SCOPE-03 | `leave`, `holidays-complaints-report-cards` | yes | Leave/Complaints specs | leave/complaints tests | pass 2026-09-20 |
| F-FEE-01..04 | FR-FEE-01..03 | BR-FEE-01..04 | `fees` (stub gateway) | gateway/signer specs | FeeManagement spec | fees tests | pass 2026-09-20 |
| F-COM-01..04 | FR-COM-01..03 | — | `diary-circulars`, `messages-notifications` | adapter specs | Circulars/Messages specs | notification tests | pass 2026-09-20 |
| F-FIL-01, F-ME-01, F-DSH-01 | FR-FIL-01, FR-ME-01 | BR-SCOPE-02 | `me` (files: none) | files specs | dashboard specs | — | pass 2026-09-20 |
| F-UX-01, F-OFF-01 | FR-UX-01, FR-OFF-01 | — | — | — | i18n/theme specs | cache tests | pass 2026-09-20 |

**Known gaps in evidence:** no e2e for staff, hiring, files, attendance-risk job, AI drafting, live payment/push/SMS/WhatsApp/email; no colocated unit specs in `gradebook/`. These are testing gaps, recorded for `docs/testing/` and readiness.

Run reference: backend unit 579/579, backend e2e 196/196 (fresh DB), console 512/512 (one worker timeout when run in parallel; re-run green), Flutter 100/100 — `main@15362b7`, 2026-09-20. "Pass" means the suite is green, not that every requirement's acceptance criterion was individually asserted (see `UNVERIFIED` cells in FUNCTIONAL-REQUIREMENTS).

> **Owner decisions (2026-09-20):** decided-but-unbuilt requirements have no traceability rows until implemented; see [BACKLOG](BACKLOG.md) acceptance criteria.
