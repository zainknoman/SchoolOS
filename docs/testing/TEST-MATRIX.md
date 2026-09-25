# Test Matrix

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** file inventory under `backend/test`, `backend/src/**/*.spec.ts`, `staff-console/src/**/*.spec.ts`, `parent-app/test/**`; run results in [TESTING-STRATEGY](TESTING-STRATEGY.md) · **Owner:** Engineering Lead
> Mapping is by **spec file names and module folders** (not by reading every assertion). "e2e (n)" = number of `it/test` blocks in the spec by grep (Jest's total of 196 includes parameterised cases; the sum of these greps is 192). Feature IDs: [FEATURE-CATALOG](../product/FEATURE-CATALOG.md).

| Feature | Backend e2e | Backend unit (module folder) | Staff console specs | Parent app tests | Gap |
|---|---|---|---|---|---|
| F-AUTH-01/02 | `auth` (8), `auth-password-reset` (3), `rate-limiting` (2), `cors` (2) | `auth/` (service, guards, strategy, jwt-secret), `config/` | `LoginView`, `ForgotPasswordView`, `ResetPasswordView`, `ChangePasswordView`, `stores/auth`, `router`, `fetchInterceptor` | `test/auth/`, screens | no test for KG-2/3/4/23 |
| F-AUTH-03/04 | `cross-tenant-boundary` (6), `sections-access` (1), `org-provisioning` (36) | `common/` (org-scope, student-access, guards) | router role guards | — | TENANT-1..5 untested |
| F-ORG-01..05 | `org-structure` (15), `cascade-delete-restrictions` (4) | `school/`, `campus/`, `academic-session/`, `class/`, `sections/` | School/Campus/Class/Section/AcademicSession management + profile view specs | — | multi-school active-session behaviour untested |
| F-ORG-06 | — | `subjects/` | — | — | no management feature |
| F-ORG-07 | `holidays-complaints-report-cards` (12) | `holidays/` | `HolidaysView` | calendar tests | TENANT-2 untested |
| F-PPL-01..04 | `people-crud` (5) | `student/`, `parent/`, `teacher/`, `teachers/` | Student/Parent/Teacher management + profile views | `student_info_screen_test` | — |
| F-PPL-05/06 | **none** | `staff/` (3), `hiring/` (3) | Staff/Hiring views | — | **no e2e** |
| F-PPL-07 | `bulk-import` (12) | `bulk-import/` (1) | `BulkImportView` | — | cross-database duplicate cases unverified |
| F-ADM-01/02 | `admissions` (7) | `admissions/` (1) | Admissions queue/intake/detail | — | — |
| F-ENR-01/02 | `promotions` (6), `people-crud` | `promotions/` (1), `enrollment/` | `PromotionView` | — | Q5 rules untested |
| F-TT-01 | `timetable-attendance` (16) | `timetable/` | Timetable views | calendar tests | — |
| F-ATT-01 | `timetable-attendance` | `attendance/` | `AttendanceView` | calendar tests | — |
| F-ATT-02 | **none** | `attendance-risk/` | — | — | **cron untested end-to-end** |
| F-DIA-01/02 | `diary-circulars` (13) | `diary/`, `ai-drafting/` | `DiaryView` | calendar tests | AI live path untested |
| F-GRD-01 | `gradebook` (10) | **none** (`gradebook/` has no specs) | Marks/Categories/Terms/Gradebook views | (grades in report cards screen) | no unit specs |
| F-RC-01 | `holidays-complaints-report-cards` | `report-cards/` | Report card views | `report_cards` tests | generation-from-marks not a feature |
| F-LV-01 | `leave` (6) | `leave/` | `LeaveManagementView` | leave tests | — |
| F-CMP-01 | `holidays-complaints-report-cards` | `complaints/` | Complaints views | complaints tests | parent-forbidden POST unverified |
| F-FEE-01..04 | `fees` (11) | `fees/` (adapters, signers, config) | `FeeManagementView` | fees/voucher/checkout tests | **live gateways never tested** |
| F-COM-01 | `diary-circulars` | `circulars/` | `CircularsView` | circulars tests | TENANT-1 untested |
| F-COM-02/03 | `messages-notifications` (7) | `messages/`, `notifications/` | `MessagesView` | messages/notification tests | — |
| F-COM-04 | none | `notifications/` adapters + configs | — | `notifications/` tests | no live delivery test |
| F-FIL-01 | none | `files/` (service, access) | attachments in views | — | **no e2e** for upload limits/blocked extensions |
| F-ME-01 | `me` (9) | `me/` | — | home/student info | — |
| F-DSH-01 | `me` (partial) | `dashboard/` | Dashboard views | — | dashboard e2e absent |
| F-UX-01 | — | — | `locales`, `theme`, `textDirection`, a11y specs | l10n/theme tests | — |
| F-OFF-01 | — | — | — | `test/cache/` | — |
| Platform/health | `app` (1, greeting) | — | — | — | no health endpoint to test |

## Categories requested by the plan
| Category | Present? |
|---|---|
| Unit / service / controller | Yes (service-level; controllers via e2e) |
| Integration / e2e | Yes (backend); none for staff-console or mobile |
| Authorization / tenant isolation | Yes (`cross-tenant-boundary`, `sections-access`, `org-provisioning`, `me`) — with known holes |
| Security | Partial (`rate-limiting`, `cors`, password reset) |
| Migration | No |
| Production smoke | No |
| Regression | Implicit via e2e; no dedicated suite |

## Generated test inventory (BL-66)

<!-- GENERATED:BEGIN test-inventory -->
Generated suite inventory (file and `it/test` block counts by grep — **not** executed results; executed counts are in [TESTING-STRATEGY](TESTING-STRATEGY.md)):

| Suite | Files | Test blocks |
|---|---|---|
| Backend unit (`backend/src/**/*.spec.ts`) | 89 | 648 |
| Backend e2e (`backend/test/*.e2e-spec.ts`) | 36 | 260 |
| Staff console (`staff-console/src/**/*.spec.ts`) | 74 | 504 |
| Parent app (`parent-app/test/**/*_test.dart`) | 30 | — |

| Backend e2e spec | Test blocks |
|---|---|
| `account-access.e2e-spec.ts` | 16 |
| `admissions.e2e-spec.ts` | 7 |
| `app.e2e-spec.ts` | 1 |
| `attendance-actor.e2e-spec.ts` | 5 |
| `auth-password-reset.e2e-spec.ts` | 4 |
| `auth.e2e-spec.ts` | 8 |
| `bulk-import.e2e-spec.ts` | 13 |
| `cascade-delete-restrictions.e2e-spec.ts` | 4 |
| `copy-structure.e2e-spec.ts` | 3 |
| `cors.e2e-spec.ts` | 2 |
| `cross-tenant-boundary.e2e-spec.ts` | 6 |
| `diary-circulars.e2e-spec.ts` | 13 |
| `fee-structures.e2e-spec.ts` | 5 |
| `fees.e2e-spec.ts` | 11 |
| `gradebook.e2e-spec.ts` | 10 |
| `holidays-complaints-report-cards.e2e-spec.ts` | 12 |
| `job-lock.e2e-spec.ts` | 3 |
| `leave.e2e-spec.ts` | 6 |
| `me.e2e-spec.ts` | 9 |
| `messages-notifications.e2e-spec.ts` | 7 |
| `observability.e2e-spec.ts` | 4 |
| `org-provisioning.e2e-spec.ts` | 36 |
| `org-structure.e2e-spec.ts` | 15 |
| `pagination.e2e-spec.ts` | 6 |
| `pending/bl18-failing-first.e2e-spec.ts` | 1 |
| `people-crud.e2e-spec.ts` | 5 |
| `promotions.e2e-spec.ts` | 6 |
| `rate-limiting.e2e-spec.ts` | 2 |
| `s3-storage.e2e-spec.ts` | 1 |
| `school-anchors.e2e-spec.ts` | 5 |
| `school-sessions.e2e-spec.ts` | 5 |
| `sections-access.e2e-spec.ts` | 1 |
| `security-headers.e2e-spec.ts` | 4 |
| `subjects.e2e-spec.ts` | 4 |
| `timetable-attendance.e2e-spec.ts` | 16 |
| `upload-hardening.e2e-spec.ts` | 4 |
<!-- GENERATED:END test-inventory -->
