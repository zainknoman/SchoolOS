# People CRUD (Student, Teacher, Parent) Design

Status: approved, ready for implementation planning.
Spec source: none in `plan/docs/FEATURES.txt` — same as Org Structure CRUD, this is back-office
tooling requested directly, decomposed during brainstorming (see
`docs/superpowers/specs/2026-09-04-org-structure-crud-design.md`) into two sub-projects. This is
the second: Student, Teacher, Parent. Org Structure (School/Campus/AcademicSession/Class/Section)
already shipped and is a hard prerequisite — every Student needs a Section to enroll into.

## Goal

Give `SUPER_ADMIN`/`SCHOOL_ADMIN` real Create/Read/Update/Delete for the three "people" entities —
today, like every Org Structure entity before its own CRUD shipped, all three exist **only** via
`prisma/seed.ts`. Unlike Org Structure's plain reference-data rows, two of these three each carry a
required login (`User`) account, which is the harder design problem this spec exists to settle.

## Data model — what each entity actually needs (grounded against the current schema)

```
Student        { id, grNumber, name, parents: StudentParent[], enrollments: Enrollment[], ... }
Teacher        { id, userId (required, 1:1) -> User, name, ... }
ParentProfile  { id, userId (required, 1:1) -> User, name, phone?, children: StudentParent[] }
User           { id, identifier (unique — email or GR-number), passwordHash, role, isLocked, ... }
StudentParent  { studentId, parentProfileId, relationship (default "guardian") } — join table
Enrollment     { studentId, campusId, sectionId, academicSessionId, startDate, status } — dated
```

**Student has no login account at all** — no `userId` field, no `STUDENT` role exists in the `Role`
enum (`SUPER_ADMIN | SCHOOL_ADMIN | TEACHER | ACCOUNTS | PARENT`). Student CRUD is a pure
data-record problem: no password, no identifier, just name/GR-number plus its relations.

**Teacher and ParentProfile both require a `User`** (`userId String @unique`, non-optional
relation) — creating either one means creating a login account in the same operation, or the
profile row can never legally exist. This is genuinely new ground for this codebase:
`argon2.hash` is currently called from exactly one place in the entire source tree —
`prisma/seed.ts` — nowhere in application code creates a real login account today. This spec's
Teacher/Parent create paths are the first.

**Deletion is already governed by existing constraints, not something this spec invents:**
`Attendance.markedById → Teacher` has no `onDelete` specified on a required relation (Prisma/SQLite
default: blocks the delete) — any Teacher who has ever marked attendance can never be deleted, ever,
the same way `Student → Attendance/FeeVoucher/LeaveRequest` (`Restrict`, set in Sprint 6.5) already
blocks Student deletion once real history exists. This spec doesn't change any of that — it reuses
the exact `assertDeletable` helper (`backend/src/common/prisma-delete-guard.ts`, from Org Structure)
for every entity's `delete()`, same as every Org Structure entity does. No new migration needed.

## Decisions made during brainstorming (confirmed with the user)

1. **Role access:** `SUPER_ADMIN` and `SCHOOL_ADMIN` (not `ACCOUNTS`, not `TEACHER`) — day-to-day
   operational data, matches how Timetable/Circulars management is already scoped, unlike Org
   Structure's `SUPER_ADMIN`-only setup data.
2. **Password creation:** the admin types an initial password directly in the create form (no
   email/invite infrastructure exists anywhere in this codebase — matches this project's
   established pattern of not building infra it doesn't need yet, e.g. the stubbed payment
   gateway, the stubbed push adapter).
3. **Student creation is one combined form**, not three separate steps: creating a Student also
   creates its `Enrollment` (campus/section/session picker) and links a Parent (search existing,
   or create one inline) in the same operation — a Student is never left invisible everywhere
   (attendance, timetable, fees, and the parent app all key off an active Enrollment; the parent
   app additionally needs a linked Parent to show anything to anyone).
4. **Inline parent creation from the Student form** is supported — a "+ New Parent" toggle reveals
   the same name/identifier/password fields Parent CRUD's own create form uses, reusing the same
   backend create-logic (not a duplicate code path).
5. **Explicitly out of scope:** a real student-transfer workflow (mid-year section change with
   historically-correct Diary/Attendance resolution) — `PROJECT-STATUS.md`'s Sprint 6.5 follow-ups
   already flag this as a known, deliberately unbuilt future gap
   (`MeService.getChildrenForUser`/`EnrollmentService.getEnrollmentForDate` both assume it doesn't
   exist yet). This spec's Student "edit" only covers name/GR-number, not re-enrollment. Also out
   of scope: role reassignment or identifier changes on an existing Teacher/Parent account (that's
   effectively "create a different account," not an edit) — `update()` covers name/phone/password
   reset only.

## Backend API

Three new NestJS modules — `student/` (new), and extending the existing read-only `teachers/`/
adding a new `parent/` module — following the Org Structure precedent: `@Roles('SCHOOL_ADMIN',
'SUPER_ADMIN')` on every route, every write audit-logged (`entity.verb` action names), every
`delete()` using the existing `assertDeletable` helper unchanged.

**New shared helper — a companion to `assertDeletable` for the create side:**
```ts
// backend/src/common/prisma-create-guard.ts
// Translates a Prisma unique-constraint violation (P2002 — e.g. a duplicate User.identifier)
// into a clear 400 instead of a raw 500. Mirrors assertDeletable's shape exactly.
export function assertCreatable(error: unknown, message: string): never
```

**Teacher module** (`backend/src/teacher/`, new — singular, distinct from the existing
`backend/src/teachers/` module, plural, which stays exactly as-is: read-only `listAll()`, consumed
by Timetable's/Section's teacher pickers, untouched). Route path is namespaced under `/admin/` so
it can never collide with the existing `@Controller('api/v1/teachers')`'s picker endpoint, matching
the Dashboard module's own precedent (`@Controller('api/v1/admin')`) for admin-only surface area
that's logically distinct from an existing public-shaped route:
- `POST /api/v1/admin/teachers` — creates `User` (role `TEACHER`) + `Teacher` in one
  `$transaction`. Body: `{ identifier, password, name }`.
- `GET /api/v1/admin/teachers` — list, `{ id, identifier, name }` (the existing
  `GET /api/v1/teachers` stays plain `{ id, name }` for its pickers — untouched, this is a
  separate richer endpoint for the admin table, not a replacement).
- `PATCH /api/v1/admin/teachers/:id` — `{ name?, password? }` (password optional — a reset, not
  required every edit). `identifier`/role are not updatable (see decision 5).
- `DELETE /api/v1/admin/teachers/:id` — deletes `Teacher` then `User` in one `$transaction` (User
  has `onDelete: Cascade` from Teacher, so deleting `User` alone would work too, but deleting via
  `Teacher.delete` is the natural direction and lets `assertDeletable` catch the `Attendance`
  block cleanly).

**Parent module** (`backend/src/parent/`, new):
- `POST /api/v1/admin/parents` — creates `User` (role `PARENT`) + `ParentProfile` in one
  transaction. Body: `{ identifier, password, name, phone? }`.
- `GET /api/v1/admin/parents` — list, `{ id, identifier, name, phone, childrenCount }`.
- `PATCH /api/v1/admin/parents/:id` — `{ name?, phone?, password? }`.
- `DELETE /api/v1/admin/parents/:id` — same `Cascade`-then-`assertDeletable` shape as Teacher.
  A Parent with linked Students (`StudentParent`, `onDelete: Cascade` on both sides) can always be
  deleted — deleting a Parent only removes the *link*, never the Student itself. A Parent who has
  sent/received `Conversation`/`Message` rows (`onDelete: Cascade` from `User`) can also always be
  deleted. In practice Parent deletion is far less likely to be blocked than Teacher's.
- Exposes one more method reused by Student creation's inline-parent-creation path (see below) —
  same service method, not a separate code path, per decision 4.

**Student module** (`backend/src/student/`, new):
- `POST /api/v1/admin/students` — one `$transaction` creating: `Student`; its `Enrollment` (client
  supplies only `sectionId` — `campusId` is derived server-side from that section's
  `class.campus.id`, never separately client-supplied, so it's impossible to create an Enrollment
  whose `campusId` doesn't match its own `sectionId`; `academicSessionId` is likewise resolved
  server-side from the currently-active session, matching `FeeVouchersService.issue`'s existing
  precedent); and a `StudentParent` link — either to an existing `parentProfileId`, or (if the
  request instead carries `newParent: { identifier, password, name, phone? }`) a freshly created
  Parent via the exact same creation logic `ParentService.create()` uses, called from inside this
  same transaction.
- `GET /api/v1/admin/students` — list, `{ id, grNumber, name, sectionName, className, campusName,
  parentNames: string[] }` (current active enrollment's section, resolved via the existing
  `EnrollmentService`).
- `PATCH /api/v1/admin/students/:id` — `{ name?, grNumber? }` only — no Enrollment/parent changes
  here, per decision 5's scope line.
- `DELETE /api/v1/admin/students/:id` — `assertDeletable`; blocked once any real
  Attendance/FeeVoucher/LeaveRequest exists (Sprint 6.5's existing `Restrict`), same as today.

## Client UI (staff-console only — no parent-app surface, this is admin-only data)

Three new bespoke screens, same `TimetableView.vue`-derived table + inline-add-form +
inline-edit-row + `window.confirm`-delete pattern as every Org Structure screen:

- `TeacherManagementView.vue` — `/admin/teachers` (a staff-console Vue Router path — a separate
  namespace from the backend's `/api/v1/...` routes, so this doesn't collide with anything).
  Create form: identifier, password, name.
- `ParentManagementView.vue` — `/admin/parents`. Create form: identifier, password, name, phone.
- `StudentManagementView.vue` — `/admin/students`. Create form: GR-number, name, section picker
  (sourced from the existing `api.listSections`), and a parent-linking control that is either a
  searchable dropdown of existing parents (sourced from this spec's new `GET /admin/parents`) or,
  behind a "+ New Parent" toggle, the same identifier/password/name/phone fields
  `ParentManagementView`'s own create form uses.

`AppShell.vue` gains three more nav links, gated by a `canManagePeople` computed
(`SCHOOL_ADMIN`/`SUPER_ADMIN`) — a new, slightly broader gate than Org Structure's
`canManageOrgStructure` (`SUPER_ADMIN`-only), per decision 1.

## Testing & rollout

Same rigor as Org Structure CRUD, TDD throughout:
- Backend: one `*.service.spec.ts` per new service (mocked `PrismaService`, mocked `argon2` where
  password hashing is exercised), covering: the combined-transaction create paths (User+Teacher,
  User+ParentProfile, Student+Enrollment+StudentParent, and Student's inline-new-parent branch),
  the `assertCreatable`-guarded duplicate-identifier rejection, `assertDeletable`-guarded delete
  blocking (a Teacher who has marked attendance can't be deleted), and the `SCHOOL_ADMIN`+
  `SUPER_ADMIN`-only role guard. E2e tests for the same authorization boundary plus one real,
  unmocked "Teacher marks attendance, then a delete attempt is blocked" flow (mirroring Org
  Structure's own real-DB delete-restrict e2e test).
- Staff-console: component specs per new view, including the Student form's two parent-linking
  branches (pick existing vs. create inline) and the nav-gating test pattern Org Structure's final
  review established (assert each new link SUPER_ADMIN+SCHOOL_ADMIN shows it, ACCOUNTS/TEACHER
  doesn't) from task one, not bolted on at the end this time.
- `prisma/seed.ts` is unchanged — it already creates one of everything; these screens make more of
  the same.
