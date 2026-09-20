# SchoolOS — Business Rules Register

> **Status:** CURRENT (rules) / REQUIRES-DECISION (Q-items) · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** cited per rule (`file:line`) · **Owner:** project owner
> **A rule appears here only if code enforces it.** "Enforced by" points at the enforcement point; "Tested" names e2e evidence where it exists ("unit" = colocated mocked-Prisma spec; "none found" = not confirmed). Items marked `REQUIRES-DECISION` are open product questions — the current behaviour is described but **not endorsed** as a requirement (Decision G5, recommended option: document as-is and flag).
> Specs in `docs/superpowers/specs/` were used only as leads; nothing is recorded from them unless the code confirms it.

## 1. Authentication (BR-AUTH)

| ID | Rule | Enforced by | Tested |
|---|---|---|---|
| BR-AUTH-01 | Login identifier is an email **or** a GR-number string; both are stored in `User.identifier` (unique). Failure messages are generic ("Invalid credentials") to prevent account enumeration. | `auth.service.ts:49-63`, `auth.constants.ts` | auth |
| BR-AUTH-02 | 5 consecutive failed logins lock the account for 15 minutes (`MAX_FAILED_ATTEMPTS=5`, `LOCKOUT_DURATION_MINUTES=15`). | `auth.constants.ts:3-4`, `auth.service.ts:67` | auth |
| BR-AUTH-03 | Access token lifetime = `JWT_ACCESS_TTL` (default 15 m); refresh token lifetime 30 days. Refresh tokens are stored hashed and **rotated on use** (presented token revoked immediately). | `auth.constants.ts`, `auth.service.ts:109-129` | auth |
| BR-AUTH-04 | Change-password requires the current password and the new password must differ. Accounts provisioned with a generated password carry `mustChangePassword = true`, cleared on reset. | `auth.service.ts:222-225,198` | auth |
| BR-AUTH-05 | Forgot-password always returns the same message; reset token valid 1 hour, single use; all reset failures return one generic error. | `auth.constants.ts:13-20`, `auth.service.ts:192` | auth-password-reset |
| BR-AUTH-06 | Rate limits (non-test): 5 requests/minute on login/forgot/reset/change-password; 100/minute globally. | `throttler.config.ts`, `auth.controller.ts` | rate-limiting |

## 2. Scope and access (BR-SCOPE)

| ID | Rule | Enforced by | Tested |
|---|---|---|---|
| BR-SCOPE-01 | `SUPER_ADMIN` is unrestricted. Any other staff user without a `schoolId` is **denied everything** org-scoped. A user with `campusId = null` is school-wide; with a `campusId` they are confined to that campus. | `common/org-scope.service.ts:41-70` | cross-tenant-boundary, org-provisioning |
| BR-SCOPE-02 | A PARENT can access a student only through a `StudentParent` link — independent of enrollment status (history stays visible after withdrawal/graduation). | `student-access.service.ts:45-47` | me, cross-tenant-boundary |
| BR-SCOPE-03 | A TEACHER can access a student/section/class only if assigned to it via the timetable **or** as class teacher; sharing a campus is not sufficient. Fails closed for unrecognised roles. | `student-access.service.ts:14-16,91-122,174-178` | sections-access, cross-tenant-boundary |
| BR-SCOPE-04 | Deleting an org-structure row that is still referenced returns a clear 400 (FK violation translated); create conflicts are translated similarly. Foreign keys mix `Restrict` (30), `Cascade` (38), `SetNull` (25) and Prisma defaults (15) — see `docs/database/ERD.md`. | `common/prisma-delete-guard.ts`, `prisma-create-guard.ts` | cascade-delete-restrictions |

## 3. Organization (BR-ORG)

| ID | Rule | Enforced by | Tested |
|---|---|---|---|
| BR-ORG-01 | **Activating an academic session (create or update with `isActive`) deactivates every other active session platform-wide.** Sessions carry no school. | `academic-session.service.ts:49-53,167-171` | org-structure |
| BR-ORG-02 | Student creation, fee-voucher issue and student bulk import attach to *the first* active session found (`findFirst({isActive:true})`), not to a session for the student's school. | `student.service.ts:69`, `fee-vouchers.service.ts:30`, `students-bulk-import.service.ts:100` | none found for multi-school case |
| BR-ORG-03 | `Subject.name` is globally unique; `FeeStructure` and `Term` have no school. Their list endpoints are not school-scoped. | `schema.prisma`; archived `access-control-scoping-progress.md` | none |
| BR-ORG-04 | Only SUPER_ADMIN creates schools/campuses; SCHOOL_ADMIN can only create campuses for their own school; a principal login can be provisioned during creation. | `campus.service.ts:84`, `common/create-principal-user.ts` | org-provisioning |
| BR-ORG-05 | Classes belong to a campus **and** an academic session; `copy-structure` copies classes/sections (not class teachers) from one session to another idempotently (same campus + class name / section name are skipped); source ≠ target; SCHOOL_ADMIN is limited to their school's campuses. | `academic-session.service.ts:77-97` | org-structure |
| BR-ORG-06 | A section's class teacher must belong to the same campus as the class. | `sections.service.ts:100` | org-structure |

## 4. Students, parents, staff (BR-STU / BR-STF)

| ID | Rule | Enforced by | Tested |
|---|---|---|---|
| BR-STU-01 | Creating a student requires an active academic session and creates an enrollment in it. | `student/student.service.ts:66-71` | people-crud |
| BR-STU-02 | Creating a student requires **exactly one** of `parentProfileId` (link existing parent) or `newParent` (create login + profile). | `student/student.service.ts:59-66` | people-crud |
| BR-STU-03 | GR number and parent login identifiers are unique; duplicates return a friendly conflict error. | `applications.service.ts` (`assertCreatable`), `prisma-create-guard.ts` | people-crud, admissions |
| BR-STU-04 | Student lists include anyone ever enrolled in the caller's school, not only the active enrollment (withdrawn/graduated students stay visible to the school). | `student.service.ts:109-112` | people-crud |
| BR-STU-05 | Parent↔child links are managed through `StudentParent`; a parent may have multiple children, a child multiple parents. Maximum guardians / required relationship: **REQUIRES-DECISION (Q4)**. | `parent.service.ts`, schema | people-crud |
| BR-STF-01 | Staff/teacher records are school-scoped; a teacher may be linked to a staff record (`Teacher` stays a separate model). | `staff.service.ts`, `create-staff-with-optional-teacher.ts` | unit |
| BR-STF-02 | A hiring application can be decided once (approve/reject); approving a **teacher** hire requires a login identifier/password; candidate résumé must be uploaded via `/files` first. | `hiring-applications.service.ts:101-133`, `hiring-candidates.service.ts:40` | unit |

## 5. Admissions and enrollment (BR-ADM / BR-ENR)

| ID | Rule | Enforced by | Tested |
|---|---|---|---|
| BR-ADM-01 | An application can only be decided once; approved/rejected applications cannot be edited or re-decided. | `applications.service.ts:109,125,138` | admissions |
| BR-ADM-02 | Approval enrolls the student into the session **the application targeted**, not the globally-active one, and records `createdStudentId` and `reviewedById`. | `applications.service.ts:~150-175` | admissions |
| BR-ADM-03 | Approval needs exactly one of an existing parent or new-parent details; GR-number/parent-identifier collisions are rejected. | `applications.service.ts:143` | admissions |
| BR-ENR-01 | An enrollment is a dated record with status ACTIVE / TRANSFERRED / COMPLETED / WITHDRAWN; the code assumes one ACTIVE enrollment per student (`findFirst`), but the schema has **no unique constraint** enforcing it (`Enrollment` has only indexes on student/section/campus) — the invariant lives in application code only. | `enrollment.service.ts`, `promotions.service.ts` | people-crud |
| BR-ENR-02 | Promotion decisions per student: PROMOTED, RETAINED, GRADUATED, TRANSFERRED_OUT, WITHDRAWN. PROMOTED and RETAINED **require** a target section and create a new enrollment; the other three must not have one. | `promotions.service.ts:62,139-152` | promotions |
| BR-ENR-03 | Executing a promotion closes the ACTIVE enrollment (PROMOTED/RETAINED/GRADUATED → COMPLETED; TRANSFERRED_OUT → TRANSFERRED; WITHDRAWN → WITHDRAWN, `endDate = now`), requires the student's ACTIVE enrollment to be in the stated source session, and the target section to belong to the target session. All in one transaction with a `StudentPromotion` record and audit log. | `promotions.service.ts:139-230` | promotions |
| BR-ENR-04 | Promotion is scoped: caller must be allowed both the student's current campus/school and the target section's. | `promotions.service.ts:106,184,215` | promotions |

## 6. Daily operations (BR-TT / BR-ATT / BR-GRD / BR-RC / BR-LV / BR-IMP)

| ID | Rule | Enforced by | Tested |
|---|---|---|---|
| BR-TT-01 | A teacher or room cannot be double-booked in the same period (checked against existing entries and within a submitted bulk timetable). | `timetable.service.ts:96-104,196-224` | timetable-attendance |
| BR-ATT-01 | Attendance statuses: PRESENT, ABSENT, LATE, LEAVE, HOLIDAY. One record per student per **day** (`@@unique([studentId, date])` — there is no per-period attendance). Bulk marking requires a non-empty list. | schema `AttendanceStatus`; `attendance.service.ts:108` | timetable-attendance |
| BR-ATT-02 | Attendance cannot be marked on a declared holiday. Reports count calendar holidays separately from per-row HOLIDAY marks and **sum** them (documented double-count edge case). | `attendance.service.ts:20-38` | timetable-attendance |
| BR-ATT-03 | Marking attendance requires the student's section to have a class teacher assigned. | `attendance.service.ts:90-96` | timetable-attendance |
| BR-ATT-04 | A daily job (`0 3 * * *`) flags students whose absence rate over the last 30 days is ≥ 25 % (`RISK_THRESHOLD = 0.25`), requiring at least 5 tracked days. Whether the 25 % is an absence or a not-present rate: verify in Phase 7. | `attendance-risk.constants.ts:1-4`, `attendance-risk.job.ts` | unit |
| BR-GRD-01 | Final grade per subject = Σ(category weight % × obtained %) — a weighted percentage; **no letter grades or GPA exist**. | `grades.service.ts:44-47` | gradebook |
| BR-GRD-02 | Marks cannot exceed the assessment's max marks; only students actively enrolled in the assessment's class may receive marks. | `assessments.service.ts:114-131` | gradebook |
| BR-GRD-03 | Category weights for a class/term **should** total 100 %; the system only returns a warning when they don't (does not block). | `assessment-categories.service.ts:40-50` | gradebook |
| BR-RC-01 | One report card per student per academic session; report cards are records (with file) — not derived from marks. Product intent: **REQUIRES-DECISION (Q6)**. | `report-cards.service.ts:46` | holidays-complaints-report-cards |
| BR-LV-01 | Leave `startDate` must not be after `endDate`; a request can be decided once. | `leave.service.ts:34,103,183` | leave |
| BR-LV-02 | Approving leave requires a class teacher on the student's section. | `leave.service.ts:109` | leave |
| BR-IMP-01 | Bulk import is two-step (preview then commit) per entity (students, parents, teachers, staff). Preview reports **duplicates within the uploaded file** (by GR number / login identifier); services write audit logs. Cross-file/database duplicate handling: verify in Phase 7. | `bulk-import/*.service.ts` | bulk-import |

## 7. Fees (BR-FEE)

| ID | Rule | Enforced by | Tested |
|---|---|---|---|
| BR-FEE-01 | Issuing vouchers requires exactly one of `studentIds` or `sectionId`, an active academic session, and existing fee structures. Amounts are integers in the smallest currency unit. | `fee-vouchers.service.ts:27-39`, schema | fees |
| BR-FEE-02 | Only one voucher per student per month per session; duplicates are rejected for the whole request. Enforced by a pre-check in the service — `FeeVoucher` has **no unique constraint** for it (`schema.prisma` indexes only `studentId`). | `fee-vouchers.service.ts:50-58` | fees |
| BR-FEE-03 | A voucher already fully paid cannot be paid again; a payment cannot exceed the voucher's remaining balance; payments are allocated to vouchers via `FeePaymentAllocation` (unique per payment/voucher). | `fee-payments.service.ts:40,167`, schema:911 | fees |
| BR-FEE-04 | Gateway webhooks must carry a valid signature; otherwise 401. Real gateways require configuration; the stub webhook requires a secret outside dev/test. | `payments-webhook.controller.ts:33`, `.env.example` | fees |

## 8. Open product decisions — `REQUIRES-DECISION`

Documentation must not answer these; each needs a product owner ruling before any doc or code treats a behaviour as intended.

| ID | Question | Current behaviour (evidence) | Risk |
|---|---|---|---|
| **Q1** | Should `AcademicSession` be per school? | Global; activation deactivates all others; 3 call sites use "first active" (BR-ORG-01/02); seed creates one active per school (`seed.ts:154`) | Wrong-session enrollment/vouchers in a multi-school deployment |
| **Q2** | Should `Subject` be a per-school entity, and how are subjects created? | Global unique names; **no create endpoint or UI** | Cannot onboard subjects via product |
| **Q3** | Should `FeeStructure` and `Term` be school-scoped? | Unscoped lists; fee structures cannot be edited/deleted | Cross-school visibility of fee data |
| **Q4** | Guardian rules: max parents per child, relationship types, can a parent belong to multiple schools? | Unconstrained in service | Data quality |
| **Q5** | Promotion eligibility: are marks/attendance/fee-clearance thresholds required? Default decision? | `preview` suggests PROMOTED for everyone; no eligibility checks | Wrong promotions if used unreviewed |
| **Q6** | Should report cards be generated from gradebook marks? | Manual record + file | Duplicate data entry |
| **Q7** | Data retention/deletion policy for student & staff PII (CNIC, B-Form, medical) | `DELETE /admin/students/:id` performs a hard `student.delete` with an audit-log row (`student.service.ts:155-166`), blocked only by FK restrictions; no retention/soft-delete policy found | Privacy/legal exposure |
| **Q8** | Are the attendance-risk parameters (30 days, 25 %, ≥5 days) intended, and who is notified? | Hard-coded constants (`attendance-risk.constants.ts`) | Tuning requires a code change |
| **Q9** | Fee: late fees, discounts/scholarships, partial-payment rules, refunds | None found in code | Finance completeness |
