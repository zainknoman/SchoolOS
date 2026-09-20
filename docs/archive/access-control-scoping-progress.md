> **ARCHIVED 2026-09-20** — Content moves to docs/security/KNOWN-GAPS.md (Phase 8). Do not treat as current documentation.

# Access-Control Scoping — Status

Follow-up to the 2026-09-14 fix (see `PROJECT-STATUS.md` — "Teacher Subject/Class Assignment
Scoping + List-Endpoint Tenant Leak"). That fix closed the reported bug: `StudentAccessService`'s
missing subject/class-assignment check for `TEACHER`, and the unscoped `GET /sections`, `GET
/classes`, and admin `GET /students` list endpoints.

A broader audit found ~15 more endpoints with the same missing-scoping pattern. All but 4 have now
been fixed (2026-09-14, same day, follow-up pass) — scoped via `actingUser` (`SUPER_ADMIN`
unrestricted, `SCHOOL_ADMIN`/`ACCOUNTS` to their own school, `TEACHER` to
`StudentAccessService.getTeacherSectionIds()` where applicable), `CampusService.list()` as the
reference pattern, TDD per endpoint. Backend unit **472/472**, e2e **139/139**, `tsc --noEmit`
clean.

## Done

- [x] `GET /api/v1/admin/teachers` — `TeacherService.list(actingUser)`
- [x] `GET /api/v1/teachers` — `TeachersService.listAll(actingUser)`
- [x] `GET /api/v1/admin/parents` — `ParentService.list(actingUser)`, scoped via linked children's
      enrollments
- [x] `GET /api/v1/admin/staff` — `StaffService.list(actingUser, employeeType?)`, combined with the
      existing `employeeType` filter
- [x] `GET /api/v1/leave-requests` — `LeaveService.listAll(actingUser, status?)`, scoped via
      student → enrollment → campus
- [x] `GET /api/v1/admin/dashboard-summary` — `DashboardService.getSummary(actingUser)`; every
      sub-query now threads an optional `schoolId` through (enrollment count, attendance, fee
      payment/voucher, and a two-step `User.schoolId` lookup for notifications, since `Notification`
      has no direct relation to `User`)
- [x] `GET /api/v1/attendance-risk` (SCHOOL_ADMIN branch) — controller now resolves the admin's
      school's section ids the same way the TEACHER branch already did for class-teacher sections
- [x] `GET /api/v1/hiring/applications` — `HiringApplicationsService.findMany(actingUser, ...)`,
      caller-supplied `campusId` now ANDed with the caller's own school
- [x] `GET /api/v1/applications` (admissions) — `ApplicationsService.findMany(actingUser, ...)`,
      scoped via the application's `desiredClass`'s campus (AcademicSession has no schoolId, so this
      is the only available path)
- [x] `GET /api/v1/holidays` — `HolidaysService.findMany(actingUser, params)`; role-specific
      resolution (SCHOOL_ADMIN/ACCOUNTS → own school's campuses, TEACHER → own campus, PARENT → their
      children's campuses), ANDed with any caller-supplied `campusId`; school-wide (`campusId: null`)
      rows always included for everyone
- [x] `GET /api/v1/assessments` — controller now calls `assertCanAccessClass` before listing,
      matching the sibling create/update/delete/marks endpoints in the same controller
- [x] `GET /api/v1/assessment-categories` — same fix, via `assertCanAccessClass`

## Deferred — schema gap, needs a decision before fixing

These four don't have a `schoolId`/`campusId` path to filter on at all — `AcademicSession` and
`Subject` have neither field in the schema, and `FeeStructure` likewise. Adding one means a
migration plus updating every existing row (seed data, and any school currently in production),
which is a bigger, harder-to-reverse change than the rest of this list — not something to do
without sign-off.

- [ ] `GET /api/v1/academic-sessions` — `AcademicSessionService.list()`
- [ ] `GET /api/v1/terms` — `TermsService.findMany(academicSessionId)`; blocked on the same gap
      (Term only relates to AcademicSession, no independent path to a school)
- [ ] `GET /api/v1/subjects` — `SubjectsService.listAll()`; lower stakes than the other two —
      `Subject` rows are a small, low-cardinality shared catalog (`name` is globally unique, e.g.
      "Math", "English"), so this may be intentionally global rather than a bug. Worth confirming
      the intent before touching it.
- [ ] `GET /api/v1/fee-structures` — `FeeStructuresService.list()`

**A bigger question surfaced while looking at this:** `AcademicSession` is currently treated as a
single global, platform-wide concept (only `SUPER_ADMIN` can create one; nothing scopes it to a
school). But several e2e test fixtures each create their own `AcademicSession` row with
`isActive: true` at the same time — and application code elsewhere
(`StudentService.create()`) does `prisma.academicSession.findFirst({ where: { isActive: true } })`,
which returns whichever active session happens to sort first, not necessarily the right one for
the school in question, if more than one truly exists at once in a real multi-school deployment.
That's a correctness question independent of the access-control work here (it doesn't leak data,
it could silently enroll a student into the wrong school's session) and needs its own decision:
is `AcademicSession` meant to be global (current behavior, needs no change beyond documenting it)
or per-school (needs a schema migration touching every school-creation/enrollment path, not just
list endpoints)? Not investigated further — flagging it here rather than guessing.
