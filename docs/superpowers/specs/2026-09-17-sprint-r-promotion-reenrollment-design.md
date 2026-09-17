# Sprint R — Student Promotion / Re-Enrollment — Design Spec

**Status: un-deferred 2026-09-17.** `MASTER-PROMPT-TRACKER.md` (Deferred Features, Section 14) and
`docs/Plan-Ideas/PHASE-1/SchoolPortal-PostMVP-Roadmap-2026-09-08.md` (§13 Defer) both listed
"promotion/re-enrollment" as intentionally out of scope for the MVP. The project owner explicitly
requested un-deferring it now that the build is past MVP and moving into a Production-Ready phase
(see `PROJECT-STATUS.md`'s Phase note and `MASTER-PROMPT-TRACKER.md`'s Production-Ready Backlog
section, both added the same day as this spec). This document designs the feature; the accompanying
plan (`docs/superpowers/plans/2026-09-17-sprint-r-promotion-reenrollment.md`) breaks it into
bite-sized TDD tasks.

## Problem

`Student.update()` and `StudentProfileController.patchCurrentEnrollment` both explicitly document
"no re-enrollment/transfer workflow exists yet" as a deliberate, tracked gap since Sprint 6.5. There
is no way today to move a student from one `AcademicSession` to the next without either (a) manually
editing the existing `Enrollment` row in place — which would retroactively corrupt every historical
query that reads "which section was this student in on date X" (`EnrollmentService.getEnrollmentForDate`,
used by Diary/Timetable), the exact bug `Enrollment` was introduced in Sprint 6.5 to prevent — or (b)
creating a second `Enrollment` row by hand with no validation, no closure of the old one, and no
record of *why* the change happened.

## Non-goals (explicitly out of scope for this sprint)

- **Staff/Teacher assignment history** (`StaffAssignment`/`TeachingAssignment`) — no staff-transfer
  feature exists yet to protect; building history infrastructure for a feature nobody can trigger is
  premature. Revisit if/when a real staff-transfer request lands (already flagged as a **Sprint O**
  follow-up consideration in `PROJECT-STATUS.md`'s "Teacher Subject/Class Assignment Scoping" section
  for the closely-related non-`ACTIVE`-enrollment staff-access gap — same "wait for a real trigger"
  reasoning applies here).
- **Auto-inferred "next grade."** `Class.name` is a freeform string (`"Grade 3"`) with no numeric
  order field, and `Class` rows are already re-created per `AcademicSession` (a new `Class`/`Section`
  set is created for each session today via the existing Class/Section CRUD — confirmed in
  `backend/src/class/`, `backend/src/sections/`). Rather than add a fragile name-parsing "successor
  grade" inference (or a new ordering field to `Class` that nothing else needs yet), promotion is a
  **staff-driven decision**: the admin explicitly picks the target `Section` (in the target session)
  per student, or bulk-assigns one target section to a whole source section. This matches the
  existing manual Class/Section creation workflow and needs no schema change to `Class`.
- **Mid-year section transfer UI.** `EnrollmentStatus.TRANSFERRED` already exists in the schema but
  nothing sets it yet. This sprint uses it (for a student leaving to a different institution) but does
  not build a general "move this student to a different section, same session" screen — that's a
  narrower, separate feature or could fold into a later sprint.
- **Fee installment / EMI implications of promotion** — `docs/Plan-Ideas/.../PostMVP-Roadmap`'s
  Sprint O already carries "EMI-style fee installments" as its own undecided scope line; not
  duplicated here.

## Data model changes

### 1. `EnrollmentStatus` enum — add `WITHDRAWN`

```prisma
enum EnrollmentStatus {
  ACTIVE
  TRANSFERRED
  COMPLETED
  WITHDRAWN   // new
}
```

Existing values are unchanged in meaning: `ACTIVE` (current placement), `COMPLETED` (session ended
normally — promoted, retained, or graduated), `TRANSFERRED` (closed because the student left for
another institution — newly wired up by this sprint, the enum value already existed but nothing set
it). `WITHDRAWN` is new: closed because the student withdrew from the school entirely (distinct from
`TRANSFERRED` for reporting — "left for another school" vs "left, destination unknown/none").

### 2. New enum `PromotionDecision`

```prisma
enum PromotionDecision {
  PROMOTED
  RETAINED
  TRANSFERRED_OUT
  GRADUATED
  WITHDRAWN
}
```

Maps to both the closed `Enrollment.status` and (for the three terminal decisions) `Student.status`:

| Decision | Old enrollment closed as | New enrollment created? | `Student.status` set to |
|---|---|---|---|
| `PROMOTED` | `COMPLETED` | Yes (next session, target section) | unchanged (`ACTIVE`) |
| `RETAINED` | `COMPLETED` | Yes (next session, target section — may be the "same grade" section) | unchanged (`ACTIVE`) |
| `TRANSFERRED_OUT` | `TRANSFERRED` | No | `LEFT` |
| `GRADUATED` | `COMPLETED` | No | `GRADUATED` |
| `WITHDRAWN` | `WITHDRAWN` | No | `WITHDRAWN` |

### 3. New model `StudentPromotion`

The audit trail Prompt 2 asked for — one row per student per promotion-batch execution.

```prisma
model StudentPromotion {
  id               String            @id @default(uuid())
  studentId        String
  student          Student           @relation(fields: [studentId], references: [id], onDelete: Cascade)
  fromEnrollmentId String            @unique
  fromEnrollment   Enrollment        @relation("PromotionFromEnrollment", fields: [fromEnrollmentId], references: [id], onDelete: Restrict)
  toEnrollmentId   String?           @unique
  toEnrollment     Enrollment?       @relation("PromotionToEnrollment", fields: [toEnrollmentId], references: [id], onDelete: Restrict)
  decision         PromotionDecision
  remarks          String?
  decidedById      String
  decidedBy        User              @relation(fields: [decidedById], references: [id])
  decidedAt        DateTime          @default(now())

  @@index([studentId])
}
```

`toEnrollmentId` is nullable — `TRANSFERRED_OUT`/`GRADUATED`/`WITHDRAWN` create no next enrollment.
`fromEnrollmentId`/`toEnrollmentId` are each `@unique`: an enrollment can be the source or target of
at most one promotion decision, which is exactly the "never overwrite, always a new historical row"
invariant this feature exists to enforce — attempting to promote the same enrollment twice is a
unique-constraint violation, not a silent double-write.

`Enrollment` gains two back-relations (`promotedFrom StudentPromotion? @relation("PromotionFromEnrollment")`,
`promotedTo StudentPromotion? @relation("PromotionToEnrollment")`); `Student` gains
`promotions StudentPromotion[]`; `User` gains `promotionsDecided StudentPromotion[]`.

## API design

New module `backend/src/promotions/` (mirrors the existing `leave/`, `hiring/` module shape —
controller + service + DTOs, one Prisma migration).

### `GET /api/v1/promotions/preview`

Query: `sourceSectionId`, `targetAcademicSessionId`. `SCHOOL_ADMIN`/`SUPER_ADMIN` only (`ACCOUNTS`
has no business decision here, matching the existing People-CRUD role split).

Returns every student with an `ACTIVE` enrollment in `sourceSectionId`, each with:
`{ studentId, name, grNumber, currentRollNumber, suggestedDecision: 'PROMOTED' }` — a default
suggestion, not a commitment; the admin can override per row before executing. Scoped: for
`SCHOOL_ADMIN`/`ACCOUNTS`, `sourceSectionId`'s campus must belong to the caller's own `schoolId`
(reuse the `assertValidReferences`/tenant-check pattern `CampusService.list()` established in
Sprint L), else 403/404 per that pattern's existing convention.

### `POST /api/v1/promotions/execute`

`SCHOOL_ADMIN`/`SUPER_ADMIN` only. Body:

```ts
{
  sourceAcademicSessionId: string;
  targetAcademicSessionId: string;
  decisions: Array<{
    studentId: string;
    decision: 'PROMOTED' | 'RETAINED' | 'TRANSFERRED_OUT' | 'GRADUATED' | 'WITHDRAWN';
    targetSectionId?: string; // required iff decision is PROMOTED or RETAINED
    rollNumber?: string;
    remarks?: string;
  }>;
}
```

One `$transaction` for the whole batch — all-or-nothing, matching `LeaveService.approve()`'s and
`FeePaymentsService.confirm()`'s established "validate everything, then write everything" pattern in
this codebase. Per-item validation before any write:

- The student's current enrollment must be `ACTIVE` and in `sourceAcademicSessionId` — otherwise this
  is a stale preview or a duplicate execute; reject the whole batch with a 400 naming the offending
  `studentId` (all-or-nothing, not partial-success-with-a-report — simpler to reason about and
  matches this codebase's existing all-or-nothing batch convention, there being no precedent yet for
  a partial-success batch endpoint).
- `targetSectionId` required and validated (exists, belongs to a `Class` whose `academicSessionId`
  matches `targetAcademicSessionId`) when `decision` is `PROMOTED` or `RETAINED`; rejected as a 400 if
  supplied for any other decision or missing when required.
- Tenant scoping: for `SCHOOL_ADMIN`/`ACCOUNTS`, every `studentId`'s current section and every
  `targetSectionId` must resolve to the caller's own `schoolId`.

For each item: close the old `Enrollment` (`status`, `endDate: now`), optionally create the new one
(`ACTIVE`, `startDate: targetAcademicSession.startDate`), optionally update `Student.status`/
`leavingDate`/`leavingReason`, create the `StudentPromotion` row, write one `AuditLog` row per
student (`action: 'promotion.execute'`, matching the existing per-write audit convention).

### `GET /api/v1/students/:id/promotion-history`

Returns the student's `StudentPromotion` rows, newest first, each including the from/to enrollment's
section/class/academicSession labels — the "academic journey" view Prompt 2 asked for. Scoped via the
same `StudentAccessService` ownership check every other per-student read already uses (`PARENT` can
see their own child's; staff via the existing role-scoped rules).

## UI design (staff-console)

New `PromotionView.vue` (routed `/admin/promotions`, `SCHOOL_ADMIN`/`SUPER_ADMIN` only, wrapped in a
`PromotionPageView.vue` thin `AppShell` wrapper — following the established pattern every other admin
screen uses, closing off the exact "screen renders with no sidebar/logout" class of bug this codebase
has hit and fixed three separate times already, Sprints 5-6/9-10). Flow: pick a source
class/section + the (already-active) target academic session → table of students (reusing
`EntityTable.vue`) with a per-row decision `<select>` (`FormField`, default `PROMOTED`) and a
per-row target-section picker (disabled/cleared unless the decision is `PROMOTED`/`RETAINED`) plus a
"bulk-assign target section" control above the table → "Preview" is just rendering the already-fetched
data (no separate confirmation round-trip needed beyond the execute call itself) → "Execute" behind
the existing `useConfirm()` dialog, matching the codebase's established delete-guard convention for
any batch/irreversible action.

Student profile view (`docs/superpowers/plans/2026-09-14-student-profile-ui.md`'s staff-console
screen) gains a read-only "Academic History" panel listing `promotion-history` rows.

## Rollback / correction

No "undo" endpoint. If a promotion batch is executed in error, correcting it is a manual admin action
(close the erroneous new enrollment, reopen or re-create the prior one) — the same manual-correction
posture this codebase already takes for e.g. a wrong fee reconciliation. Automating rollback is not
justified at this scale; the `StudentPromotion` audit row means a human always has enough information
to correct it by hand.

## Testing

Backend: unit tests for `PromotionsService` (preview scoping, execute validation — stale-enrollment
rejection, missing/extra `targetSectionId`, tenant-boundary rejection, all-or-nothing transaction
behavior) and one e2e spec covering the full preview → execute → promotion-history round trip
against a real (test) Postgres database, plus a cross-tenant rejection case (mirroring
`cross-tenant-boundary.e2e-spec.ts`'s existing shape). Staff-console: `PromotionView.spec.ts`
following `LeaveManagementView.spec.ts`'s existing shape (list/decide/confirm/error-state pattern).
