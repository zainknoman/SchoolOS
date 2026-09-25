# SchoolOS — Personas and Role Matrix

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** `@Roles(...)` decorators in `backend/src/**/*.controller.ts` (185 handlers scanned), `OrgScopeService`, `StudentAccessService`, `staff-console/src/router/index.ts`, `backend/prisma/schema.prisma` · **Owner:** Product Owner
> **Confirmed by the owner (2026-09-20):** Principal is a *flag on an authorised SCHOOL_ADMIN*, not a role. **Decided changes not yet implemented** (this matrix still shows current behaviour): parents can raise complaints (BL-30); leave needs no class teacher and gets a teacher *recommendation* step (BL-29); SCHOOL_ADMIN gets copy-structure in the UI (BL-33); subject management for SUPER_ADMIN and own-school SCHOOL_ADMIN (BL-02); students have **no** login in the initial release.

## 1. The roles

`enum Role { SUPER_ADMIN, SCHOOL_ADMIN, TEACHER, ACCOUNTS, PARENT }` — **there is no STUDENT and no PRINCIPAL role.**

| Role | Surface | Data scope | Notes |
|---|---|---|---|
| SUPER_ADMIN | Staff console | Platform-wide (`OrgScope.unrestricted`) | Creates schools and academic sessions; edits/deletes campuses; network dashboard |
| SCHOOL_ADMIN | Staff console | Own school; **own campus only** if `User.campusId` is set | Runs day-to-day administration. `isPrincipal = true` additionally unlocks `/principal/*` and `GET /admin/principal-academics-summary` |
| — Principal (flag) | Staff console | Same as the SCHOOL_ADMIN it is set on | Route meta `requiresPrincipal`; service enforces the flag (`dashboard.controller.ts:33`). Provisioned with a campus/school via `create-principal-user.ts` |
| ACCOUNTS | Staff console | Own school | Fees/finance (plus read-only classes, sections, subjects for fee work). Admissions, complaints and parent messages **only with an explicit grant** from a school admin (BL-32, 2026-09-26) |
| TEACHER | Staff console | Sections they teach (timetable) or are class teacher of (`getTeacherSectionIds`) | Campus match alone is not enough (`student-access.service.ts:14`) |
| PARENT | Parent app | Own children only (`StudentParent` link, independent of enrollment status) | Login by email or GR-number identifier |
| Student | none | — | No account, no login (verified: no such role or model link) |

## 2. Role → capability matrix (from `@Roles` decorators)

**Legend:** R read · C create · U update · D delete · A approve/decide · ✔ allowed · — not allowed · `own` = scoped to the caller's sections/children · Endpoints without a role decorator are authenticated-any-role with **service-level** scoping (`StudentAccessService`).

| Module | SUPER_ADMIN | SCHOOL_ADMIN | ACCOUNTS | TEACHER | PARENT |
|---|---|---|---|---|---|
| Schools | CRUD | — | — | — | — |
| Campuses | CRUD | C + R (own school; update/delete are SUPER_ADMIN only) | — | — | — |
| Classes | CRUD | CRUD (own school/campus scope) | R | R | — |
| Academic sessions | CRUD | R; `copy-structure` ✔ | — | R | — |
| Sections | CRUD | CRUD | R | R (own) | — |
| Subjects, terms | ✔ | terms CRUD, subjects R | subjects R | subjects R | — |
| Students (admin) | CRUD | CRUD (own school/campus) | — | — | — |
| Student profile (medical, emergency, docs, promotion history) | ✔ | ✔ | — | — | R/U own child via `/me/children/:id` |
| Parents (admin) | CRUD; dedupe report | C + R/U links of own students; profile U/D only when all the guardian's children are in own school/campus; lookup by identifier/CNIC | — | — | — |
| Teachers (admin) | CRUD | CRUD | — | — | — |
| Staff + profile | CRUD | CRUD | — | — | — |
| Hiring (candidates, applications, approve/reject) | ✔ | ✔ | — | — | — |
| Admissions (applicants, applications, approve/reject) | ✔ | ✔ | ✔ only with grant `ADMISSIONS` (create/list/decide) | — | — |
| Bulk import (preview/commit) | ✔ | ✔ | — | — | — |
| Promotion / re-enrollment | ✔ | ✔ | — | — | — |
| Timetable | CRUD | CRUD | — | R own (`/teachers/me/timetable`) | R child |
| Attendance | mark + R | mark + R | — | mark + R (own sections) | R child |
| Attendance risk | R | R | — | R (own) | R child |
| Diary | C + R | C + R | R (section) | C + R (own) | R child |
| Circulars | C + R + stats | C + R + stats | — | — | R; mark read |
| Gradebook: categories | CRUD | CRUD | — | — | — |
| Gradebook: assessments & marks | CRUD | CRUD | — | CRUD (own class) | R child grades |
| Report cards | C | C | — | C (own) | R child |
| Holidays | CRUD | CRUD | — | R | R |
| Complaints | C/U/R | C/U/R | C/U/R only with grant `COMPLAINTS` | C/U/R (section-scoped) | R own child only (read-only screen) |
| Leave requests | A (approve/reject) + R | A + R | — | — | C + R own |
| Fee structures | CRU | CRU | CRU | — | — |
| Fee vouchers & reconcile | ✔ | ✔ | ✔ | — | pay (`/pay`) + R child |
| Messages (conversations) | R/reply | R/reply | R/reply only with grant `MESSAGES` | R/reply (class teacher) | C + R + reply |
| Notifications | own | own | own | own | own |
| Files | upload + R | upload + R | R | upload + R | R (access-checked) |
| Dashboards | network (SUPER_ADMIN) | ops summary; principal summary if principal | dashboard summary / ops | My Day, gradebook overview | — |
| AI draft suggestions | — | ✔ (circular, diary) | — | ✔ (diary) | — |

Notes / discrepancies discovered (recorded, not fixed):
- **Complaints:** create and status-update are staff-role-decorated; `GET /complaints?studentId=` is any-authenticated and gated by `StudentAccessService`, which is how the parent app's read-only complaints screen works (`complaints_screen.dart`). Parents cannot raise complaints in the current implementation (**decided to change**: parents raise complaints and see status/history; staff assign, respond, keep internal notes hidden from parents — BL-30/BL-31).
- **Leave approval** is SCHOOL_ADMIN/SUPER_ADMIN only and additionally requires the student's section to have a class teacher (`leave.service.ts:109`), because the LEAVE attendance rows it writes are attributed to that teacher (required `Attendance.markedById` Teacher FK — F1); teachers do not approve leave. **Decided:** teachers/class teachers *recommend*, SCHOOL_ADMIN approves, no class teacher required, separate attribution (BL-29).
- **Staff-console route access vs API:** `/admin/fees` allows ACCOUNTS in the router; `/admin/admissions*`, `/admin/messages`, `/admin/complaints` allow ACCOUNTS only with the matching grant (`meta.requiresGrant`, BL-32); **Accounts Access** (`/admin/accounts-access`) is where a school admin sets the grants; other `/admin/*` pages are SCHOOL_ADMIN/SUPER_ADMIN only. Server roles are authoritative.
- The matrix reflects decorators; **object-level checks** (campus, section, child) are additional and are described in `StudentAccessService` / `OrgScopeService`.

## 3. Personas (behavioural summary, from the UI each role gets)

| Persona | Primary jobs in the product | Entry screens |
|---|---|---|
| Network owner (SUPER_ADMIN) | Onboard schools/campuses, manage sessions/classes, monitor network | `/admin` network overview, `/admin/schools`, `/admin/campuses`, `/admin/academic-sessions` |
| School administrator | Maintain people & structure, timetable, admissions/hiring, circulars, leave decisions, holidays, terms/categories, promotion, bulk import | `/admin` operations dashboard |
| Principal (flag) | Oversee school & academics/staff at a glance | `/principal`, `/principal/academics-staff` |
| Accountant | Issue and reconcile fee vouchers; admissions intake; view complaints/messages | `/admin/fees` |
| Teacher | Take attendance, write diary, enter marks, view timetable, handle complaints/report cards/messages | `/teacher` (My Day), `/teacher/attendance`, `/teacher/gradebook` |
| Parent | Track children, pay fees, message school, apply for leave | Parent app Home |
