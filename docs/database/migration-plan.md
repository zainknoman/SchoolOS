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

- [ ] `npx prisma validate`
- [ ] `npx prisma migrate dev` applies cleanly against local dev DB
- [ ] Existing backend unit + e2e suite passes unmodified (confirms Student/Enrollment consumers
      untouched)
- [ ] Updated seed script populates the new fields/models for all 3 seeded students
- [ ] New DTOs/endpoints (added in this sub-project's implementation step) validated with new unit
      + e2e tests
- [ ] Staff-console Student forms updated to expose the new sections without breaking existing
      Add/Edit flows

---

*(Parent, Teacher, and Admission sub-project migration plans are appended here as each is
designed.)*
