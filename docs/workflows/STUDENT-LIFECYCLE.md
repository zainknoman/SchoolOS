# Student Lifecycle (Admission → Enrollment → Promotion → History)

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** `admissions/`, `student/`, `enrollment/`, `promotions/` services; e2e `admissions`, `people-crud`, `promotions` · **Owner:** project owner
> Rules are referenced by ID, not restated. Open questions: Q1, Q4, Q5, Q7.

## A. Admission (optional path)

| Step | Actor · UI · API | State change | Rules |
|---|---|---|---|
| 1. Enter applicant | SCHOOL_ADMIN/ACCOUNTS · `/admin/admissions/new` · `POST /applicants` | `Applicant` row | — |
| 2. Create application (desired class + target session) | same · `POST /applications` | `Application` status SUBMITTED | — |
| 3. Review / edit | same · `/admin/admissions/:id` · `PATCH /applications/:id` | UNDER_REVIEW (editable until decided) | BR-ADM-01 |
| 4a. Approve | same · `POST /applications/:id/approve` | Creates `Student` (+ GR number), links/creates parent, creates `Enrollment` in the **application's** session; application APPROVED with `createdStudentId` | BR-ADM-02/03, BR-STU-03 |
| 4b. Reject | `POST /applications/:id/reject` | REJECTED with decision notes | BR-ADM-01 |

Failure paths: already-decided → 400; duplicate GR/parent identifier → conflict; neither/both parent options → 400.

## B. Direct creation / bulk import

`POST /admin/students` (or `/bulk-import/students/*`) creates the student and enrolls them in the **first active session** with a section — requiring exactly one of existing parent or new parent (BR-STU-01/02, BR-ORG-02). Bulk import previews first and reports in-file duplicates (BR-IMP-01).

## C. During the year

- Current placement changes via `PATCH /admin/students/:id/current-enrollment` (F-ENR-01).
- Profile data (personal, addresses, previous school, medical, emergency contacts, documents + verification) is maintained by administrators (F-PPL-02); parents can view and make limited edits to their child via `/me/children/:id`.
- Withdrawal/transfer is recorded through promotion decisions (TRANSFERRED_OUT / WITHDRAWN) — there is no separate withdrawal workflow.

## D. End of year — promotion / re-enrollment

1. Admin creates the target academic session and copies structure (see [ACADEMIC-OPERATIONS](ACADEMIC-OPERATIONS.md)).
2. `/admin/promotions` → `GET /promotions/preview?sourceSectionId=` lists ACTIVE enrollments of the source section with a suggested decision of PROMOTED for everyone (Q5).
3. Admin edits decisions and, for PROMOTED/RETAINED, chooses a target section → `POST /promotions/execute` (BR-ENR-02..04).
4. In one transaction per request: old enrollment closed (status by decision, `endDate = now`), new enrollment created in the target session for PROMOTED/RETAINED, `StudentPromotion` and audit rows written.

## E. History

Available: every past `Enrollment`, and `GET /admin/students/:id/promotion-history`. Parents keep read access to a child's records after withdrawal/graduation (BR-SCOPE-02). **Not available:** transcript/consolidated academic record; deletion is a hard delete (Q7) restricted by foreign keys.
