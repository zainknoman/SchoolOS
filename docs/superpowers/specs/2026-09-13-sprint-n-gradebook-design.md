# Sprint N — Structured Gradebook (Phase 8, P1)

Status: approved (design), ready for implementation planning.
As of `main` post-Sprint-L (cross-tenant access control merged).
Spec source: `docs/Plan-Ideas/PHASE-1/SchoolPortal-PostMVP-Roadmap-2026-09-08.md`, Implementation
Checklist, Sprint N — "structured gradebook: subjects, weighted assessment categories
(assignments/quizzes/midterm/final), marks + max-marks entry, term, calculated final grade."

Design decisions locked with the user before this spec was written:
- **PDF report cards are kept as a fallback**, not superseded — the existing `report-cards` module
  ships untouched.
- **Assessment-category weighting is per-class**, shared across every subject in that class (not
  per-subject).
- **Terms** get their own model under `AcademicSession` (not a hardcoded term-number field).

## Reconciliation with the roadmap doc before scoping work

Verified directly against `build/backend/prisma/schema.prisma` and `backend/src/report-cards`.

- `ReportCard` (`schema.prisma:563-576`) is confirmed a single PDF pointer per
  `(studentId, academicSessionId)` — one row for the **whole academic year**, no term
  granularity anywhere in the current schema. Confirmed no `Term`/`Subject`-weighting/`Mark` model
  exists anywhere (`grep -n "^model" schema.prisma` — no hits beyond what's already catalogued in
  Sprint I's spec).
- `Subject` (`schema.prisma:175-182`) exists today only as a global, unscoped lookup table (`name`
  unique, referenced by `Timetable`/`DiaryEntry`) — it has no relationship to `Class` or
  `AcademicSession` at all. A per-class weighting scheme therefore does **not** need to touch
  `Subject`; weights attach to `Class` + `Term`, and `Assessment` rows reference `Subject`
  independently, exactly like `Timetable` already does.
- `Class` (`schema.prisma:143-156`) already carries `academicSessionId` — a `Term` naturally nests
  under `AcademicSession`, and an `AssessmentCategory`'s weighting scheme naturally nests under
  `Class` (which is itself already session-scoped), so no redundant session FK is needed on the new
  category/assessment tables.
- Teacher-access scoping for every existing student-linked module (`StudentAccessService`,
  `common/student-access.service.ts:52-67`) is **campus-scoped, not per-teacher-per-subject** — any
  `TEACHER` in the same campus as a section can already read/act on that section's Attendance/Diary/
  Timetable data. Marks-entry authorization in this spec follows the same precedent (see Decisions
  below) rather than inventing a tighter per-subject-assignment rule this codebase has no existing
  concept of.

## Decisions this spec makes so engineering doesn't have to guess

**`Term` nests under `AcademicSession`, not under `Class`.** A term ("Term 1", "Midterm", "Final")
is a school-wide calendar concept shared by every class in a session — modeling it once per session
(not once per class) avoids N duplicate `Term` rows per session and matches how `Class` already
references `AcademicSession` directly.

**`AssessmentCategory` weighting is scoped to `Class`, shared across every subject taught in that
class** (per the user's explicit choice) — e.g. Grade 3's "20% quizzes / 30% midterm / 50% final"
scheme applies identically whether the subject is Math or Urdu. An `Assessment` still records which
`Subject` it belongs to (so a Math quiz and an Urdu quiz are distinct rows with distinct marks), but
there is exactly one weighting configuration per `(classId, termId)`, not one per
`(classId, subjectId, termId)`. This is simpler to configure (one screen, not a grid) and matches
the majority real-world case for the target customer segment (single-campus to small-network K-12,
not a subject-specialized secondary/exam-board school).

**The final grade is always computed, never stored.** `GET /students/:id/grades?termId=` calculates
`Σ(category.weightPercent × student's average obtained% in that category)` on read, from `Mark`
rows, every time. No `finalGrade` column anywhere — this guarantees the number shown is never stale
relative to the marks it's derived from, at the cost of a query doing the aggregation instead of a
column read. Given expected per-class student counts (tens, not thousands) this is not a
performance concern at this project's target scale.

**Marks-entry authorization reuses `StudentAccessService.assertCanAccessSection` exactly as-is** —
any `TEACHER` in the section's campus (or `SCHOOL_ADMIN`/`ACCOUNTS`/`SUPER_ADMIN` per their existing
scope rules) can enter/edit marks for that section. This project has no existing concept of "this
teacher is specifically assigned to teach this subject to this section" (`Timetable.teacherId` is
the closest thing, and it's optional/nullable) — inventing a tighter rule here would be new,
unrequested scope. If a school wants tighter enforcement later, that's a follow-up, not this
sprint's problem to solve.

**Weight validation:** `AssessmentCategory` rows for a given `(classId, termId)` must sum to exactly
100% before any `Assessment`/`Mark` can be created against them — enforced in the service layer
(not the database, since Prisma/Postgres can't express a cross-row SUM constraint declaratively),
checked on every category create/update/delete for that `(classId, termId)` pair.

**Rounding:** marks are stored as `Float` (matching `AttendanceRiskFlag.absenceRate`'s existing
precedent for a non-monetary decimal value in this schema — fee amounts stay integer-paisa, this is
a different kind of number). The computed final percentage is rounded to one decimal place only at
the presentation layer (API response), never in storage.

## Design

### 1. New models

```prisma
model Term {
  id                String          @id @default(uuid())
  academicSessionId String
  academicSession   AcademicSession @relation(fields: [academicSessionId], references: [id], onDelete: Cascade)
  label             String // "Term 1", "Midterm", "Final"
  order             Int // display/sequence order within the session
  startDate         DateTime
  endDate           DateTime
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  @@unique([academicSessionId, label])
  @@index([academicSessionId])
}

model AssessmentCategory {
  id            String       @id @default(uuid())
  classId       String
  class         Class        @relation(fields: [classId], references: [id], onDelete: Cascade)
  termId        String
  term          Term         @relation(fields: [termId], references: [id], onDelete: Cascade)
  name          String // "Quizzes", "Midterm", "Final Exam"
  weightPercent Float
  assessments   Assessment[]
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  @@unique([classId, termId, name])
  @@index([classId, termId])
}

model Assessment {
  id                   String              @id @default(uuid())
  assessmentCategoryId String
  assessmentCategory   AssessmentCategory  @relation(fields: [assessmentCategoryId], references: [id], onDelete: Cascade)
  subjectId            String
  subject              Subject             @relation(fields: [subjectId], references: [id], onDelete: Restrict)
  label                String // "Quiz 2"
  maxMarks              Float
  marks                Mark[]
  createdAt             DateTime           @default(now())
  updatedAt             DateTime           @updatedAt

  @@index([assessmentCategoryId])
  @@index([subjectId])
}

model Mark {
  id            String     @id @default(uuid())
  assessmentId  String
  assessment    Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
  studentId     String
  student       Student    @relation(fields: [studentId], references: [id], onDelete: Cascade)
  obtainedMarks Float
  enteredById   String
  enteredBy     User       @relation(fields: [enteredById], references: [id])
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  @@unique([assessmentId, studentId])
  @@index([studentId])
}
```
Additive migration; no changes to any existing model. `Class`/`Student`/`Subject`/`AcademicSession`
each gain a back-relation array field (`terms`/`assessmentCategories`/`assessments`/`marks` as
appropriate) — standard Prisma two-sided relation bookkeeping, not a behavior change.

### 2. New `GradebookModule` (`backend/src/gradebook/`)

Following this codebase's one-module-per-bounded-context convention (`holidays`, `complaints`,
`report-cards`):
- `POST /api/v1/terms`, `PATCH /api/v1/terms/:id`, `DELETE /api/v1/terms/:id`, `GET
  /api/v1/terms?academicSessionId=` — `@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')` for writes, any
  authenticated role for the read (terms are not per-student PII, same reasoning as `Holiday`'s
  read scope in Sprint I).
- `POST /api/v1/assessment-categories`, `PATCH .../:id`, `DELETE .../:id` — same admin-only write
  roles. Service-layer validation: reject a create/update that would push the `(classId, termId)`
  category sum over 100%, and reject a delete that would leave existing `Assessment`/`Mark` rows
  orphaned under a category whose remaining siblings no longer sum to 100% (the delete itself is
  fine — the *inconsistent weight total* is what's flagged, as a warning surfaced to the caller via
  the response, not a hard block, since a school may legitimately be mid-edit adding a replacement
  category next).
- `POST /api/v1/assessments`, `PATCH .../:id`, `DELETE .../:id`, `GET
  /api/v1/assessments?assessmentCategoryId=` — `@Roles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')`,
  each write additionally checked via `StudentAccessService.assertCanAccessSection`-equivalent scope
  resolved from the assessment's class (a `TEACHER` may create an assessment only for a class in
  their own campus).
- `POST /api/v1/assessments/:id/marks` — body `{ marks: { studentId: string; obtainedMarks: number
  }[] }`, one round-trip for an entire section's marks on one assessment (mirrors
  `POST /attendance/bulk`'s exact shape from Sprint I — same "one call replaces N sequential calls"
  precedent). Rejects any `obtainedMarks > assessment.maxMarks` (400, naming the offending
  `studentId`) and any `studentId` not currently enrolled in the assessment's class/section.
  Upserts by `(assessmentId, studentId)`, one `$transaction`, one summarizing `AuditLog` row (not
  one per student) — same pattern as bulk attendance.
- `GET /api/v1/students/:id/grades?termId=` — scoped via
  `StudentAccessService.assertCanAccessStudent` (parents get their own child, staff get their
  campus). Computes and returns, per subject: each category's weighted contribution
  (`category.weightPercent × (Σ obtainedMarks / Σ maxMarks across that category's assessments for
  this student) `), and the summed final percentage across categories. A subject/category with zero
  entered marks contributes `0`, not `null` — a partially-graded term shows a real (if
  provisional) running total rather than an error.

### 3. `report-cards` integration (fallback, not replacement)

No change to the `report-cards` module or its schema. The parent-app/staff-console report-card
screens are extended (not replaced) to check `GET /students/:id/grades?termId=` first for the
active session's terms; if that endpoint returns categories with zero configured
`AssessmentCategory` rows for the relevant class/term (i.e. the school hasn't adopted structured
grading for that class yet), the screen falls back to rendering whatever `ReportCard` PDFs already
exist for that student/session exactly as today. Both sources can coexist for the same
student/session — this is a per-class adoption path, not an all-or-nothing cutover, matching the
"keep PDF as fallback" decision.

### 4. Vue (staff-console)

- New `TermsManagementView.vue` + `AssessmentCategoriesView.vue` (admin config, built on
  `EntityTable.vue`/`FormField.vue`/`ConfirmDialog.vue`, same ninth/tenth-CRUD-screen precedent
  Sprint I's Holiday screen set).
- New `MarksEntryView.vue` (teacher-facing): pick class/term/assessment → a grid, one row per
  enrolled student, one editable `obtainedMarks` cell → "Save all" calls the bulk marks endpoint
  once. Add a `nav-gradebook` link to the teacher nav group in `AppShell.vue`.
- Extend `ReportCardsView.vue`/`TeacherReportCardsView.vue` (admin/teacher) and whatever parent-facing
  view renders report cards to show a structured-grade table when `GET .../grades` returns non-empty
  categories, PDF list otherwise (Design §3).

### 5. Flutter (parent-app)

Extend `report_cards_screen.dart` the same way — render a structured per-subject grade table (term
picker, since a parent may want to see a past term) when available, fall back to the existing PDF
list when not.

## Testing

- e2e: category weights must sum to 100% before an assessment can be created against them; a
  category update/delete that breaks the 100% total is flagged in the response, not silently
  allowed to corrupt the computed grade.
- e2e: bulk marks entry rejects `obtainedMarks > maxMarks`; rejects a student not enrolled in the
  assessment's class; one call updates N students in one audit-logged transaction (mirrors the
  bulk-attendance test shape from Sprint I).
- e2e: `GET /students/:id/grades` computes the correct weighted percentage across two categories
  with partial marks entered in one and none in the other (the "zero contributes 0, not null or an
  error" case); a parent can read their own child's grades, not another parent's child (403);
  scoping mirrors the existing Attendance/Diary pattern exactly.
- e2e: a `TEACHER` outside the section's campus cannot create an assessment or enter marks for it
  (403, same `StudentAccessService` scope check every other module already proves).
- Component tests: `MarksEntryView.vue`'s grid renders one row per enrolled student and blocks
  "Save all" client-side when a cell exceeds `maxMarks` (defense in depth alongside the server
  check, not instead of it); `AssessmentCategoriesView.vue` surfaces a non-100%-total warning.

## Out of scope this sprint

- Per-subject weighting configuration (explicitly decided against — per-class only, this sprint).
- Migrating/backfilling any historical PDF report card into structured data — the two sources are
  independent going forward, no retroactive conversion.
- A tighter "only the teacher assigned to this subject/section" authorization rule — marks-entry
  uses the same campus-wide teacher scope every other module already uses.
- Report-card PDF generation *from* structured grades (e.g. a rendered PDF of the computed table) —
  the structured data is shown directly in-app; producing a downloadable PDF equivalent is a
  possible future enhancement, not this sprint's Definition of Done.
