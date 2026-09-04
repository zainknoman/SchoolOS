# Org Structure CRUD (School, Campus, AcademicSession, Class, Section) + Dashboard Live Data

Status: approved, ready for implementation planning.
Spec source: none in `plan/docs/FEATURES.txt` — this is not an original MVP feature, it's
back-office tooling requested directly: "remove hard coded mock data from all app, and create CRUD
for Students, Parents, Teachers, Classes etc." That request was decomposed (with the user, during
brainstorming) into two sub-projects by dependency order:

1. **This spec — Org Structure CRUD**: School, Campus, AcademicSession, Class, Section. Simple
   reference data; almost everything else in the app already depends on these existing.
2. **Later, separate spec — People CRUD**: Student, Teacher, Parent, and the Student↔Section
   (Enrollment) link. Deliberately deferred — it depends on Org Structure existing, and involves a
   harder design question (creating a Student/Teacher/Parent also means creating a `User` login
   account: password handling, role assignment) that deserves its own brainstorming pass rather than
   being bolted onto this one.

## Goal

- Give `SUPER_ADMIN` a real admin UI to create/edit/delete the org hierarchy (School → Campus →
  AcademicSession/Class → Section) instead of the current state, where every one of these 9 rows in
  a fresh dev database exists **only** because `backend/prisma/seed.ts` hardcodes them — there is no
  path to create a second campus, retire an academic session, add a class, or add a section without
  editing the seed script and re-seeding.
- Close a real, previously-flagged data-safety gap while building real Delete buttons for the first
  time: `Section → Timetable/DiaryEntry/Circular` still cascade-deletes silently.
- Replace the Admin dashboard's hardcoded mock numbers (`staff-console/src/lib/mockDashboard.ts`)
  with real aggregate queries, where a real number honestly exists to show.

## Audit findings (context for the fixes below)

A full-repo audit (see conversation history, not repeated here) found exactly one remaining
leftover-mock-data file: `staff-console/src/lib/mockDashboard.ts`, consumed by
`staff-console/src/views/AdminHomeView.vue`. Nothing else in the app (parent-app included) has
hardcoded data standing in for a real API response — the `StubPaymentGatewayAdapter` looks similar
at a glance but is an intentional swappable-adapter pattern (matching `PushAdapter`/`StorageAdapter`
from earlier sprints), not mock data.

The same audit confirmed the CRUD gap precisely — current backend routes, before this spec:

| Entity | Existing routes | Staff-console UI |
|---|---|---|
| School | none | none |
| Campus | none | none |
| AcademicSession | none | none |
| Class | none | none |
| Section | `GET /api/v1/sections`, `GET /api/v1/sections/:id/students` | none (read-only picker) |

## Data model

No new tables. Every field these entities need already exists in `schema.prisma`:

```
School           { id, name, campuses[] }
Campus           { id, schoolId, name, classes[], enrollments[] }
AcademicSession  { id, label, startDate, endDate, isActive, classes[], feeVouchers[], enrollments[] }
Class            { id, campusId, academicSessionId, name, sections[] }
Section          { id, classId, name, classTeacherId?, enrollments[], timetables[], diaryEntries[], circulars[] }
```

**One migration, three-line change** — the previously-flagged cascade-delete gap
(`PROJECT-STATUS.md`, Sprint 6.5 follow-ups: "`Section/Class/Campus → Timetable/DiaryEntry/Circular`
are still `onDelete: Cascade`... revisit before a second school/campus is onboarded"). Re-reading the
actual schema, the blast radius is narrower than that note implies: only three relations key
directly off `Section` into these three tables, and nothing above `Section` (`Class → Section`,
`Campus → Class`, `School → Campus`) needs to change, because a `Restrict` at the `Section` level
blocks the *entire* cascade chain above it — deleting a `Class` cascades to deleting its `Section`s,
and that inner delete is what a `Restrict` on `Section`'s own children stops, regardless of whether
the delete was direct or cascaded from a parent. Flip exactly these three, from `Cascade` to
`Restrict`, matching the precedent already set for `Student → Attendance/FeeVoucher/LeaveRequest`:

- `Timetable.section` (`schema.prisma:245`)
- `DiaryEntry.section` (`schema.prisma:279`)
- `Circular.section` (`schema.prisma:310`, nullable FK — `Restrict` only blocks deletion when a
  `Circular` actually has this `Section` set; school-wide circulars with `sectionId: null` are
  unaffected)

`Enrollment → Campus/Section/AcademicSession` are *already* `Restrict` (set in Sprint 6.5) — deleting
a Campus/Section/AcademicSession that has active enrollments is already safely blocked today, no
change needed there.

**`AcademicSession.isActive` invariant**: the app already assumes exactly one `isActive: true` row
at all times (`FeeVouchersService.issue` resolves "the active session" this way, per the Fees spec).
Creating or updating a session with `isActive: true` deactivates whichever session was previously
active, inside one `$transaction` — the UI never has to manage this as a separate step.

## Backend API

One dedicated NestJS module per entity, matching this codebase's existing convention (`sections/`,
`subjects/`, `teachers/` are already separate single-entity modules, not grouped) — every route
`@Roles('SUPER_ADMIN')`, every write audit-logged (`action`, `entity`, `entityId`), matching every
prior module. Every `DELETE` returns a clear `400` naming what still depends on the row (via Prisma's
`P2003` foreign-key-constraint error, caught and translated to a message like "Cannot delete this
Campus: 2 classes still reference it") instead of a raw 500.

- **`backend/src/school/`** (new): `POST/GET/PATCH/DELETE /api/v1/schools[/:id]`. In practice only
  one row will ever exist (single-school system, unchanged this sprint) but full CRUD is built
  anyway, per explicit decision — no artificial "exactly one row" constraint in the API itself.
- **`backend/src/campus/`** (new): `POST/GET/PATCH/DELETE /api/v1/campuses[/:id]`. Create/update take
  `{ schoolId, name }`.
- **`backend/src/academic-session/`** (new): `POST/GET/PATCH/DELETE /api/v1/academic-sessions[/:id]`.
  Create/update take `{ label, startDate, endDate, isActive }`; the single-active-session transaction
  described above lives here.
- **`backend/src/class/`** (new): `POST/GET/PATCH/DELETE /api/v1/classes[/:id]`. Create/update take
  `{ campusId, academicSessionId, name }`.
- **`backend/src/sections/`** (extend existing module): add `POST/PATCH/DELETE /api/v1/sections[/:id]`
  alongside the existing `GET` routes. Create/update take `{ classId, name, classTeacherId? }`
  (`classTeacherId` optional, matching the schema's nullable FK — picker sourced from the existing
  `GET /api/v1/teachers`).

Every list endpoint returns entities nested with their parent's display name (matching
`SectionSummary`'s existing `{ id, name, className, campusName }` shape) so the staff-console tables
don't need N+1 lookups — e.g. `ClassSummary = { id, name, campusName, academicSessionLabel }`.

## Client UI (staff-console only — no parent-app surface, this is admin-only data)

Five bespoke screens, one per entity, following `TimetableView.vue`'s established pattern (the
richest existing precedent: table + inline add-form + inline edit-row + delete-with-confirmation) —
not `FeeManagementView.vue`'s simpler create+list-only pattern, since these genuinely need
edit/delete, not just create+view. Per the explicit decision against a shared generic CRUD
component: each screen is its own file, independently readable, matching how every other admin
screen in this app was built.

- `staff-console/src/views/SchoolManagementView.vue` — `/admin/schools`
- `staff-console/src/views/CampusManagementView.vue` — `/admin/campuses`
- `staff-console/src/views/AcademicSessionManagementView.vue` — `/admin/academic-sessions`
- `staff-console/src/views/ClassManagementView.vue` — `/admin/classes`
- `staff-console/src/views/SectionManagementView.vue` — `/admin/sections` (new — the existing
  `SectionsService`/`SectionsController` back it, but no UI has existed for it until now)

Each wrapped in its own `*PageView.vue` → `<AppShell>` thin wrapper from the first commit (the
Sprint 9-10 AppShell-bypass regression is fresh enough to actively guard against here, not
discovered again after the fact) and routed with `meta: { requiresRole: ['SUPER_ADMIN'] }`.
`AppShell.vue` gains one new nav group ("Org Structure", five links) visible only to `SUPER_ADMIN`
(mirroring `canManageLeave`'s pattern — a role-gated `computed`, not a blanket `isAdmin` check that
would also show it to `SCHOOL_ADMIN`/`ACCOUNTS`).

Delete confirmation is a real modal/dialog naming what will be affected (row counts of direct
children — e.g. "This Class has 3 sections. Delete anyway?"), not a bare `window.confirm`.

## Dashboard live data (`AdminHomeView.vue`)

`mockDashboard.ts` is deleted. New endpoint: `GET /api/v1/admin/dashboard-summary`
(`backend/src/dashboard/` — new module, `@Roles('SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN')`, this one
is NOT `SUPER_ADMIN`-only since the dashboard itself already isn't).

Not every mocked field maps to something real. Decision made here (flagged explicitly for review,
not silently assumed): keep only what's honestly computable from data that already exists; cut what
would require inventing a new feature or business rule that's out of this spec's scope.

**Kept, computed from real data:**
- `studentsTotal` — count of `ACTIVE` enrollments in the current `isActive` `AcademicSession`.
- `presentTodayPercent` / `absentToday` — real query over today's `Attendance` rows across all
  sections (same status categories the existing per-student attendance summary already uses).
- `feesCollectedPkr` — `SUM(FeePayment.amount)` where `status: 'completed'`, this calendar month.
- `feesOutstandingPkr` — `SUM(amountDue)` across all vouchers where `amountDue > 0` (same computation
  `FeeVouchersService` already does per-voucher, aggregated).
- `weeklyTrend` — `attendancePercent` and `feesCollectedPkr` per day, last 7 days, both from real
  `Attendance`/`FeePayment` rows.

**Cut, no real backing exists today:**
- `atRiskStudents` — no "at risk" criteria is defined anywhere in this app. Inventing one (e.g.
  "3+ absences this month") would be a new business rule, not a mock-data fix — out of scope here.
- `teachersAbsent` — `Attendance` only tracks students; there is no teacher-attendance feature at
  all. Same reasoning.

**Replaced, not cut** — `recentAlerts` (previously synthetic sentences like "12 students absent 3+
days," "Exam marks pending for 2 classes" — the latter referencing a feature, exam marks, that does
not exist and is explicitly deferred to "Release 2+" per `PROJECT-STATUS.md`) becomes the 5 most
recent real rows from the existing `Notification` model (already populated by Diary/Circulars/
Messages/Fees/Leave — a real, already-flowing signal, not invented).

## Testing & rollout

Same rigor as every prior sprint, TDD throughout:
- Backend: one `*.service.spec.ts` per new/extended service (mocked `PrismaService`), covering the
  `SUPER_ADMIN`-only guard, the new `Restrict`-delete behavior (a Section with Timetable/Diary/
  Circular rows can't be deleted; one without can), and the single-active-`AcademicSession`
  transaction. E2e tests for the authorization boundary (non-`SUPER_ADMIN` blocked on every write
  route) and one full create→edit→delete-blocked→delete-succeeds flow per entity.
- Staff-console: component specs per new view (create/edit/delete happy paths, delete-blocked error
  surfaced from the backend's 400).
- `prisma/seed.ts` is unchanged — it already creates one of everything; these screens make more of
  the same, they don't replace how the dev database gets its baseline data.
