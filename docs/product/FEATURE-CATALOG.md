# SchoolOS — Feature Catalog

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** controllers (`backend/src/**/*.controller.ts`), router (`staff-console/src/router/index.ts`), parent screens (`parent-app/lib/src/screens/`), `backend/test/*.e2e-spec.ts` · **Owner:** project owner
> Stable feature IDs `F-<AREA>-<nn>` replace the sprint-letter taxonomy. `Legacy` maps to the archived `FEAT-001..014` (in `docs/archive/original-mvp-plan/FEATURES.txt`) and sprint names. Tests column = backend e2e spec (`test/<name>.e2e-spec.ts`), "unit" (colocated, Prisma mocked) or "none". Rules: [BUSINESS-RULES.md](BUSINESS-RULES.md). Roles: [PERSONAS-AND-ROLES.md](PERSONAS-AND-ROLES.md).

Endpoint paths omit the `/api/v1` prefix. UI: `S:` staff-console route, `P:` parent-app screen.

## Identity & access

| ID | Feature | Actors | API | UI | Data | Rules | Tests | Legacy | Status |
|---|---|---|---|---|---|---|---|---|---|
| F-AUTH-01 | Login (email or GR-number), refresh, change password | all | `POST /auth/login`, `/auth/refresh`, `/auth/change-password` | S:`/login`,`/change-password` · P:login | User, RefreshToken | BR-AUTH-01..04 | auth, rate-limiting | FEAT-002 | IMPLEMENTED |
| F-AUTH-02 | Forgot / reset password by email | all | `POST /auth/forgot-password`, `/auth/reset-password` | S:`/forgot-password`,`/reset-password` · P:forgot/reset | PasswordResetToken | BR-AUTH-05 | auth-password-reset | Sprint A/B | IMPLEMENTED (email CONFIGURATION REQUIRED) |
| F-AUTH-03 | Role guards + tenant/campus scoping | all | `@Roles`, `OrgScopeService`, `StudentAccessService` | route guards | User.schoolId/campusId/isPrincipal | BR-SCOPE-01..03 | cross-tenant-boundary, sections-access | Sprint L | IMPLEMENTED (gaps: BR-ORG-01..03) |
| F-AUTH-04 | Provision principal / admin login when creating school or campus | SUPER_ADMIN | `POST /schools`, `POST /campuses` | S:`/admin/schools/new`,`/admin/campuses/new` | User | BR-ORG-04 | org-provisioning | Org provisioning 2026-09-19 | IMPLEMENTED |

## Organization & academic structure

| ID | Feature | Actors | API | UI | Data | Rules | Tests | Legacy | Status |
|---|---|---|---|---|---|---|---|---|---|
| F-ORG-01 | Schools (profile, contact) | SUPER_ADMIN | `/schools` CRUD | S:`/admin/schools*` | School | BR-ORG-04 | org-structure, org-provisioning | Org CRUD | IMPLEMENTED |
| F-ORG-02 | Campuses (profile) | SUPER_ADMIN (CRUD); SCHOOL_ADMIN (create, list) | `/campuses` CRUD | S:`/admin/campuses*` | Campus | BR-ORG-04 | org-structure | Org CRUD | IMPLEMENTED |
| F-ORG-03 | Academic sessions (+ copy structure) | SUPER_ADMIN (CRUD); SCHOOL_ADMIN (copy) | `/academic-sessions`, `/academic-sessions/:id/copy-structure` | S:`/admin/academic-sessions` | AcademicSession | BR-ORG-01, BR-ORG-05 | org-structure | Org CRUD | IMPLEMENTED (platform-global; Q1) |
| F-ORG-04 | Classes | SCHOOL_ADMIN, SUPER_ADMIN (CUD); teachers/accounts (read) | `/classes` CRUD | S:`/admin/classes` | Class | BR-ORG-05 | org-structure | Org CRUD | IMPLEMENTED |
| F-ORG-05 | Sections (+ class teacher) | SCHOOL_ADMIN, SUPER_ADMIN | `/sections` CRUD, `/sections/:id/students` | S:`/admin/sections` | Section | BR-ORG-06 | org-structure, sections-access | Org CRUD | IMPLEMENTED |
| F-ORG-06 | Subjects | staff (read) | `GET /subjects` only | pickers | Subject | Q2 | none | — | **PARTIALLY IMPLEMENTED** — no create/update/delete endpoint or UI exists; subjects come from the seed/DB (`CODE ISSUE DISCOVERED`: cannot onboard a new school's subjects through the product) |
| F-ORG-07 | Holidays | SCHOOL_ADMIN/SUPER_ADMIN (CUD); all (R) | `/holidays` | S:`/admin/holidays` · P:calendar | Holiday | BR-ATT-02 | holidays-complaints-report-cards | Sprint I | IMPLEMENTED |

## People

| ID | Feature | Actors | API | UI | Data | Rules | Tests | Legacy | Status |
|---|---|---|---|---|---|---|---|---|---|
| F-PPL-01 | Students (create with enrollment, edit, delete) | SCHOOL_ADMIN, SUPER_ADMIN | `/admin/students` CRUD | S:`/admin/students*` | Student, Enrollment | BR-STU-01..03 | people-crud | People CRUD | IMPLEMENTED |
| F-PPL-02 | Student profile (personal, addresses, previous school, medical, emergency contacts, documents + verification) | SCHOOL_ADMIN, SUPER_ADMIN | `/admin/students/:id/profile`, `…/previous-school`, `…/medical-info`, `…/emergency-contacts`, `…/documents` | S:`/admin/students/:id` | Student, Address, Student* satellites | BR-STU-04 | people-crud, cross-tenant-boundary | Student Profile | IMPLEMENTED |
| F-PPL-03 | Parents/guardians & child linking | SCHOOL_ADMIN, SUPER_ADMIN | `/admin/parents` CRUD, `…/children/:studentId` | S:`/admin/parents*` | ParentProfile, StudentParent | BR-STU-05 | people-crud | People CRUD | IMPLEMENTED |
| F-PPL-04 | Teachers | SCHOOL_ADMIN, SUPER_ADMIN | `/admin/teachers` CRUD | (via staff pages) | Teacher | BR-STF-01 | people-crud | People CRUD | IMPLEMENTED |
| F-PPL-05 | Staff (+ profile, experience, emergency contacts, documents) | SCHOOL_ADMIN, SUPER_ADMIN | `/admin/staff*` | S:`/admin/staff*` | Staff, Staff* satellites | BR-STF-01 | unit | Staff & Hiring | IMPLEMENTED |
| F-PPL-06 | Hiring pipeline (candidate → application → approve/reject → staff/teacher) | SCHOOL_ADMIN, SUPER_ADMIN | `/hiring/candidates`, `/hiring/applications*` | S:`/admin/hiring*` | HiringCandidate, HiringApplication | BR-STF-02 | unit | Staff & Hiring | IMPLEMENTED |
| F-PPL-07 | Bulk import (students, parents, teachers, staff; sample, preview, commit) | SCHOOL_ADMIN, SUPER_ADMIN | `/bulk-import/*` | S:`/admin/bulk-import` | multiple | BR-IMP-01 | bulk-import | Sprint P | IMPLEMENTED |

## Admissions & student lifecycle

| ID | Feature | Actors | API | UI | Data | Rules | Tests | Legacy | Status |
|---|---|---|---|---|---|---|---|---|---|
| F-ADM-01 | Applicant intake | SCHOOL_ADMIN, ACCOUNTS, SUPER_ADMIN | `/applicants` | S:`/admin/admissions/new` | Applicant | — | admissions | Sprint O | IMPLEMENTED |
| F-ADM-02 | Application review → approve (creates student, parent link, enrollment) / reject | same | `/applications*` | S:`/admin/admissions*` | Application → Student, Enrollment | BR-ADM-01..03 | admissions | Sprint O | IMPLEMENTED |
| F-ENR-01 | Enrollment history (ACTIVE/TRANSFERRED/COMPLETED/WITHDRAWN) & current-enrollment change | SCHOOL_ADMIN, SUPER_ADMIN | `/admin/students/:id/current-enrollment` | S:student profile | Enrollment | BR-ENR-01 | people-crud | Sprint 6.5 | IMPLEMENTED |
| F-ENR-02 | Promotion / re-enrollment (preview, execute; PROMOTED/RETAINED/TRANSFERRED_OUT/GRADUATED/WITHDRAWN) + history | SCHOOL_ADMIN, SUPER_ADMIN | `/promotions/preview`, `/promotions/execute`, `/admin/students/:id/promotion-history` | S:`/admin/promotions` | StudentPromotion, Enrollment | BR-ENR-02..04, Q5 | promotions | Sprint R | IMPLEMENTED |

## Daily operations

| ID | Feature | Actors | API | UI | Data | Rules | Tests | Legacy | Status |
|---|---|---|---|---|---|---|---|---|---|
| F-TT-01 | Timetable (section view, bulk replace, entry CRUD, teacher view) | SCHOOL_ADMIN (edit); TEACHER (own); PARENT (child) | `/sections/:id/timetable`, `/timetable*`, `/teachers/me/timetable`, `/students/:id/timetable` | S:`/admin/timetable`,`/teacher/timetable` · P:calendar | Timetable | BR-TT-01 | timetable-attendance | FEAT-006 | IMPLEMENTED |
| F-ATT-01 | Attendance marking (single, bulk) and reports | TEACHER, SCHOOL_ADMIN, SUPER_ADMIN | `/attendance`, `/attendance/bulk`, `/sections/:id/attendance`, `/students/:id/attendance` | S:`/teacher/attendance` · P:calendar | Attendance | BR-ATT-01..03 | timetable-attendance | FEAT-007 | IMPLEMENTED |
| F-ATT-02 | Attendance-risk flags (scheduled job) | TEACHER, SCHOOL_ADMIN; PARENT (child) | `/attendance-risk`, `/students/:id/attendance-risk` | dashboards | AttendanceRiskFlag | BR-ATT-04 | unit | Sprint K | IMPLEMENTED (in-process cron) |
| F-DIA-01 | Diary / homework | TEACHER, SCHOOL_ADMIN (write); PARENT (read) | `/diary`, `/sections/:id/diary`, `/students/:id/diary` | S:`/teacher/diary` · P:calendar | DiaryEntry | — | diary-circulars | FEAT-008 | IMPLEMENTED |
| F-DIA-02 | AI draft suggestions | TEACHER, SCHOOL_ADMIN | `/diary/draft-suggestion`, `/circulars/draft-suggestion` | forms | DraftSuggestion | — | unit | Sprint K | EXTERNAL SERVICE REQUIRED (stub) |
| F-GRD-01 | Terms, assessment categories (weights), assessments, marks, computed grades | SCHOOL_ADMIN (terms/categories); TEACHER (assessments/marks); PARENT (grades) | `/terms`, `/assessment-categories`, `/assessments*`, `/students/:id/grades` | S:`/admin/terms`,`/admin/assessment-categories`,`/teacher/gradebook*` | Term, AssessmentCategory, Assessment, Mark | BR-GRD-01..03 | gradebook | Sprint N | IMPLEMENTED |
| F-RC-01 | Report cards (record + PDF) | TEACHER, SCHOOL_ADMIN (create); PARENT (read) | `/report-cards`, `/report-cards/:id/pdf` | S:`/admin/report-cards`,`/teacher/report-cards` · P:report cards | ReportCard, File | BR-RC-01 | holidays-complaints-report-cards | Sprint I | PARTIALLY IMPLEMENTED |
| F-LV-01 | Leave requests (apply, approve/reject) | PARENT (apply); SCHOOL_ADMIN, SUPER_ADMIN (decide) | `/leave-requests*`, `/students/:id/leave-requests` | S:`/admin/leave` · P:leave | LeaveRequest | BR-LV-01..02 | leave | FEAT-013 | IMPLEMENTED |
| F-CMP-01 | Complaints (staff log/update; parent read-only) | staff; PARENT (read) | `/complaints` | S:`/admin/complaints`,`/teacher/complaints` · P:complaints | Complaint | BR-SCOPE-03 | holidays-complaints-report-cards | Sprint I | IMPLEMENTED |

## Finance

| ID | Feature | Actors | API | UI | Data | Rules | Tests | Legacy | Status |
|---|---|---|---|---|---|---|---|---|---|
| F-FEE-01 | Fee structures | SCHOOL_ADMIN, ACCOUNTS, SUPER_ADMIN | `/fee-structures` (create, list) | S:`/admin/fees` | FeeStructure | Q3 | fees | FEAT-012 | IMPLEMENTED (no update/delete; list unscoped) |
| F-FEE-02 | Fee vouchers (student list or whole section; per month) + PDF | same | `/fee-vouchers`, `/fee-vouchers/:id/pdf`, `/students/:id/fees` | S:`/admin/fees` · P:fees | FeeVoucher, FeeItem | BR-FEE-01..02 | fees | FEAT-012 | IMPLEMENTED |
| F-FEE-03 | Online payment (gateway) + webhook + receipt PDF | PARENT | `/fee-vouchers/:id/pay`, `/payments/webhook/:gateway`, `/fee-payments/:id[/receipt.pdf]` | P:voucher detail, stub checkout | FeePayment, FeePaymentAllocation, Receipt | BR-FEE-03..04 | fees | Sprint E | IMPLEMENTED; gateways CONFIGURATION REQUIRED, unverified |
| F-FEE-04 | Manual reconcile | ACCOUNTS, SCHOOL_ADMIN, SUPER_ADMIN | `/fee-vouchers/:id/reconcile` | S:`/admin/fees` | FeePayment | BR-FEE-03 | fees | Sprint E | IMPLEMENTED |

## Communication

| ID | Feature | Actors | API | UI | Data | Rules | Tests | Legacy | Status |
|---|---|---|---|---|---|---|---|---|---|
| F-COM-01 | Circulars (targeting, read receipts, stats) | SCHOOL_ADMIN, SUPER_ADMIN (create/stats); PARENT (read) | `/circulars*` | S:`/admin/circulars` · P:circulars | Circular, CircularRecipient | — | diary-circulars | FEAT-009 | IMPLEMENTED |
| F-COM-02 | Messages (parent ↔ class teacher / admin / accounts) | PARENT (start); staff (reply) | `/conversations*` | S:`/teacher/messages`,`/admin/messages` · P:messages | Conversation, Message | BR-SCOPE-03 | messages-notifications | FEAT-010 | IMPLEMENTED |
| F-COM-03 | In-app notifications + preferences (channel, digest) | all | `/notifications*`, `/me/notification-preferences` | P:notifications sheet | Notification | — | messages-notifications | FEAT-011 | IMPLEMENTED |
| F-COM-04 | Push (FCM), SMS, WhatsApp, email channels + device tokens | system | `/me/device-tokens` | P:token registrar | DeviceToken | — | unit | Sprints F, H | CONFIGURATION / EXTERNAL SERVICE REQUIRED |

## Platform

| ID | Feature | Actors | API | UI | Data | Rules | Tests | Legacy | Status |
|---|---|---|---|---|---|---|---|---|---|
| F-FIL-01 | File upload / scoped download | TEACHER, SCHOOL_ADMIN, SUPER_ADMIN (upload); all (read, scoped) | `/files` | attachments | File | — | none dedicated | — | PARTIALLY IMPLEMENTED (local disk only) |
| F-ME-01 | Parent "my children" (list, detail, limited edit) | PARENT | `/me`, `/me/children*` | P:home, student info | StudentParent | BR-SCOPE-02 | me | FEAT-003 | IMPLEMENTED |
| F-DSH-01 | Dashboards (network, operations, principal academics, teacher My Day/gradebook) | SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTS, TEACHER | `/admin/dashboard-summary`, `/admin/operations-summary`, `/admin/network-overview`, `/admin/principal-academics-summary`, `/teachers/me/*` | S:`/admin`,`/principal*`,`/teacher` | aggregates | BR-SCOPE-01 | me (partial) | Shell redesign | IMPLEMENTED |
| F-UX-01 | English/Urdu i18n, RTL, theming, accessibility | all | — | S:`locales/` · P:`l10n/` | — | — | client suites | Sprint J | IMPLEMENTED |
| F-OFF-01 | Parent offline last-response cache | PARENT | — | P:`cache/` | device | — | parent-app tests | FEAT-014 (slice) | IMPLEMENTED |

## Not implemented (must not be documented as features)

Student login · parent web portal · S3/object storage · payroll · automatic report-card generation · school-scoped academic sessions · subject management · fee-structure edit/delete.

## Legacy ID map

FEAT-001 data model → F-*, schema · FEAT-002 → F-AUTH-01/03 · FEAT-003 → F-ME-01, F-ORG-* · FEAT-004 staff shell → F-UX-01, F-DSH-01 · FEAT-005 parent shell → F-ME-01 · FEAT-006 → F-TT-01 · FEAT-007 → F-ATT-01 · FEAT-008 → F-DIA-01 · FEAT-009 → F-COM-01 · FEAT-010 → F-COM-02 · FEAT-011 → F-COM-03/04 · FEAT-012 → F-FEE-* · FEAT-013 → F-LV-01 · FEAT-014 → F-OFF-01 (remaining hardening items → release docs).
