> **ARCHIVED 2026-09-20** — Superseded by docs/database/DATA-MODEL.md and MIGRATIONS.md (lagged the 57-model schema). Do not treat as current documentation.

# Migration Plan (Phase 2/3)

Companion to `docs/database/data-model-design.md`. Covers how each sub-project's schema changes get
applied without losing or breaking existing data. Updated incrementally as each sub-project lands.

## Overall strategy (applies to every sub-project)

1. **Additive only.** Every migration in this plan either creates a new table or adds a
   nullable/defaulted column to an existing one. None renames, retypes-destructively, or drops an
   existing column or table. This matches the six migrations already in
   `backend/prisma/migrations/` (confirmed in the audit) — the project has never done a destructive
   schema change, and this plan doesn't start now.
2. **No `prisma migrate reset`, ever.** Migrations are created with `prisma migrate dev
   --create-only` (review the generated SQL before applying) or authored by hand when a backfill
   step needs to run between DDL statements, then applied with `prisma migrate deploy`.
3. **Nullable-first for new required-looking fields.** Where the brief implies a field "should"
   eventually be required (e.g. a student's date of birth), it launches nullable. Enforcing
   `NOT NULL` later is a separate, explicit follow-up migration once real data has been backfilled —
   never bundled into the same migration that introduces the column. (This mirrors migration
   `20260912130140_teacher_campus_user_school_id`, which added `Teacher.campusId` as required only
   after backfilling existing rows in the same migration script — the one precedent in this repo for
   a required column, and it still didn't lose data.)
4. **Seed data updated alongside, not separately.** Each sub-project's implementation step updates
   `backend/prisma/seed.ts` to populate its new fields/models for the existing 3 seeded students /
   2 seeded parents / 3 seeded teachers, so local dev data stays representative without needing a
   fresh migration.
5. **Verify after every migration**: `npx prisma validate`, `npx prisma migrate status`, then the
   existing backend test suite (unit + e2e) to confirm auth/student/parent/teacher/admission flows
   that predate this work still pass.

## Sub-project 1 — Shared foundation + Student

### Migration(s)

One migration, `add_student_profile_and_documents` (name finalized at generation time), containing:

- `CREATE TABLE "Address" (...)`
- `CREATE TABLE "StudentPreviousSchool" (...)` with FK → `Student`, `Address`
- `CREATE TABLE "StudentEmergencyContact" (...)` with FK → `Student`, `Address`
- `CREATE TABLE "StudentMedicalInfo" (...)` with FK → `Student`
- `CREATE TABLE "StudentDocument" (...)` with FK → `Student`, `File`, `User`
- `CREATE TYPE "Gender" AS ENUM (...)`, `"BloodGroup"`, `"StudentStatus"`, `"DocumentType"`,
  `"DocumentVerificationStatus"`
- `ALTER TABLE "Student" ADD COLUMN` for every new column in the design doc — all nullable, or
  `status` with a `DEFAULT 'ACTIVE'`
- `ALTER TABLE "Enrollment" ADD COLUMN "rollNumber"`, `"promotionDate"`, `"remarks"` — all nullable
- Unique index on `Student.bFormNumber` (nullable-unique — safe, Postgres allows multiple NULLs)

No backfill script needed: every new column is nullable or has a default, and every new table
starts empty.

### Existing-data impact

- 3 seeded students, 2 seeded parents (unaffected — this sub-project doesn't touch ParentProfile),
  3 seeded teachers (unaffected) — all remain valid with all-NULL new columns until the seed script
  is updated to populate representative values.
- No existing FK, unique constraint, or index is altered.
- `EnrollmentService.getEnrollmentForDate()` and every other Enrollment consumer keeps working —
  `rollNumber`/`promotionDate`/`remarks` are read-if-present, not required by any existing query.

### Rollback note

Since every change is additive, rollback (if ever needed before this ships) is
`prisma migrate resolve --rolled-back` for this one migration plus a manual `DROP TABLE`/`DROP
COLUMN` pass — no data would be lost by rolling back, since nothing pre-existing was altered.

### Verification checklist for this sub-project

- [x] `npx prisma validate`
- [x] `npx prisma migrate dev` applies cleanly against local dev DB
- [x] Existing backend unit suite passes unmodified (confirms Student/Enrollment consumers
      untouched) — no e2e suite exists for Student today (confirmed in the audit), so this landed
      as unit coverage only; e2e remains a fast-follow, not a regression
- [x] Updated seed script populates the new fields/models for one representative seeded student
- [x] New DTOs/endpoints (`StudentProfileController`/`StudentProfileService`, Sub-project 1)
      validated with new unit tests (27 cases across profile/enrollment/previous-school/
      emergency-contacts/medical-info/documents)
- [ ] Staff-console Student forms updated to expose the new sections without breaking existing
      Add/Edit flows — deferred to Sub-project 1B (UI), not yet started

---

## Sub-project 3 — Staff & Hiring

### Migration(s)

One migration, `add_staff_and_hiring` (name finalized at generation time), containing:

- `CREATE TYPE "EmployeeType" AS ENUM (...)`, `"EmploymentStatus"` — `DocumentType`/
  `DocumentVerificationStatus` already exist from Sub-project 1 and are reused as-is.
- `CREATE TABLE "Staff" (...)` with FK → `User` (nullable), `Campus`, `File` (nullable),
  `Address` ×2 (nullable, named relations), `Teacher` (nullable)
- `CREATE TABLE "StaffEmergencyContact" (...)` with FK → `Staff`, `Address`
- `CREATE TABLE "StaffExperience" (...)` with FK → `Staff`
- `CREATE TABLE "StaffDocument" (...)` with FK → `Staff`, `File`, `User`
- `CREATE TABLE "HiringCandidate" (...)` with FK → `File` (nullable, résumé)
- `CREATE TABLE "HiringApplication" (...)` with FK → `HiringCandidate`, `Campus`, `User`
  (`reviewedById`, nullable), `Staff` (`createdStaffId`, nullable unique)
- Unique indexes: `Staff.userId`, `Staff.teacherId`, `Staff.cnic`,
  `HiringApplication.createdStaffId`

**No `ALTER TABLE` against any existing table** — this is the key difference from Sub-project 1's
migration. `Teacher`, `Campus`, `File`, `User`, and `Address` all gain only virtual Prisma
back-relations, which Prisma resolves without any DDL. Confirm this by diffing the generated SQL:
it must contain zero `ALTER TABLE "Teacher"`, `ALTER TABLE "Campus"`, `ALTER TABLE "File"`,
`ALTER TABLE "User"`, or `ALTER TABLE "Address"` statements — if `prisma migrate dev
--create-only` emits any of those, stop and re-check the schema for an accidentally-required
field or a relation declared on the wrong side.

No backfill script needed: every new table starts empty, and nothing existing changes shape.

### Existing-data impact

- 3 seeded teachers — completely unaffected; `Teacher` gains no column, so every existing
  `Teacher` row is valid with no corresponding `Staff` row. (Whether to backfill a `Staff` wrapper
  row per existing `Teacher` — so the staff-console's future "all staff" list shows pre-existing
  teachers too — is a **product decision, not a migration requirement**; flagged here as an open
  question for whoever implements this plan, not resolved by this design.)
- No existing FK, unique constraint, or index on any pre-existing table is altered.
- Every file in the 27-backend/20-frontend "references Teacher" set (enumerated in the design
  doc) needs zero changes for this migration to apply cleanly.

### Rollback note

Same as Sub-project 1: fully additive, so rollback is `prisma migrate resolve --rolled-back` for
this one migration plus a manual `DROP TABLE` pass for the 6 new tables — no pre-existing data can
be lost, since nothing pre-existing was altered.

### Verification checklist for this sub-project

- [x] `npx prisma validate`
- [x] `npx prisma migrate dev` applies cleanly against local dev DB
- [x] Generated migration SQL contains zero `ALTER TABLE` statements against `Teacher`/`Campus`/
      `File`/`User`/`Address` (see above — this is the load-bearing check for this sub-project)
- [x] Existing backend unit suite passes unmodified (confirms `Teacher`/`Timetable`/`Section`/
      `Attendance` consumers genuinely untouched)
- [x] Seed script updated to add at least one `Staff` row per `employeeType` (including one linked
      to an existing seeded `Teacher` via `teacherId`, and one `HiringCandidate` +
      `HiringApplication` pair in each pipeline stage) for representative local dev data
- [x] New `StaffProfileController`/`StaffProfileService` and
      `HiringCandidatesController`/`HiringApplicationsController` validated with new unit tests,
      matching Sub-project 1's per-endpoint coverage depth
- [x] Staff-console UI (Staff profile page, Hiring queue/intake/review pages) — a separate
      follow-on UI implementation plan, matching how Sub-project 1B followed Sub-project 1

---

*(Parent, and Admission sub-project migration plans are appended here as each is designed.)*
