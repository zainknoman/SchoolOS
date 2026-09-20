# SchoolOS — Product Journey

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** controllers, services, router, parent-app screens, e2e specs (cited in the tables) · **Owner:** project owner
> Maps the real-world school lifecycle to what SchoolOS actually supports. Steps the product does **not** support are listed separately and are never described as part of the flow. Feature IDs → [FEATURE-CATALOG](../product/FEATURE-CATALOG.md); rule IDs → [BUSINESS-RULES](../product/BUSINESS-RULES.md).

## 1. End-to-end map

| # | Journey step | Actor | Where (UI) | Feature | Status | Notes |
|---|---|---|---|---|---|---|
| 1 | School & campus setup | SUPER_ADMIN (schools); SCHOOL_ADMIN may also add campuses | S:`/admin/schools`, `/admin/campuses` | F-ORG-01/02, F-AUTH-04 | IMPLEMENTED | Optionally provisions a principal/admin login |
| 2 | Academic session | SUPER_ADMIN | S:`/admin/academic-sessions` | F-ORG-03 | IMPLEMENTED (global — Q1) | Only one active session platform-wide |
| 3 | Classes | SCHOOL_ADMIN / SUPER_ADMIN | S:`/admin/classes` | F-ORG-04 | IMPLEMENTED | Per campus **and** session |
| 4 | Sections (+ class teacher) | SCHOOL_ADMIN | S:`/admin/sections` | F-ORG-05 | IMPLEMENTED | Class teacher must be in same campus |
| 5 | Copy structure to a new session | SCHOOL_ADMIN | S:`/admin/academic-sessions` | F-ORG-03 | IMPLEMENTED | Copies classes/sections, not class teachers |
| 6 | Subjects | — | none | F-ORG-06 | **NOT IMPLEMENTED as a workflow** | Read-only; seed/DB only |
| 7 | Staff records / hiring | SCHOOL_ADMIN | S:`/admin/staff`, `/admin/hiring*` | F-PPL-04..06 | IMPLEMENTED | See [STAFF-LIFECYCLE](STAFF-LIFECYCLE.md) |
| 8 | Admissions (applicant → application → decision) | SCHOOL_ADMIN / ACCOUNTS | S:`/admin/admissions*` | F-ADM-01/02 | IMPLEMENTED | See [STUDENT-LIFECYCLE](STUDENT-LIFECYCLE.md) |
| 9 | Student + parent/guardian creation | SCHOOL_ADMIN (or via approval / bulk import) | S:`/admin/students`, `/admin/parents`, `/admin/bulk-import` | F-PPL-01..03,07 | IMPLEMENTED | |
| 10 | Enrollment & section assignment | SCHOOL_ADMIN | student create; S:student profile "current enrollment" | F-ENR-01 | IMPLEMENTED | |
| 11 | Timetable | SCHOOL_ADMIN | S:`/admin/timetable` | F-TT-01 | IMPLEMENTED | Teacher/room conflict checks |
| 12 | Daily attendance | TEACHER | S:`/teacher/attendance` | F-ATT-01/02 | IMPLEMENTED | See [ACADEMIC-OPERATIONS](ACADEMIC-OPERATIONS.md) |
| 13 | Diary / homework / activities | TEACHER | S:`/teacher/diary` | F-DIA-01 | IMPLEMENTED | Parents read in app |
| 14 | Assessments & gradebook | SCHOOL_ADMIN (setup), TEACHER (marks) | S:`/admin/terms`, `/admin/assessment-categories`, `/teacher/gradebook*` | F-GRD-01 | IMPLEMENTED | Weighted % only |
| 15 | Report card | TEACHER / SCHOOL_ADMIN | S:`/teacher/report-cards`, `/admin/report-cards` | F-RC-01 | PARTIALLY IMPLEMENTED | Recorded document; not generated |
| 16 | Fees & payments | ACCOUNTS/SCHOOL_ADMIN; PARENT | S:`/admin/fees` · P:fees | F-FEE-01..04 | IMPLEMENTED (gateways unverified) | See [FEES-AND-PAYMENTS](FEES-AND-PAYMENTS.md) |
| 17 | Communication (circulars, messages, notifications) | SCHOOL_ADMIN, TEACHER, PARENT | S:`/admin/circulars`, messages · P:circulars/messages | F-COM-01..04 | IMPLEMENTED | Channels need external services |
| 18 | Leave / complaints | PARENT (leave); staff (complaints) | P:leave · S:`/admin/leave`, complaints | F-LV-01, F-CMP-01 | IMPLEMENTED | Parents can't raise complaints |
| 19 | Session completion → promotion | SCHOOL_ADMIN | S:`/admin/promotions` | F-ENR-02 | IMPLEMENTED | Per source section; no eligibility rules (Q5) |
| 20 | Historical academic record | SCHOOL_ADMIN | S:student profile (promotion history) | F-ENR-01/02 | PARTIALLY IMPLEMENTED | Enrollment + promotion history exist; no consolidated transcript; no staff/teacher assignment history |
| 21 | New academic session | SUPER_ADMIN / SCHOOL_ADMIN | S:`/admin/academic-sessions` | F-ORG-03 | IMPLEMENTED (manual) | No automatic rollover: create session → copy structure → promote |

## 2. Not supported today (do not present as journey steps)

Student self-service · subject management · automated rollover/fee carry-forward · transcripts/GPA/letter grades · report-card generation from marks · fee discounts/late fees/refunds (Q9) · parent-raised complaints · payroll · admissions online form for the public (intake is staff-entered).

## 3. Lifecycle documents

[STUDENT-LIFECYCLE](STUDENT-LIFECYCLE.md) · [STAFF-LIFECYCLE](STAFF-LIFECYCLE.md) · [ACADEMIC-OPERATIONS](ACADEMIC-OPERATIONS.md) (session, attendance, assessment, communication) · [FEES-AND-PAYMENTS](FEES-AND-PAYMENTS.md) · [PARENT-JOURNEY](PARENT-JOURNEY.md).
