> **ARCHIVED 2026-09-20** — Superseded by docs/database/ (rewritten in a later phase). Do not treat as current documentation.

# Full Data Model Audit (Phase 1)

Read-only audit of the current SchoolApp/SchoolOS ("SchoolOS Digital Platform") data model, as
requested ahead of extending Student/Parent/Teacher/Admission into a production-ready school
management data model. No schema, code, or data was changed while producing this document.

Scope inspected: `backend/prisma/schema.prisma`, all six migrations under
`backend/prisma/migrations/`, `backend/prisma/seed.ts`, the backend modules for student, teacher,
parent, admissions, enrollment, and auth (`backend/src/**`), the staff-console Vue forms
(`staff-console/src/views/**`), and the parent-app Flutter client (`parent-app/lib/src/**`).

## Migration history (chronological)

1. `20260908000000_postgres_baseline` (678 lines) — the full baseline schema (SQLite→Postgres
   migration for Sprint B), essentially everything in the current `schema.prisma` up to Sprint
   3-4: School/Campus/AcademicSession/Class/Section/Subject, User/Teacher/ParentProfile/Student/
   Enrollment/StudentParent, Timetable/Attendance/Diary, Circular/Conversation/Message/
   Notification, Fees (FeeStructure/FeeVoucher/FeeItem/FeePayment/FeePaymentAllocation/Receipt),
   LeaveRequest, File, AuditLog.
2. `20260911000000_notification_channel_preferences` — added `NotificationChannel` enum,
   `User.notificationChannel`/`digestEnabled`, `Notification.dispatchedAt`.
3. `20260911001942_sprint_ijk_new_models` — added Holiday, Complaint, PasswordResetToken,
   ReportCard, DraftSuggestion, AttendanceRiskFlag, DeviceToken.
4. `20260912130140_teacher_campus_user_school_id` — added `Teacher.campusId` (required, no
   default — backfilled before making it required) and `User.schoolId`.
5. `20260913075451_add_gradebook` — added Term, AssessmentCategory, Assessment, Mark.
6. `20260913080800_add_admissions` — added Applicant, Application.

This is a live, actively-migrating schema (last two migrations landed today, 2026-09-13), not a
frozen MVP — later migrations already show the team's own established pattern: additive tables
plus nullable/backfilled columns, never a destructive rewrite. Phase 2/3 should follow the same
shape.

## Seed data (`backend/prisma/seed.ts`)

Creates: 1 School, 2 Campuses, 1 AcademicSession, 3 Class/Section pairs (3A/4B/5C, one per
campus/class-teacher trio), 6 Subjects, 3 Teacher+User pairs, 1 Admin, 1 Accounts, 1 Super Admin,
1 Principal (a SCHOOL_ADMIN with `isPrincipal: true`), 3 Students (`GR-1001..1003`) each with an
Enrollment, 2 ParentProfile+User pairs linked via StudentParent (`relationship: 'mother'|'father'`
— a free-text string, not an enum), a full Mon-Fri/6-period Timetable and 10 weekdays of
Attendance per section, 1 DiaryEntry per section, 1 Circular, 1 Conversation with a reply, 3
Notifications, 1 FeeStructure/Voucher/Payment/Receipt, 1 pending LeaveRequest. It does **not**
seed any Applicant/Application, Holiday, Complaint, ReportCard, Term/AssessmentCategory/
Assessment/Mark, or DeviceToken row — those newer models exist in the schema but have no seed
coverage yet.

Every Student/Teacher/ParentProfile row the seed creates has only a bare `name` (and Teacher/
Parent a `phone`) — no DOB, address, gender, or any other identity/contact field, because none
exist on those models today.

## Per-domain audit

### Student

- **Current model**: `Student` (`schema.prisma:209-226`)
- **Current purpose**: The enrolled child record — anchors Enrollment, Attendance, FeeVoucher,
  LeaveRequest, Conversation, Complaint, ReportCard, AttendanceRiskFlag, Mark, and (optionally) the
  Application that created it.
- **Current fields**: `id`, `grNumber` (unique), `name`, `createdAt`, `updatedAt`. That is the
  entire model — no DOB, gender, photo, address, admission date, status, or any contact field.
- **Current APIs/forms**:
  - `POST/GET/PATCH/DELETE /api/v1/admin/students` (`student.controller.ts`, SCHOOL_ADMIN/
    SUPER_ADMIN only). Create accepts `grNumber`, `name`, `sectionId`, and exactly one of
    `parentProfileId` or `newParent` (nested `CreateParentDto`). Update accepts only `grNumber`/
    `name` — the DTO's own comment notes "No enrollment/parent-link changes here — no
    re-enrollment/transfer workflow exists yet."
  - Staff-console `StudentManagementView.vue`: "Add Student" modal has exactly GR number, full
    name, section, and a parent picker (existing dropdown or new-parent sub-form: login email,
    password, name, phone). Inline edit row only edits GR number and name.
  - `students-bulk-import.service.ts` (CSV import) mirrors the same four fields
    (`grNumber, name, sectionId, parentIdentifier|newParent*`) — no additional columns.
  - Parent-app Flutter client shows only `name`/`grNumber` for the child switcher; no profile
    screen exists there.
- **Missing information** (relative to the Phase 2 brief): gender, DOB, place of birth,
  nationality, religion, blood group, B-Form/identity reference, profile photo, admission
  date/leaving date/leaving reason, status (active/left/graduated), any contact fields (mobile,
  email), any address, previous-school information, emergency contacts, medical/welfare
  information, and a document system. None of these exist anywhere in the current model.
- **Duplicated/normalization concerns**: none internal to Student itself — it's minimal, not
  duplicated. The real duplication risk is at the Student↔Applicant boundary (see Admission below
  and Cross-cutting §1).
- **Migration considerations**: `Student` already has real production rows once deployed (via
  seed and any live admissions). Any new required field must be nullable or have a default —
  there's no existing DOB/address data to backfill from, so those fields can only launch as
  optional until back-filled by staff. `grNumber` stays the natural external identifier; no
  reason to change the PK strategy (uuid, matches every other model).

### Parent / ParentProfile

- **Current model**: `ParentProfile` (`schema.prisma:249-258`), joined to Student via
  `StudentParent` (`schema.prisma:261-273`).
- **Current purpose**: The guardian identity behind a login (`User.role = 'PARENT'`), one-to-one
  with `User`, many-to-many with Student via the join table.
- **Current fields**: `ParentProfile` — `id`, `userId` (unique), `name`, `phone` (nullable).
  `StudentParent` — `id`, `studentId`, `parentProfileId`, `relationship` (free-text string,
  default `"guardian"`), `createdAt`, unique on `(studentId, parentProfileId)`.
- **Current APIs/forms**:
  - `POST/GET/PATCH/DELETE /api/v1/.../parents` (`parent.controller.ts`) — create takes
    `identifier`, `password`, `name`, optional `phone`.
  - Staff-console `ParentManagementView.vue`: "Add Parent" form = login email, initial password,
    full name, phone. Inline edit = name, phone, password reset.
  - Referenced (not separately created) from Student/Application forms via `newParent` /
    `parentProfileId` picker.
- **Missing information**: no father/mother/guardian type distinction beyond the free-text
  `relationship` string on the join row (no enum), no DOB, occupation/employer, address, WhatsApp
  number, alternate mobile, identity reference, or any of the emergency/authorization flags
  (primary contact, authorized pickup, receives-fee-info, etc.) called for in the brief. The
  relationship join row already has the right *shape* for per-relationship properties (it's a
  proper many-to-many join, not flattened onto Student) — it just doesn't carry those extra
  columns yet.
- **Duplicated/normalization concerns**: `ParentProfile` is correctly normalized (already a
  separate entity + join table, not fields on Student) — this part of the brief's target shape
  already exists. The concern is entirely at the Applicant boundary: `Applicant.guardianName` /
  `guardianPhone` are flat strings on a *different* model with no FK to `ParentProfile`, and
  `ApplicationsService.approve()` (`applications.service.ts:120-166`) never reads them — the
  reviewer must independently pick an existing `parentProfileId` or fill in a brand-new
  `CreateParentDto` by hand, even though the guardian's name/phone were already captured at
  intake. See Cross-cutting §1.
- **Migration considerations**: adding relationship-type enum + authorization flags to
  `StudentParent` is a pure additive column change with sensible defaults (e.g. keep
  `relationship` as-is or migrate its free-text values into a new enum column via a backfill
  script — existing values are only `"mother"`, `"father"`, `"guardian"` per the seed, but
  production data should be checked before assuming that's exhaustive).

### Teacher / Staff

- **Current model**: `Teacher` (`schema.prisma:191-205`)
- **Current purpose**: Staff profile 1:1 with a `User` (`role = 'TEACHER'`), scoped to one
  `Campus`, referenced by Timetable, Section.classTeacherId, and Attendance.markedBy.
- **Current fields**: `id`, `userId` (unique), `name`, `campusId`, `createdAt`, `updatedAt`. No
  employee ID, DOB, gender, contact fields beyond the login `identifier` on `User`, department,
  designation, employment type/dates, qualifications, or subject/class assignments beyond the
  ad-hoc Timetable rows.
- **Current APIs/forms**:
  - `POST/GET/PATCH/DELETE /api/v1/.../teachers` (`teacher.controller.ts`/`teacher.service.ts`) —
    create takes `identifier`, `password`, `name`, `campusId`.
  - A second, separate, read-only `GET /api/v1/teachers` (`teachers.controller.ts`/
    `teachers.service.ts`, plural module) exists solely for the Timetable editor's teacher
    picker — not a duplicate CRUD surface, just a narrow listing endpoint the timetable feature
    added; worth noting so Phase 3 doesn't confuse the two modules.
  - Staff-console `TeacherManagementView.vue`: "Add Teacher" = login email, password, full name,
    campus. Inline edit = name, password reset.
  - `teachers-bulk-import.service.ts` mirrors the same four fields.
- **Missing information**: everything in the brief's Personal/Contact/Employment/Academic
  sections beyond name+campus — employee ID/number, DOB, gender, nationality, photo, mobile/
  alternate mobile/email/address, department, designation, employment type, joining/confirmation/
  leaving dates, employment status, reporting manager, qualifications/certifications,
  specialization, years of experience, previous employer. Teacher↔Subject and Teacher↔Class
  assignment today only exists implicitly through `Timetable` rows (a teacher is "assigned" a
  subject/section only by having a timetable slot) and `Section.classTeacherId` — there is no
  standalone "this teacher is qualified/assigned to teach this subject" model independent of the
  timetable.
- **Duplicated/normalization concerns**: none found — the model is minimal but not duplicated.
- **Migration considerations**: `Teacher.campusId` itself was added in a recent migration
  (`20260912130140`) as a required column with an explicit backfill (its own migration file's
  warning about "not possible if the table is not empty" confirms the team already handled one
  required-column-on-existing-rows case correctly) — the same pattern (backfill script before
  `NOT NULL`) will be needed for any new required Teacher column.

### Admission (Applicant / Application)

- **Current models**: `Applicant` (`schema.prisma:685-696`), `Application`
  (`schema.prisma:698-717`) — added today in `20260913080800_add_admissions`, the newest models
  in the schema.
- **Current purpose**: `Applicant` is the prospective student's intake record; `Application` is
  one admission attempt (a class + session + status) against an `Applicant`, which on approval
  creates a real `Student` + `Enrollment` (and links/creates a `ParentProfile`).
- **Current fields**:
  - `Applicant`: `id`, `name`, `dateOfBirth`, `guardianName`, `guardianPhone`, `createdAt`,
    `updatedAt`. Indexed on `guardianPhone`.
  - `Application`: `id`, `applicantId`, `desiredClassId`, `academicSessionId`, `status`
    (free-text string, default `"SUBMITTED"` — not a Prisma enum), `decisionNotes`,
    `reviewedById`, `createdStudentId` (unique, nullable FK to `Student`), `createdAt`,
    `updatedAt`. Indexed on `applicantId` and `(academicSessionId, status)`.
- **Current APIs/forms**:
  - `applicants.controller.ts`/`applicants.service.ts` — `CreateApplicantDto` (`name`,
    `dateOfBirth`, `guardianName`, `guardianPhone`).
  - `applications.controller.ts`/`applications.service.ts` — create (`CreateApplicationDto`:
    `applicantId`, `desiredClassId`, `academicSessionId`), status update
    (`UpdateApplicationDto`, restricted to `UNDER_REVIEW`/`WITHDRAWN` — approve/reject are
    separate dedicated endpoints/methods, not generic status writes), reject (sets `REJECTED` +
    `decisionNotes` + `reviewedById`), and approve (`ApproveApplicationDto`: `grNumber`,
    `sectionId`, plus exactly one of `parentProfileId`/`newParent`) which
    transactionally calls `createStudentWithEnrollment` and stamps `createdStudentId`.
    `TERMINAL_STATUSES = ['APPROVED', 'REJECTED']` blocks any further status change once decided.
  - Staff-console: `ApplicantIntakeView.vue` (name, DOB, guardian name, guardian phone, desired
    class, academic session), `AdmissionsQueueView.vue` (list/filter by session+status),
    `ApplicationDetailView.vue` (reject with notes; approve with GR number, section, and the same
    existing-or-new-parent picker used on Student creation).
- **Missing information**: no application number, application date (beyond `createdAt`),
  admission source/referral, applying section (only class), previous-school info, document
  uploads, or the fuller status workflow named in the brief (Draft/Under Review/Interview/Test/
  Waitlisted/Enrolled) — today's `status` is an unconstrained string with only
  SUBMITTED/UNDER_REVIEW/WITHDRAWN/APPROVED/REJECTED actually reachable through the service layer.
- **Duplicated/normalization concerns (the most important finding in this audit)**:
  `Applicant.guardianName`/`guardianPhone` are flat strings that structurally duplicate what
  `ParentProfile.name`/`phone` already model as a normalized entity — but the two are never
  connected. `ApplicationsService.approve()` ignores `applicant.guardianName`/`guardianPhone`
  entirely; the reviewer re-enters (or separately selects) the parent from scratch. This means (a)
  the guardian's name/phone captured at intake time is dead data once approved unless a human
  manually retypes it into `newParent`, and (b) nothing stops a reviewer from linking a completely
  different parent than the one who actually applied. `Applicant` itself never becomes a `Student`
  or `ParentProfile` — it stays a permanent, disconnected historical record once
  `createdStudentId` is set. Phase 2 needs to decide explicitly whether `Applicant`
  guardian fields should be pre-filled into the approval form, promoted into a real
  `ParentProfile` candidate, or left as intake-only historical data with a clearer note that
  they're not authoritative post-approval.
- **Migration considerations**: this is the newest, smallest surface — lowest risk to extend
  further (no legacy data shape to preserve beyond today's rows, if any exist yet in a deployed
  environment). `status` should likely become a real Prisma enum before more statuses are added,
  which is a safe additive migration (`ALTER TABLE ... ALTER COLUMN` to the new enum type) as long
  as every existing string value maps onto the new enum's members.

### Enrollment / Academic History

- **Current model**: `Enrollment` (`schema.prisma:228-247`)
- **Current purpose**: Already the historical join between Student↔Section↔Campus↔AcademicSession
  the brief asks for — `startDate`/`endDate`/`status` (`EnrollmentStatus`: ACTIVE/TRANSFERRED/
  COMPLETED) support multiple rows per student across sessions without overwriting history.
  `EnrollmentService.getEnrollmentForDate()` (`enrollment.service.ts:37-50`) already resolves
  "which section was this student in as of date X" specifically so a later transfer doesn't
  retroactively rewrite past Diary/Attendance views — this is a real strength already in place,
  not a gap.
- **Current fields**: `id`, `studentId`, `campusId`, `sectionId`, `academicSessionId`,
  `startDate`, `endDate` (nullable), `status`, `createdAt`, `updatedAt`. Indexed on `studentId`,
  `sectionId`, `campusId`.
- **Current APIs/forms**: created only as a side effect of `createStudentWithEnrollment` (student
  creation and application approval) — there is **no** standalone endpoint to promote a student to
  a new class/section/session, end an enrollment, or record a transfer. `UpdateStudentDto`'s own
  comment confirms this gap explicitly ("no re-enrollment/transfer workflow exists yet").
- **Missing information**: roll number (not modeled anywhere — Section has no per-student roll
  number field, and neither does Enrollment), promotion date (distinct from a new enrollment's
  `startDate`), remarks. The *shape* for full academic history already exists; what's missing is
  the workflow/endpoint to create new Enrollment rows over time (promotion, mid-year transfer)
  and a couple of fields.
- **Duplicated/normalization concerns**: none — this is the one area already built the way the
  brief asks for.
- **Migration considerations**: adding `rollNumber` to `Enrollment` (rather than `Student`) is the
  natural extension, since roll numbers are typically per-section-per-year, not a permanent
  student attribute — this keeps history correct if a roll number changes on promotion.

### Class / Section / Subject / AcademicSession

- **Current models**: `Class`, `Section`, `Subject`, `AcademicSession`
  (`schema.prisma:131-189`).
- **Current purpose**: Standard org structure — `AcademicSession` (e.g. "2026-2027") →
  `Class` (per campus+session, e.g. "Grade 3") → `Section` (e.g. "3A", with one
  `classTeacherId`). `Subject` is currently global (school-wide unique name), not scoped to a
  class — the same `Subject` row is reused across every Class/Section via `Timetable`,
  `DiaryEntry`, and `Assessment`.
- **Teacher↔Subject/Class support**: exists only implicitly — a teacher becomes "associated" with
  a subject/section by having `Timetable` rows referencing them, or by being a `Section`'s
  `classTeacherId`. There is no `TeacherSubject` or `TeacherClass` assignment model independent of
  the timetable, so "which subjects can this teacher teach" (as opposed to "what are they
  scheduled to teach this term") isn't representable today.
- **Missing information**: none critical for Phase 2's stated scope beyond the Teacher↔Subject
  assignment gap already noted under Teacher.
- **Migration considerations**: low risk — these models are stable and heavily depended-on
  (Timetable, Assessment, Diary, Application all FK into Class/Section/Subject/AcademicSession
  already); any change here has the widest blast radius of anything in this audit and should be
  additive only.

## Auth / User relationship confirmation

`User` (`schema.prisma:52-91`) is the sole authentication identity. `Teacher` and `ParentProfile`
are each a strict 1:1 domain profile hanging off a `User` row (`userId @unique`). `Student` has
**no** relation to `User` at all — students never log in; only their linked parents do (confirmed:
no `Student` reference anywhere under `backend/src/auth/`). `SCHOOL_ADMIN`/`ACCOUNTS`/
`SUPER_ADMIN` users have no domain profile row at all — the `Role` enum value on `User` alone
drives RBAC for those. This matters for Phase 2: any new "Student portal login" or "Student
document self-upload" feature would be a genuinely new capability (a first `User`↔`Student` link),
not an extension of an existing pattern.

## Cross-cutting observations

1. **Applicant/Application ↔ Student/ParentProfile boundary is the single biggest open
   design question for Phase 2.** Today `Applicant` and `ParentProfile` are two unconnected
   normalized-looking entities that happen to store overlapping information (guardian identity)
   with zero FK relationship, and the approval flow silently discards the applicant's captured
   guardian info rather than reusing it. Any redesign of Admission needs to explicitly decide:
   does `Applicant` become (or link to) a `Student`+`ParentProfile` pair on approval with data
   carried forward automatically, or does intake stay a deliberately separate, disposable record?
2. **No generic per-person Address model exists.** No model has an address field at all today
   (not Student, not ParentProfile, not Teacher, not Applicant) — this is a clean-slate addition,
   not a migration of existing flat columns.
3. **A generic, reusable Document model does not exist, but the building block for one
   (`File`) already does and is well-designed for reuse.** `File`
   (`schema.prisma:505-515`) is already storage-agnostic (`storageKey`/`originalName`/`mimeType`/
   `sizeBytes`) and already supports "one File, many kinds of owner" via separate join models
   (`DiaryAttachment`, `CircularAttachment`, and a direct `ReportCard.fileId`). `FilesAccessService`
   already centralizes access control per file. Extending document support to Student/Parent/
   Teacher/Application should mean adding new join models (e.g. `StudentDocument`,
   `ApplicationDocument`) that point at `File` plus type/verification metadata — not
   rebuilding file storage, and not adding per-entity file columns (which the brief also
   explicitly warns against).
4. **No relationship-type enum anywhere yet** — `StudentParent.relationship` and
   `Application.status` are both free-text strings today (only `EnrollmentStatus` and
   `AttendanceStatus` are real Prisma enums). Converting either to an enum is safe (values seen in
   code/seed are a small closed set) but needs a data check against any deployed environment
   before the `ALTER COLUMN ... TYPE` migration, in case production has values outside what's
   visible in this repo.
5. **The schema's own migration history is the best evidence for how Phase 3 should proceed**:
   every migration so far is additive (new tables, or new nullable-then-backfilled columns on
   existing tables) — there is no precedent of, and no need to introduce, a destructive rewrite.
6. **Naming quirk, not a data-model problem**: `backend/src/teacher/` (singular, full CRUD) and
   `backend/src/teachers/` (plural, one read-only listing endpoint for the Timetable picker) are
   two different modules that both compile against `Teacher`. Not a duplication of the *model*,
   but worth flagging so Phase 3 work lands in the right module.
