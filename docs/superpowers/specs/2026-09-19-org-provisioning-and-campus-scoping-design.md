# Org Provisioning & Campus Scoping — Design

Date: 2026-09-19
Status: Approved in chat (2026-09-19), pending written-spec review.

## Problem

1. On the Section screen, the class-teacher dropdown lists teachers from other schools/campuses.
   Cause: `TeachersService.listAll` (`backend/src/teachers/teachers.service.ts`) returns every
   teacher for `SUPER_ADMIN` and school-wide teachers for `SCHOOL_ADMIN`; `SectionManagementView.vue`
   never narrows that list to the selected class's campus, and `SectionsService` never checks that
   a `classTeacherId` belongs to the class's campus.
2. Creating a School or Campus creates no login. `School`/`Campus` only hold principal contact text.
   There is no way to onboard a principal who can then add classes/sections, and `User` has no campus
   scope (only `schoolId`).

## Scope

In: Piece A (teacher scoping fix), Piece B (login provisioning at School/Campus creation, campus-scoped principals).
Out: auto-creating `Staff`/`Teacher` rows, emailing credentials, multi-tenant/SaaS changes, a new Role enum value.

## Piece A — Teacher scoping fix (ships first, standalone)

- Backend: `GET /api/v1/teachers` accepts optional `campusId`. When present, results are limited to
  `Teacher.campusId = campusId`, still intersected with the acting user's existing school scope
  (a school admin cannot query another school's campus; that returns an empty list or 403).
- Backend: `SectionsService.create` and `update` reject a `classTeacherId` whose `Teacher.campusId`
  differs from the section's class's campus (400, clear message). This is the authoritative check.
- Frontend: in `SectionManagementView.vue`, the class-teacher `<select>` (add and edit) is disabled
  until a class is selected, then loads/filters teachers by that class's `campusId`. Changing the class
  clears an already-chosen teacher.
- `ClassSummary` must expose `campusId` for the filter (verify; add if missing).
- Tests: `sections.service.spec.ts` cross-campus rejection on create and update;
  `teachers.service.spec.ts` campus filter and school-scope intersection.

## Piece B — Provisioning at creation

### Data model
Migration adds to `User`:
- `campusId String?` — FK to `Campus`, `onDelete: Restrict`, indexed.
- `mustChangePassword Boolean @default(false)`.

Invariant: `campusId` non-null implies `schoolId` non-null and equal to that campus's `schoolId`
(enforced in the service layer at creation).

### Roles / identity
No new Role. A principal is `role=SCHOOL_ADMIN`, `isPrincipal=true`.
- School-level admin: `schoolId` set, `campusId = null` → sees the whole school.
- Campus principal: `schoolId` and `campusId` set → sees only that campus.

### School creation (`POST /schools`, SUPER_ADMIN)
DTO gains optional `admin: { identifier: string; password?: string }`.
One `$transaction`: create School → create School-level admin User (argon2 hash, `isPrincipal=true`,
`mustChangePassword=true`) → audit logs (`school.create`, `user.create`).
If `password` omitted, server generates a strong random one and returns it once in the response
(`provisionedLogin: { identifier, temporaryPassword }`). It is never persisted in plain text or logged;
the audit metadata must not contain it.

### Campus creation (`POST /campuses`, SUPER_ADMIN or school-level admin)
DTO gains optional `principal: { identifier, password? }`. Same transaction/return semantics.
Created user: `SCHOOL_ADMIN`, `isPrincipal=true`, `schoolId` and `campusId` set, `mustChangePassword=true`.
A campus-scoped principal (`campusId` non-null) cannot create campuses.

### Campus scoping of reads/writes
Where a query is currently scoped by `user.schoolId`, add: if `user.campusId` is set, additionally restrict
to that campus. Affected modules to audit: class, sections, teachers, staff, students/enrollment, timetable,
attendance listing, dashboard. Implement as one shared helper (e.g. a scope-builder next to
`StudentAccessService`) rather than per-module copies. The plan must begin by enumerating every `schoolId`
scoping site.

### Password change
Login response includes `mustChangePassword`. The staff console redirects to a change-password screen
until cleared. Reuse the existing password-reset/change endpoint if one exists; otherwise add
`POST /auth/change-password` (authenticated, argon2, clears the flag, revokes refresh tokens).

### Frontend
School and Campus create forms get an optional "Create login" section (identifier, optional password,
"generate for me" default). On success a one-time credentials panel is shown with copy button and a
warning that it won't be shown again.

### Errors
- Duplicate `identifier` → 409, whole transaction rolls back (no orphan School/Campus).
- Weak/invalid password or identifier → 400 via DTO validation.
- Login block omitted → behaves exactly as today (seed/import paths unaffected).

### Onboarding flow
1. Super Admin creates School + admin login → credentials shown once.
2. Admin/Super Admin creates Campus + principal login.
3. Principals log in, change password, add classes/sections (teacher dropdown campus-scoped via Piece A).
4. Staff/teachers are added later via the existing Staff flow, which may link to a login.

### Testing
- Service specs: transactional rollback on duplicate identifier; generated password returned once and
  absent from audit metadata; invariant `campusId ⇒ matching schoolId`.
- Scoping specs: campus principal cannot list/read another campus's classes, sections, teachers, staff.
- e2e: Super Admin creates school+admin → admin logs in, changes password, creates campus+principal →
  principal creates class and section.

## Sequencing
1. Piece A (small, independent).
2. Piece B migration + shared scope helper + scoping audit.
3. School/Campus provisioning endpoints.
4. Password-change enforcement.
5. Console UI.

## Open decisions (defaults chosen)
- Credentials shown on screen, not emailed.
- Campus principal cannot create campuses.
- Password policy: reuse the existing DTO/auth minimums.
