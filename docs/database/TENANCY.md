# Tenancy and Data Isolation

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** `backend/prisma/schema.prisma`, `common/org-scope.service.ts`, `circulars.service.ts`, `holidays.service.ts`, `academic-session.service.ts`; e2e `cross-tenant-boundary`, `org-provisioning`, `sections-access` · **Owner:** Engineering Lead
> Design: one PostgreSQL database; tenancy is a hierarchy (`School → Campus → Class → Section`) plus scope columns enforced in **application code** ([ADR-0006](../decisions/ADR-0006-tenancy-by-scoping-columns.md)). No row-level security exists. The owner intends a future multi-tenant SaaS; treat this document as the starting point for that audit, not as a claim of isolation.

## Where scope lives (schema)
| Model | Scope columns | Path to a school |
|---|---|---|
| `School` | — | root |
| `Campus` | `schoolId` | direct |
| `User` | `schoolId?`, `campusId?` | direct (null `schoolId` ⇒ denied for non-SUPER_ADMIN) |
| `Class` | `campusId`, `academicSessionId` | via Campus |
| `Section` | `classId` | via Class → Campus |
| `Teacher`, `Staff`, `HiringApplication`, `Enrollment` | `campusId` | via Campus |
| `Student`, `Attendance`, `Timetable`, `DiaryEntry`, `Mark`, `Complaint`, `LeaveRequest`, `FeeVoucher`, … | none | via Enrollment (→ Campus) or Section |
| `ParentProfile` | none | via linked students' enrollments |
| `Holiday` | `schoolId` (BL-20, M2), `campusId?` | direct; **null campus = every campus of its own school** |
| `Circular` | `schoolId` (BL-20, M2), `scope`, `sectionId?` | direct; section circulars also via Section |
| `AcademicSession` | `schoolId` (BL-01, M3) | direct; `Term` via its session |
| `Subject`, `FeeStructure` | **none** (BL-02 / BL-03 pending) | **no path** |
| `Applicant`, `Application` | `Application.desiredClassId`, `academicSessionId` | via desired Class → Campus |

## How scope is enforced
`OrgScopeService` and `StudentAccessService` in services ([AUTHORIZATION](../api/AUTHORIZATION.md)); e2e specs `cross-tenant-boundary`, `sections-access`, `org-provisioning` exercise it. Delete restrictions come from FK `onDelete` (see [ERD](ERD.md)).

## Code issues discovered (recorded, not fixed)
| ID | Issue | Evidence | Impact |
|---|---|---|---|
| TENANT-1 | **School-wide circulars go to every parent in the database.** `scope = 'school'` recipients = all `User` with role PARENT, no school filter | `circulars/circulars.service.ts:55-57` | With 2+ schools, School A's circular is delivered (in-app/push) to School B's parents — **Fixed 2026-09-25 (BL-20)** |
| TENANT-2 | Holidays: a `campusId` supplied by the caller is not checked against the caller's school on create, and `campusId = null` means "every campus" — any SCHOOL_ADMIN can create a holiday that applies platform-wide | `holidays/holidays.service.ts:40-49,52-70` | Cross-school effect on attendance marking (holidays block marking) — **Fixed 2026-09-25 (BL-20)** |
| TENANT-3 | `AcademicSession` is global; activating one deactivates all others; "first active session" used for new students/vouchers/imports | `academic-session.service.ts:49-53`; `student.service.ts:69`; `fee-vouchers.service.ts:30`; `students-bulk-import.service.ts:100` | Wrong-session enrollment across schools (business decision Q1) — **Fixed 2026-09-25 (BL-01)** |
| TENANT-4 | `GET /academic-sessions`, `/terms`, `/subjects`, `/fee-structures` return rows for all schools | `progress` history in `docs/archive/access-control-scoping-progress.md` | Data exposure across schools; fee structures can be created but never edited |
| TENANT-5 | `Subject.name` is globally unique | `schema.prisma` | One school's subject name blocks another's |
| TENANT-6 | No database-level guarantee: any service that forgets an `assert*` call exposes data | architecture | Regression risk |

## Isolation tests
Backend e2e: `cross-tenant-boundary.e2e-spec.ts`, `sections-access.e2e-spec.ts`, `org-provisioning.e2e-spec.ts`, `cascade-delete-restrictions.e2e-spec.ts`. No test covers TENANT-1 to TENANT-5 (verified by absence in the spec names; content not exhaustively read).

> **Correction (2026-09-20):** parent `User` rows have no `schoolId` (identity is global; access via `StudentParent`). `Circular` (optional `sectionId`) and `Holiday` (nullable `campusId`) also lack a reliable school anchor — decided fix: `schoolId` via migration M2 (BL-20), gated by the BL-62 strategy and BL-65 harness.
