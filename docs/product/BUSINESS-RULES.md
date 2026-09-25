# SchoolOS — Business Rules Register

> **Status:** CURRENT (rules as implemented; §8 = DECIDED, not implemented) · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** cited per rule (`file:line`) · **Owner:** Product Owner
> **A rule appears here only if code enforces it.** "Enforced by" points at the enforcement point; "Tested" names e2e evidence where it exists ("unit" = colocated mocked-Prisma spec; "none found" = not confirmed). Where a rule conflicts with an owner decision (2026-09-20, §8), the decision is the intended rule and the current behaviour is recorded as a defect/work item.
> Specs in `docs/superpowers/specs/` were used only as leads; nothing is recorded from them unless the code confirms it.

## 1. Authentication (BR-AUTH)

| ID | Rule | Enforced by | Tested |
|---|---|---|---|
| BR-AUTH-01 | Login identifier is an email **or** a GR-number string; both are stored in `User.identifier` (unique). Failure messages are generic ("Invalid credentials") to prevent account enumeration. | `auth.service.ts:49-63`, `auth.constants.ts` | auth |
| BR-AUTH-02 | 5 consecutive failed logins lock the account for 15 minutes (`MAX_FAILED_ATTEMPTS=5`, `LOCKOUT_DURATION_MINUTES=15`). | `auth.constants.ts:3-4`, `auth.service.ts:67` | auth |
| BR-AUTH-03 | Access token lifetime = `JWT_ACCESS_TTL` (default 15 m); refresh token lifetime 30 days. Refresh tokens are stored hashed and **rotated on use** (presented token revoked immediately). **Since BL-21** every request re-checks the account: a disabled (`isLocked`), deleted or revoked session is refused on the next request; logout revokes one refresh token, logout-all every session. | `auth.constants.ts`, `auth.service.ts:109-129` | auth |
| BR-AUTH-04 | Change-password requires the current password and the new password must differ. Accounts provisioned with a generated password carry `mustChangePassword = true`, cleared on reset; **while set, the API refuses every route except change-password, logout-all and `GET /me` (403 `PASSWORD_CHANGE_REQUIRED`, BL-21)**. Changing or resetting a password ends every other session. | `auth.service.ts:222-225,198` | auth |
| BR-AUTH-05 | Forgot-password always returns the same message; reset token valid 1 hour, single use; all reset failures return one generic error. | `auth.constants.ts:13-20`, `auth.service.ts:192` | auth-password-reset |
| BR-AUTH-06 | Rate limits (non-test): 5 requests/minute on login/forgot/reset/change-password; 100/minute globally. | `throttler.config.ts`, `auth.controller.ts` | rate-limiting |

## 2. Scope and access (BR-SCOPE)

| ID | Rule | Enforced by | Tested |
|---|---|---|---|
| BR-SCOPE-01 | `SUPER_ADMIN` is unrestricted. Any other staff user without a `schoolId` is **denied everything** org-scoped. A user with `campusId = null` is school-wide; with a `campusId` they are confined to that campus. | `common/org-scope.service.ts:41-70` | cross-tenant-boundary, org-provisioning |
| BR-SCOPE-02 | **Parent messages go to the child's school (BL-23):** "School Admin", "Accounts" and "Principal" resolve to staff of the school the message's child attends; a parent with children in several schools names the child. **Parent `User` rows carry no `schoolId`** (`create-parent-with-user.ts:33`; `User.identifier` and `ParentProfile.cnic` are globally unique). A PARENT can access a student only through a `StudentParent` link — independent of enrollment status (history stays visible after withdrawal/graduation). | `student-access.service.ts:45-47` | me, cross-tenant-boundary |
| BR-SCOPE-03 | A TEACHER can access a student/section/class only if assigned to it via the timetable **or** as class teacher; sharing a campus is not sufficient. Fails closed for unrecognised roles. | `student-access.service.ts:14-16,91-122,174-178` | sections-access, cross-tenant-boundary |
| BR-SCOPE-04 | Deleting an org-structure row that is still referenced returns a clear 400 (FK violation translated); create conflicts are translated similarly. Foreign keys mix `Restrict` (30), `Cascade` (38), `SetNull` (25) and Prisma defaults (15) — see `docs/database/ERD.md`. | `common/prisma-delete-guard.ts`, `prisma-create-guard.ts` | cascade-delete-restrictions |

## 3. Organization (BR-ORG)

| ID | Rule | Enforced by | Tested |
|---|---|---|---|
| BR-ORG-01 | **As implemented (BL-01, M3, 2026-09-25):** every academic session belongs to one school (`schoolId`); activating a session deactivates only **that school's** other sessions. Creating a session requires its school. Copying a class structure is allowed only between sessions of the same school | `academic-session.service.ts` | org |
| BR-ORG-02 | **As implemented (BL-01):** student creation, fee-voucher issue and bulk import use the active session **of the student's school** (`active-session.ts`); vouchers are issued for one school per call. Until `npm run backfill:m3` has run, a school with no session of its own falls back to a legacy school-less active session (removed in the contract step) | `student.service.ts`, `fee-vouchers.service.ts`, `students-bulk-import.service.ts` | org |
| BR-ORG-03 | **Subjects (BL-02, M4, 2026-09-25):** every subject belongs to one school; its name is unique within that school; SUPER_ADMIN and a school-wide SCHOOL_ADMIN create, rename, deactivate and (if unused) delete them; teachers and accounts only read. Timetable, diary and assessment writes accept only an **active subject of the same school**; a used subject is deactivated, never deleted. `FeeStructure` and `Term` still have no school (BL-03) | `subjects.service.ts`, `subject-guard.ts` | org |
| BR-ORG-04 | Only SUPER_ADMIN creates schools/campuses; SCHOOL_ADMIN can only create campuses for their own school; a principal login can be provisioned during creation. | `campus.service.ts:84`, `common/create-principal-user.ts` | org-provisioning |
| BR-ORG-05 | **Copy structure (BL-33, 2026-09-25):** copies from a source session into a target session of the **same school**: classes and sections (names only, no class teachers), terms (dates shifted by the gap between the session starts), assessment categories and timetable templates (only into sections with no timetable yet; entries that would double-book a teacher or room are skipped and counted). It only creates rows in the target — the source and every historical session are never changed — and a repeat run creates nothing. SCHOOL_ADMIN within their own school (campus principal: their campus); SUPER_ADMIN any school. Audited | `academic-session.service.ts` | org-structure |
| BR-ORG-06 | A section's class teacher must belong to the same campus as the class. | `sections.service.ts:100` | org-structure |

## 4. Students, parents, staff (BR-STU / BR-STF)

| ID | Rule | Enforced by | Tested |
|---|---|---|---|
| BR-STU-01 | Creating a student requires an active academic session and creates an enrollment in it. | `student/student.service.ts:66-71` | people-crud |
| BR-STU-02 | Creating a student requires **exactly one** of `parentProfileId` (link existing parent) or `newParent` (create login + profile). | `student/student.service.ts:59-66` | people-crud |
| BR-STU-03 | GR number and parent login identifiers are unique; duplicates return a friendly conflict error. | `applications.service.ts` (`assertCreatable`), `prisma-create-guard.ts` | people-crud, admissions |
| BR-STU-04 | Student lists include anyone ever enrolled in the caller's school, not only the active enrollment (withdrawn/graduated students stay visible to the school). | `student.service.ts:109-112` | people-crud |
| BR-STU-05 | **Guardians (BL-04/BL-23, M6, 2026-09-26):** a guardian's link to a student has a required relationship type (Father/Mother/Guardian/Other, free text kept for Other), an emergency flag and optionally one of **two primary slots** (a third primary is rejected, 409; unique `(studentId, primarySlot)`); a new student's first guardian is primary (slot 1); a student always keeps at least one guardian. Identity is global (one account, CNIC/identifier unique). A school admin sees and edits only **their own school's links** of a guardian; the guardian's profile, password and account are changed or deleted by a school admin only when all the guardian's enrolled children are in that admin's school/campus — otherwise by a super admin. Another school links an existing guardian after an exact lookup by identifier or CNIC (never by name), learning nothing about other schools' children. A super-admin dedupe report lists profiles sharing CNIC/identifier/phone/e-mail; nothing is merged automatically. | `parent.service.ts`, `guardian-links.ts`, migration `20260926150000_m6_guardian_links` | people-crud |
| BR-STF-01 | Staff/teacher records are school-scoped; a teacher may be linked to a staff record (`Teacher` stays a separate model). | `staff.service.ts`, `create-staff-with-optional-teacher.ts` | unit |
| BR-STF-02 | A hiring application can be decided once (approve/reject); approving a **teacher** hire requires a login identifier/password; candidate résumé must be uploaded via `/files` first. | `hiring-applications.service.ts:101-133`, `hiring-candidates.service.ts:40` | unit |

## 5. Admissions and enrollment (BR-ADM / BR-ENR)

| ID | Rule | Enforced by | Tested |
|---|---|---|---|
| BR-ADM-01 | An application can only be decided once; approved/rejected applications cannot be edited or re-decided. | `applications.service.ts:109,125,138` | admissions |
| BR-ADM-02 | Approval enrolls the student into the session **the application targeted**, not the globally-active one, and records `createdStudentId` and `reviewedById`. | `applications.service.ts:~150-175` | admissions |
| BR-ADM-03 | Approval needs exactly one of an existing parent or new-parent details; GR-number/parent-identifier collisions are rejected. | `applications.service.ts:143` | admissions |
| BR-ENR-01 | An enrollment is a dated record with status ACTIVE / TRANSFERRED / COMPLETED / WITHDRAWN; **at most one ACTIVE enrollment per student, enforced by a partial unique index since BL-53 (M12, 2026-09-26)**; a promotion that races another for the same student gets 409 and changes nothing. | `enrollment.service.ts`, `promotions.service.ts` | people-crud |
| BR-ENR-02 | Promotion decisions per student: PROMOTED, RETAINED, GRADUATED, TRANSFERRED_OUT, WITHDRAWN. PROMOTED and RETAINED **require** a target section and create a new enrollment; the other three must not have one. | `promotions.service.ts:62,139-152` | promotions |
| BR-ENR-03 | Executing a promotion closes the ACTIVE enrollment (PROMOTED/RETAINED/GRADUATED → COMPLETED; TRANSFERRED_OUT → TRANSFERRED; WITHDRAWN → WITHDRAWN, `endDate = now`), requires the student's ACTIVE enrollment to be in the stated source session, and the target section to belong to the target session. All in one transaction with a `StudentPromotion` record and audit log. | `promotions.service.ts:139-230` | promotions |
| BR-ENR-04 | Promotion is scoped: caller must be allowed both the student's current campus/school and the target section's. | `promotions.service.ts:106,184,215` | promotions |

## 6. Daily operations (BR-TT / BR-ATT / BR-GRD / BR-RC / BR-LV / BR-IMP)

| ID | Rule | Enforced by | Tested |
|---|---|---|---|
| BR-TT-01 | A teacher or room cannot be double-booked in the same period (checked against existing entries and within a submitted bulk timetable). | `timetable.service.ts:96-104,196-224` | timetable-attendance |
| BR-ATT-01 | Attendance statuses: PRESENT, ABSENT, LATE, LEAVE, HOLIDAY. One record per student per **day** (`@@unique([studentId, date])` — there is no per-period attendance). Bulk marking requires a non-empty list. | schema `AttendanceStatus`; `attendance.service.ts:108` | timetable-attendance |
| BR-ATT-02 | Attendance cannot be marked on a declared holiday. Reports count calendar holidays separately from per-row HOLIDAY marks and **sum** them (documented double-count edge case). | `attendance.service.ts:20-38` | timetable-attendance |
| BR-ATT-03 | **As implemented (BL-60, migration M1, 2026-09-25):** any authorised TEACHER/SCHOOL_ADMIN/SUPER_ADMIN may mark; a class teacher is **not** required. Every write records the real actor in `Attendance.markedByUserId`; `markedById` (Teacher FK, now optional) is set **only** when the actor is a Teacher — no Teacher identity is ever borrowed or synthesised. Legacy rows keep their `markedById`; `markedByUserId` is backfilled from the audit log (`npm run backfill:m1`, rules A1–A3), unresolvable rows stay null | `attendance.service.ts`, migration `20260925090000_m1_attendance_marked_by_user` | attendance |
| BR-ATT-04 | A daily job (`0 3 * * *`) flags students whose absence rate over the last 30 days is ≥ 25 % (`RISK_THRESHOLD = 0.25`), requiring at least 5 tracked days. Whether the 25 % is an absence or a not-present rate: verify in Phase 7. | `attendance-risk.constants.ts:1-4`, `attendance-risk.job.ts` | unit |
| BR-GRD-01 | Final grade per subject = Σ(category weight % × obtained %) — a weighted percentage; **no letter grades or GPA exist**. | `grades.service.ts:44-47` | gradebook |
| BR-GRD-02 | Marks cannot exceed the assessment's max marks; only students actively enrolled in the assessment's class may receive marks. | `assessments.service.ts:114-131` | gradebook |
| BR-GRD-03 | Category weights for a class/term **should** total 100 %; the system only returns a warning when they don't (does not block). | `assessment-categories.service.ts:40-50` | gradebook |
| BR-RC-01 | One report card per student per academic session; report cards are records (with file) — not derived from marks. Decided intent: generate from the gradebook (§8 Q6) — not yet implemented. | `report-cards.service.ts:46` | holidays-complaints-report-cards |
| BR-LV-01 | Leave `startDate` must not be after `endDate`; a request can be decided once. | `leave.service.ts:34,103,183` | leave |
| BR-LV-02 | **As implemented (BL-60, 2026-09-25):** approving leave no longer requires a class teacher; the generated LEAVE rows carry `markedByUserId` = the approver and `markedById` only if the approver is a Teacher. The student must still have an active enrolment. **Still to do (BL-29, M1b):** recommendation step and separate recommender/decider fields | `leave.service.ts` | leave |
| BR-IMP-01 | Bulk import is two-step (preview then commit) per entity (students, parents, teachers, staff). Preview reports **duplicates within the uploaded file** (by GR number / login identifier); services write audit logs. Cross-file/database duplicate handling: verify in Phase 7. | `bulk-import/*.service.ts` | bulk-import |

## 7. Fees (BR-FEE)

| ID | Rule | Enforced by | Tested |
|---|---|---|---|
| BR-FEE-01 | Issuing vouchers requires exactly one of `studentIds` or `sectionId`, an active academic session, and existing fee structures. Amounts are integers in the smallest currency unit. | `fee-vouchers.service.ts:27-39`, schema | fees |
| BR-FEE-02 | Only one voucher per student per month per session; duplicates are rejected for the whole request (400 from the pre-check). **Enforced by the database since BL-53 (M12, 2026-09-26):** unique `(studentId, academicSessionId, month)`; a run that races another one gets 409 and creates nothing (all vouchers of a run are one transaction). | `fee-vouchers.service.ts`, migration `20260926120000_m12_db_invariants` | fees |
| BR-FEE-03 | A voucher already fully paid cannot be paid again; a payment cannot exceed the voucher's remaining balance; payments are allocated to vouchers via `FeePaymentAllocation` (unique per payment/voucher). | `fee-payments.service.ts:40,167`, schema:911 | fees |
| BR-FEE-05 | **Fee structures (BL-03, M5, 2026-09-25):** each belongs to one school and moves DRAFT → ACTIVE → LOCKED (automatically, when first invoiced) → ARCHIVED; name/amount are editable only while DRAFT or ACTIVE-and-never-invoiced; only ACTIVE/LOCKED structures of the students' own school can be issued; ARCHIVED ones are hidden from new vouchers and can be restored; nothing is hard-deleted. Voucher lines reference their structure (`FeeItem.feeStructureId`). Terms are scoped through their session's school | `fee-structures.service.ts`, `fee-vouchers.service.ts`, `terms.service.ts` | fees |
| BR-FEE-04 | Gateway webhooks must carry a valid signature; otherwise 401. Real gateways require configuration; the stub webhook requires a secret outside dev/test. | `payments-webhook.controller.ts:33`, `.env.example` | fees |

## 8. Product decisions — DECIDED 2026-09-20 (owner), not yet implemented

> Q1–Q9 were answered by the Product Owner on 2026-09-20 (register: [OWNER-DECISIONS](OWNER-DECISIONS.md)). **"Intended" is the decided policy; "Current" is what the code does today and stays the documented behaviour (§1–§7) until the work item ships.** Where they differ, the intended rule stands and the difference is an engineering defect/work item (owner ruling).

| ID | Status | Intended rule (DECIDED) | Current behaviour (evidence) | Work item |
|---|---|---|---|---|
| **Q1** Academic sessions | DECIDED | School-scoped; each school has its own calendar; existing data backfilled to the right school's session; "active" resolved per school | Global; activation deactivates all others; 3 "first active" call sites (BR-ORG-01/02) | BL-01 |
| **Q2** Subjects | DECIDED | School-scoped and reusable across campuses/classes; SUPER_ADMIN and own-school SCHOOL_ADMIN manage; teachers cannot create school subjects; active/inactive instead of delete when history exists; **yearly syllabus per class + subject, per session** | Global unique names; no create endpoint/UI; no syllabus | BL-02, BL-26 |
| **Q3** Fee structures / terms | DECIDED | School-scoped; editable while draft/unused; **locked** once invoices/transactions depend on them; archived, never hard-deleted | Unscoped lists; structures cannot be edited/deleted | BL-03 |
| **Q4** Guardians | DECIDED | Global person identity; separate auth account; school-scoped relationship and authorisation; one parent account across schools (no per-school duplicates); relationship type required (Father/Mother/Guardian/Other); primary flag; **max 2 primary per student**, unlimited non-primary/emergency guardians | Parent `User` has **no** `schoolId` and identity is already global; `StudentParent` links are unconstrained (no relationship type/primary flag); circular/diary fan-out is not school-scoped (BR-STU-05, BR-SCOPE-02, KG-1) | BL-23, BL-04 |
| **Q5** Promotion | DECIDED | Manual admin decision; system shows results/attendance/fee-clearance indicators as warnings (blocking only if a school configures it); explicit admin confirmation; outcomes: Promoted, Promoted with conditions, Retained, Transferred, Withdrawn/Left; history never altered | PROMOTED/RETAINED/GRADUATED/TRANSFERRED_OUT/WITHDRAWN; preview suggests PROMOTED for all; no indicators (BR-ENR-02/03) | BL-05 (terminology: BL-61, mapping below) |
| **Q6** Report cards | DECIDED | Generated from gradebook (marks, %, letter grade, configurable scales, remarks, subject-wise and overall result), PDF export; GPA optional in the model; uploaded historical report cards still supported | Manual record + file; weighted % only, no letter grades (BR-GRD-01, BR-RC-01) | BL-27, BL-06 |
| **Q7** Retention | DECIDED | Retain; active vs archived/former; soft delete only where legally required; history preserved; export for authorised admins; permanent erasure only SUPER_ADMIN/privacy administrators per legal policy; **no automatic deletion until a retention policy exists** (periods: RD-6) | `DELETE /admin/students/:id` hard-deletes (`student.service.ts:155-166`) | BL-07, BL-41 |
| **Q8** Attendance risk | DECIDED | Defaults 30 days / 25 % / ≥ 5 tracked days, **configurable per school** (all campuses; campus overrides later); alert to class teacher and school admin; parent notification supported but off until the school enables it | Hard-coded constants (`attendance-risk.constants.ts`) (BR-ATT-04) | BL-28 |
| **Q9** Fees | DECIDED | Discounts, scholarships, late fees, refunds, installments, carry-forward, outstanding balances, partial payments, waivers, defaulter reports, accounting exports; paid history immutable/auditable; carry-forward on session/class change. Pilot subset: structures, terms, charges, payments, outstanding, defaulters, basic carry-forward | Vouchers/payments/reconcile only (BR-FEE-01..04) | BL-08, BL-24 |

### Other decided rules (from the owner's answers Q10–Q19), pending implementation
| ID | Intended rule | Current behaviour | Work item |
|---|---|---|---|
| **BR-D-10** Complaints | Parents raise complaints and see status/history; staff assign, respond, add internal notes, track resolution; parents never see internal notes | Parents read-only; staff create/update | BL-30, BL-31 |
| **BR-D-11** Attendance granularity | Daily attendance for release 1; design must allow per-period later | Daily only (BR-ATT-01) | BL-45 |
| **BR-D-12** Leave | Teacher/class teacher may recommend; authorised SCHOOL_ADMIN approves/rejects; no class teacher required; recommendation and decision separately attributed; never fabricate a teacher attribution | Approval requires a class teacher; attendance stamped with that teacher (BR-LV-02, `leave.service.ts:108-143`) | BL-29 |
| **BR-D-13** Students | No student login in the initial release; architecture must not preclude it | none | BL-47 |
| **BR-D-14** Admissions | Staff-entered now; public online admissions is a future API | staff-entered | BL-46 |
| **BR-D-15** Staff history | Keep teacher/staff assignment history: teacher, session, school/campus, class, section, subject, role, start/end dates | NOT IMPLEMENTED | BL-25 |
| **BR-D-18** ACCOUNTS | Fees/finance only; admissions, complaints, messaging only via explicit permission grants | **Implemented 2026-09-26 (BL-32):** `User.grants` (`ADMISSIONS`, `COMPLAINTS`, `MESSAGES`), empty by default; `@RequiresGrant` on the admissions, complaints and conversations controllers; a parent writing to "Accounts" reaches only a granted ACCOUNTS user; set by SCHOOL_ADMIN (own school/campus) or SUPER_ADMIN via `PUT /admin/users/:id/grants`, audited `account.grants` with before/after | BL-32 |
| **BR-D-19** Copy structure | SCHOOL_ADMIN (own school) and SUPER_ADMIN may copy classes, sections, subjects, subject assignments, syllabus structure, timetable templates into a new session; never modifies historical data; UI must match the API | API allows SCHOOL_ADMIN, UI is SUPER_ADMIN-only; classes/sections only (BR-ORG-05, KI-18) | BL-33 |

### Decided rules from the owner's second ruling (2026-09-20), pending implementation
| ID | Intended rule | Current behaviour | Work item |
|---|---|---|---|
| **BR-D-RD8** Attendance marking | Class-teacher assignment is optional; attendance is never blocked for lack of one; an authorised teacher/staff member marks per permissions; the **actual marker/modifier is recorded in `markedByUserId`**; `markedById` is set only when the actor is a Teacher; a class teacher, if present, uses the normal workflow; no synthesised Teacher identity | `markedById` is a required Teacher FK; non-Teacher markers are attributed to the section's class teacher or refused (BR-ATT-03) | BL-60 (M1) |
| **BR-D-RD9** Complaints (pilot scope) | Parent submits complaint (category, title, description, attachments where supported); status; assigned owner; internal notes (never visible to parents); resolution/comments; timestamps; audit trail. Escalation, SLA automation, timers, complex routing, automated workflows, advanced analytics, cross-campus administration and approval chains are post-pilot | Staff-only creation; no parent submission | BL-30, BL-31 |
| **BR-D-RD6** Retention | A configurable retention policy per category (student, guardian, staff, attendance, results/report cards, fee/financial, complaints, audit logs, authentication/security logs, uploaded documents, backups); periods TBD pending legal review; **no automatic deletion until periods are approved**; CNIC/government identifiers and medical data are sensitive; encryption-at-rest supported; field-level encryption only if a legal/security review requires it, without a data-model redesign | No retention policy; hard delete of students | BL-63, BL-07 |
| **BR-D-RD14** Pilot payments | Gateways OFF in the pilot; manual fee recording, vouchers/receipts, manual payment status and reconciliation must work; gateways stay behind configuration flags and can be enabled later without redesigning fees | Manual reconcile exists; gateways configurable but unverified | BL-08, BL-14 |
| **BR-D-RD10** Student lifecycle statuses | Final terms **ACTIVE, TRANSFERRED, WITHDRAWN, GRADUATED**; no separate `TRANSFERRED_OUT`; `WITHDRAWN` = withdrawn/left; history keeps previous status/session/class; controlled migration | see mapping below | BL-61 |
| **BR-D-RD11** Migration | Explicit, auditable, backward-aware, idempotent where practical, tested before production; ambiguous session mappings flagged for manual review; guardians matched only on reliable identifiers, never merged by name similarity, never merged so as to expose another school's students; strategy + reconciliation report before execution | n/a | BL-62 |

**Lifecycle terminology mapping (derived from RD-10 and the current schema; no change is made yet):**
| Enum (schema) | Today | Final |
|---|---|---|
| `StudentStatus` (`Student.status`) | ACTIVE, LEFT, GRADUATED, WITHDRAWN | ACTIVE, **TRANSFERRED**, WITHDRAWN, GRADUATED — `LEFT` is retired: today a promotion `TRANSFERRED_OUT` sets `LEFT` (`promotions.service.ts:55-57`), so `LEFT` with a matching transferred-out promotion → TRANSFERRED; other `LEFT` rows are ambiguous → manual review |
| `PromotionDecision` | PROMOTED, RETAINED, TRANSFERRED_OUT, GRADUATED, WITHDRAWN | PROMOTED, **PROMOTED_WITH_CONDITIONS** (new), RETAINED, **TRANSFERRED** (renamed), GRADUATED, WITHDRAWN |
| `EnrollmentStatus` | ACTIVE, TRANSFERRED, COMPLETED, WITHDRAWN | unchanged — `COMPLETED` is the per-session closure of an enrolment, not a student lifecycle state |

### Still open
No business-rule question remains `REQUIRES-DECISION`. Remaining unknowns are legal/vendor values (retention periods, notification timelines, providers) — see [OWNER-DECISIONS → Remaining unresolved decisions](OWNER-DECISIONS.md#remaining-unresolved-decisions--tbds-only).
