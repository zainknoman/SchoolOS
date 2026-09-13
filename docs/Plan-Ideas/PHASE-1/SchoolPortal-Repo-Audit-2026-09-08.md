# SchoolPortal — MVP Repo Audit & Feature Verification

**Independent repository audit, compiled 2026-09-08.**
Baseline for comparison: `docs/Seedsapk/MVP-Plan-V3.md` (validated MVP scope, six two-sprint build).
Subject: `github.com/zainknoman/SchoolPortal` — one NestJS/Prisma backend, a Vue 3 staff console, and a
Flutter parent app. Every finding below is sourced from the actual source tree at commit `1e74697` (main),
not from `PROJECT-STATUS.md`'s own claims, which were independently re-verified against code. No code was
executed; no vulnerabilities were exploited.

**Overall maturity: 36/100** · 78 capabilities audited · 26 confirmed (33%) · 7 partial/weak (9%) ·
7 stubbed (9%) · 38 missing/planned only (49%)

Published version (interactive, with full evidence table): https://claude.ai/code/artifact/369214a4-f1f7-400a-a76c-d116a44d3e07

---

## 1. Executive Summary

SchoolPortal is a two-day-old (77 commits, 2026-08-27 → 2026-08-29), AI-agent-built codebase implementing
roughly one third of the MVP scope defined in `MVP-Plan-V3.md`. What is built is built well — real RBAC, a
genuinely enforced parent/student isolation layer, meaningful end-to-end tests, and a thoughtful Prisma
schema. What is *not* built is not a matter of polish: Fees, Messaging, Notifications, Leave Applications,
and every admin CRUD screen (Students, Parents, Teachers, Classes, Timetable management) are either
entirely absent or reduced to a placeholder string, a dead `href="#"` nav link, or a schema table with zero
backend logic behind it.

Four vertical slices work end-to-end today: authentication with real parent-isolation, attendance
marking/viewing (with one role-gated bug — see below), timetable viewing, and diary + circulars (with read
tracking). Everything else in the MVP's Tier-1 scope is either a stub, mocked data, or absent outright. The
gap between `PROJECT-STATUS.md`'s self-reported "Sprint 6.5 ✅ DONE" narrative and the actual feature
surface is honest — the document itself flags most of what's missing — but a reader relying on the document
alone would still overestimate how close this is to a pilot-ready product.

Two things looked confirmed at a glance but turned out, once traced end to end, not to be: **Admin/Super
Admin users cannot actually mark attendance** (a role-lookup bug), and **the Admin dashboard's stat cards
are 100% mock data**, not the live backend numbers they appear to show.

No CI/CD pipeline exists, the database still targets SQLite (Postgres migration not yet run), and several
security-hardening items (unbounded file uploads, wide-open CORS, a hardcoded JWT-secret fallback, no
general rate limiting) are appropriate for local development but not yet closed off for any real deployment.

---

## 2. Repository Architecture

Monorepo, three top-level applications sharing one backend contract, matching the architecture decision
documented in `MVP-Plan-V3.md` ("one backend, two clients, not five"):

- **Backend** — NestJS 11 + TypeScript, Prisma ORM, versioned REST under `/api/v1`. Modular structure: one
  Nest module per bounded context (`auth`, `attendance`, `timetable`, `diary`, `circulars`, `files`,
  `sections`, `subjects`, `enrollment`, `me`). Global deny-by-default auth (`backend/src/auth/auth.module.ts:24-27`)
  via two `APP_GUARD` providers.
- **Staff console** — Vue 3 + TypeScript + Vite + Pinia, one role-gated SPA (Teacher / Admin-Accounts) as
  the plan specifies, not three separate apps. Router-level role guards (`staff-console/src/router/index.ts:55-77`).
- **Parent app** — Flutter (3.13 SDK), `go_router` + `provider` for state, `flutter_secure_storage` for
  tokens. Android/iOS/web/desktop scaffolds all present (Flutter defaults), only Android/web actually
  exercised per `PROJECT-STATUS.md`.

The database is provider-agnostic Prisma but currently wired to SQLite for local dev
(`backend/prisma/schema.prisma:10-12`) — the Postgres cutover is a documented pending item, not yet
performed anywhere in the repo (no `docker-compose.yml`, no deployment config of any kind found at the
repo root).

No `.github/workflows/` directory, no other CI config, and no root `LICENSE` file exist anywhere in the
tree. The only root-level narrative document is `PROJECT-STATUS.md` — there is no root `README.md`.

---

## 3. Application Inventory

### Backend — `backend/src/`

Modules present: `auth`, `me`, `timetable`, `attendance`, `sections`, `files`, `subjects`, `diary`,
`circulars`, plus shared `common` (`StudentAccessService`), `enrollment`, `storage`, `prisma`. 16 `*.spec.ts`
unit suites, 6 `*.e2e-spec.ts` suites under `backend/test/` — sampled and confirmed to run real assertions
against a live test database (Argon2 hashing, HTTP status codes, DB row state), not superficial smoke tests.
Zero `TODO`/`FIXME`/`HACK` markers anywhere in `backend/src` — incomplete items are tracked in
`PROJECT-STATUS.md` prose instead of in-code.

**Modules genuinely absent** from `backend/src/`: `fees`, `messages`, `notifications`, `leave-requests`,
and any `students`/`parents`/`teachers`/`classes` CRUD module. Their data models exist in `schema.prisma`;
no controller, service, or route does.

### Staff console — `staff-console/src/`

Views: `LoginView`, `TeacherHomeView` (wraps `AttendanceView`), `DiaryView`/`DiaryPageView`,
`AdminHomeView`, `CircularsView`/`CircularsPageView`, `FeesView`. 14 `*.spec.ts` files. No
Students/Parents/Teachers/Classes/Timetable-management view exists — the corresponding sidebar links in
`AppShell.vue:47-51` are literal `<a href="#">` dead anchors. Two "Timetable" and "Messages" nav links on
the *Teacher* side are also dead anchors (`AppShell.vue:42-43`) — a teacher has no way to see their own
timetable or read a parent message anywhere in this console today.

### Parent app — `parent-app/lib/src/`

Screens: `login_screen.dart`, `home_shell.dart` (bottom-nav shell), `home_tab.dart`, `calendar_tab.dart`
(Timetable/Attendance/Diary sub-tabs), `circulars_tab.dart`. 9 test files under `parent-app/test/`.
Notifications/Messages/Fees/More are bottom-nav destinations; Messages/Fees/More render a static
placeholder string (`home_shell.dart:198-200`) — there is no `messages_tab.dart`, `fees_tab.dart`, or
`profile` screen file anywhere in the tree. The "Notifications" bottom-nav slot is actually filled by a
fully working Circulars screen (real unread badge, real mark-read) — functional, just mislabeled.

### Documentation / planning

`plan/docs/` holds `FEATURES.txt` (FEAT-001..014, the detailed spec `PROJECT-STATUS.md` references), plus
`ARCHITECTURE.md`, `PRD.md`/`PRD.txt`, `TECH-STACK.md`, `DESIGN-BRIEF.md`, `CURRENT-SYSTEM-ANALYSIS.md`, and
`DATA-MODEL-CORRECTION-PLAN.md`. These are internally consistent with `PROJECT-STATUS.md` and with what's
actually in the tree — no contradictions found between the planning docs and the code's real state, only
between the docs and an outsider's assumption that "MVP" means "complete."

---

## 4. Feature Verification Matrix

Status legend: **A** Confirmed · **B** Partial · **C** Weak · **D** Stubbed · **E** Planned only ·
**F** Not found · **G** Unclear

### Authentication & Identity

| Feature | Status | Evidence |
|---|---|---|
| Login (email/GR-number + password) | A Confirmed | `auth.controller.ts:12`, `auth.service.ts:41-84`, `LoginView.vue`, `login_screen.dart` |
| Password hashing (Argon2) | A Confirmed | `auth.service.ts:54` `argon2.verify`; `User.passwordHash` |
| JWT access token issuance | A Confirmed | `jwt.strategy.ts`, `auth.module.ts:15-18` (15m TTL) |
| Refresh-token redemption/rotation | D Stubbed | Token minted & hashed-stored (`auth.service.ts:92-104`) but **no `/auth/refresh` route exists** — `auth.controller.ts` has only `login`; neither client ever calls a refresh endpoint |
| Account lockout (brute force) | A Confirmed | `auth.service.ts:56-75`, `auth.constants.ts:3-4` (5 attempts / 15 min) |
| General API rate limiting | F Not found | No `ThrottlerModule`/`@Throttle` anywhere |
| Forgot password | F Not found | No route, no screen; grep returns nothing |
| Session persistence across app restarts | B Partial | `auth_state.dart:24-32` restores a stored token but never checks/handles expiry — after the 15-min TTL, calls silently 401 with no recovery path |
| Server-enforced RBAC (deny-by-default) | A Confirmed | `auth.module.ts:26-27` global `APP_GUARD`; `roles.guard.ts`; verified per-controller |
| Parent profile/settings screen | F Not found | No profile/settings screen file; only a logout icon in the app bar |
| Staff/parent/student account creation (admin) | F Not found | No `POST /users`-style endpoint; only `backend/prisma/seed.ts` creates accounts |
| User/role/student identity data model | A Confirmed | `schema.prisma:38-63` (`User`, `Role` enum) |

### School Structure

| Feature | Status | Evidence |
|---|---|---|
| School entity | D Stubbed | `schema.prisma:79-85` model + seed row; zero CRUD API/UI |
| Multi-campus data model & query enforcement | A Confirmed | Real, load-bearing: `Enrollment.campusId` resolved by `enrollment.service.ts`, consumed by Diary/Timetable/Sections/Circulars/Files/Me |
| Campus management UI (switch/create) | F Not found | Deliberately deferred per plan; confirmed absent |
| Academic year/session management | D Stubbed | `AcademicSession` model + seed row only, no admin CRUD |
| Sections (read API, staff roster picker) | A Confirmed | `sections.controller.ts`; consumed by `AttendanceView.vue:22,36` |
| Subjects (read API) | A Confirmed | `subjects.controller.ts`; consumed by diary compose screen |
| Classes/Sections/Subjects admin CRUD | F Not found | No create/update/delete route for any of the three |
| Teachers admin CRUD | F Not found | Dead nav anchor; no backend route |
| Students admin CRUD | F Not found | Dead nav anchor; no backend route |

### Student Information

| Feature | Status | Evidence |
|---|---|---|
| Student profile (detail beyond name/class) | B Partial | Only `ChildSummary` surfaced via `/me/children`; no fuller profile view |
| Guardian/parent relationships + isolation | A Confirmed | `StudentParent` join + `student-access.service.ts:20-37`, e2e-verified |
| Multiple children per parent (switcher) | A Confirmed | `home_shell.dart:118-138` dropdown wired to `/me/children`, keyed re-fetch on switch |
| Student enrollment status | B Partial | `EnrollmentStatus` enum used internally; not surfaced in any UI |
| Enrollment (point-in-time section/campus resolution) | A Confirmed | `Enrollment` model + `EnrollmentService`, added Sprint 6.5 to fix a real mid-year-transfer bug |

### Attendance

| Feature | Status | Evidence |
|---|---|---|
| Daily attendance marking (staff) | B Partial | `POST /attendance` role-gated for TEACHER/SCHOOL_ADMIN/SUPER_ADMIN, e2e-tested, audit-logged — **but** `markAttendance` looks up `Teacher.findUnique({where:{userId}})` and throws `NotFoundException` if none exists (`attendance.service.ts:29-34`); Admin/Super Admin typically have no `Teacher` row, so only Teacher-role users can actually mark attendance today |
| Attendance history/monthly summary | A Confirmed | `GET /students/:id/attendance?month=` (`attendance.controller.ts:22-31`) |
| Holiday handling | B Partial | `AttendanceStatus.HOLIDAY` exists and is excluded from the % calc, but there is no calendar-wide `Holiday` model — holidays can only be recorded per-student, per-day |
| Staff (teacher) attendance | F Not found | No model, no module |
| Leave interaction with attendance calendar | E Planned only | `LeaveRequest` modeled; zero backend module; "Sprint 9-10 ⏳ Pending" |
| Admin-side attendance reporting/export | F Not found | Dashboard shows today's counts only |

### Timetable

| Feature | Status | Evidence |
|---|---|---|
| Timetable read (parent calendar) | A Confirmed | `GET /students/:id/timetable`; parent-app weekly-grid `calendar_tab.dart` |
| Timetable creation/management (admin) | C Weak | `POST /timetable` exists API-side, but **no UI screen** — nav is a dead anchor for both roles; only reachable via raw HTTP |
| Teacher's own timetable view | F Not found | No teacher-facing timetable screen; nav link dead |
| Period/subject scheduling (data model) | A Confirmed | `Timetable` model (`schema.prisma:228-245`) |
| Scheduling conflict detection | F Not found | `createEntry` (`timetable.service.ts:46-48`) is a bare `prisma.timetable.create(dto)` call — no same-teacher/same-room/same-period check despite the plan listing conflict handling as in-scope |

### Academics

| Feature | Status | Evidence |
|---|---|---|
| Class diary/homework | A Confirmed | Full stack: `POST/GET /diary`, `DiaryView.vue` compose, parent Diary sub-tab, Urdu RTL, audit-logged, e2e-tested |
| Formal assignments (submission/grading) | F Not found | No `Assignment` model |
| Assessments/exams | F Not found | No model, no module, no UI |
| Grades | F Not found | No model anywhere in schema |
| Report cards | E Planned only | Explicitly Release-2+ per deferred list |

### Parent Experience

| Feature | Status | Evidence |
|---|---|---|
| Child selector | A Confirmed | `home_shell.dart:118-138` |
| Home ("Today") dashboard | A Confirmed | `home_tab.dart` — real attendance %, greeting, announcements |
| Calendar (Timetable/Attendance/Diary tabs) | A Confirmed | `calendar_tab.dart` |
| Results (parent view) | F Not found | Static placeholder text only, no backing data |
| Fees (parent view) | D Stubbed | Bottom-nav tab renders literal text "Messages/fees land here in future sprints" |
| Push notifications | F Not found | No Firebase/FCM in `pubspec.yaml` or anywhere in `parent-app/` |
| Circulars (parent view) | A Confirmed | `circulars_tab.dart`, unread badge, `markCircularRead` |
| Messaging (parent view) | D Stubbed | Same placeholder tab as Fees; modeled, no backend module |

### Communication

| Feature | Status | Evidence |
|---|---|---|
| Announcements/circulars | A Confirmed | School/section scope, attachments, expiry all modeled and used |
| Two-way messaging | E Planned only | Modeled, zero logic; "Sprint 7-8 🔜 Next" |
| Delivery/read-status tracking (circulars) | A Confirmed | `CircularRecipient.readAt`; admin stats endpoint |
| Delivery/read-status tracking (messages) | F Not found | No message module exists to track it |

### Fees

| Feature | Status | Evidence |
|---|---|---|
| Fee structure/voucher/item/payment schema | E Planned only | Thorough relational model (`schema.prisma:365-427`), incl. paisa-integer amounts and a multi-voucher `FeePaymentAllocation`; zero backend module |
| JazzCash/EasyPaisa payment gateway | F Not found | No gateway SDK, adapter, or interface anywhere |
| PDF voucher generation | F Not found | No PDF library in `backend/package.json` |
| Payment history/receipts | E Planned only | `Receipt` modeled, unused |
| Outstanding-balance computation | F Not found | No service computes this |
| Discounts/late fees | F Not found | `FeeItem` is a flat label+amount — no discount/late-fee field modeled |
| Staff fee-reconciliation UI | D Stubbed | `FeesView.vue` built entirely against `lib/mockFees.ts`; `confirmResolution()` only mutates a local in-memory array, nothing persists |

### Leave

| Feature | Status | Evidence |
|---|---|---|
| Leave application (parent submit) | E Planned only | `LeaveRequest` modeled with `onDelete: Restrict`; zero module, zero UI |
| Leave approval/rejection (admin) | E Planned only | Same |
| Leave history | E Planned only | Same |

### Administration

| Feature | Status | Evidence |
|---|---|---|
| Admin dashboard (stat cards, trends, alerts) | D Stubbed | UI is real and well-built, data is not: `AdminHomeView.vue` sources exclusively from `getMockDashboardSummary()` (`lib/mockDashboard.ts`) — zero backend call |
| Users/roles/permissions management UI | F Not found | RBAC enforcement is real server-side; no screen to create/edit users or change roles |
| Complaint/concern tracking | F Not found | No model at all — not even planned in schema, despite being named explicitly in the MVP plan |

### Technical Infrastructure

| Feature | Status | Evidence |
|---|---|---|
| API architecture (versioned REST, DTO validation) | A Confirmed | `main.ts:14` global `ValidationPipe({whitelist:true, transform:true})`; consistent `/api/v1` prefixing |
| Database design quality | A Confirmed | Normalized, indexed, UUID PKs, deliberate onDelete policy revisions (Sprint 6.5) |
| Production database migration (→ Postgres) | E Planned only | `schema.prisma:11` still `provider = "sqlite"` |
| File storage abstraction | A Confirmed | Swappable `StorageAdapter` token — real, tested, though only local-disk exists today |
| File-upload safety (size/type limits) | F Not found | `FileInterceptor` has no `limits`; no MIME allowlist |
| Offline caching | F Not found | No Hive/sqflite/shared_preferences or any cache layer |
| Sync mechanisms | F Not found | No sync layer anywhere; entirely request/response |
| Audit logging (writes) | B Partial | Real writes confirmed for attendance-mark, file-upload, diary-publish, circular-publish; **login is not audit-logged** despite being named as a tracked action in the schema's own comment |
| Audit log viewer UI | E Planned only | Writes ship, viewer doesn't |
| Automated testing (unit + e2e, all 3 apps) | A Confirmed | 16 backend unit + 6 e2e suites, 14 staff-console spec files, 9 parent-app test files — sampled and real |
| CI/CD enforcement | F Not found | No `.github/workflows/` or any CI config anywhere — every test suite above is manually run only |

---

## 5. MVP Features Confirmed

- **Authentication + parent isolation** — login, Argon2 hashing, account lockout, deny-by-default RBAC, and
  a shared `StudentAccessService` every module calls before touching a student's data.
- **Multi-child/multi-campus data model**, load-bearing rather than decorative — resolved by a real
  `EnrollmentService`, not a denormalized column.
- **Timetable (read side)** — weekly grid on the parent app, backed by a real endpoint.
- **Diary/homework** — full authoring + viewing loop, attachments, correct Urdu RTL rendering with no
  auto-translation.
- **Circulars** — school/section scope, attachments, read/unread tracking with admin-visible delivery stats.
- **Test discipline** — 45+ files across three codebases with real, non-trivial assertions.

---

## 6. MVP Features Partially Implemented

- **Session persistence** restores a stored token on app open but never checks or refreshes it — the
  promised "don't force re-login" behavior silently breaks 15 minutes into any real session.
- **Timetable management** — the write API exists and is role-gated correctly; there is no admin screen to
  use it, so it's only reachable via raw HTTP today.
- **Holiday handling** — the attendance status exists and is excluded from percentage math, but there's no
  calendar-wide holiday concept, only per-student-per-day marking.
- **Audit trail** — writes are real for the four staff-write actions checked, but login (success and
  lockout) isn't logged.
- **Attendance marking is role-incomplete** — authorized for TEACHER/SCHOOL_ADMIN/SUPER_ADMIN, but the
  service 404s for any marking user without a `Teacher` row, which Admin/Super Admin typically lack.

---

## 7. MVP Features Missing

- **Fees, in full** — no gateway, no PDF, no computed balances; parent tab is placeholder text, staff
  reconciliation screen is 100% mock data.
- **Messaging** — schema only; parent tab is placeholder text.
- **Push notifications** — no Firebase/FCM wiring in either client.
- **Leave applications** — modeled, zero logic or UI, end to end.
- **Every admin CRUD screen** — Students, Parents, Teachers, Classes/Sections/Subjects management are all
  dead nav links.
- **Offline tolerance** — zero caching layer; a lost connection shows a bare error, not a "last updated"
  stale view as specified.

---

## 8. Technical Debt

Most debt here is *scope* debt (see Missing, above) rather than *quality* debt — the engineering that
exists is generally sound. The debt worth tracking:

- **No CI/CD.** 45+ test files exist with real coverage, but nothing runs them on a PR — a regression can
  merge to `main` undetected. This is the single highest-leverage fix available.
- **Refresh-token dead code.** The client stores a refresh token that is never redeemed because no
  `/auth/refresh` route exists — either finish the loop or stop minting/storing tokens that do nothing.
- **`onDelete` policy disagreement** between sibling models of the same `FeePayment`:
  `FeePaymentAllocation.feePayment` is `Restrict` while `Receipt.feePayment` is `Cascade` — flagged by the
  team itself, not yet resolved.
- **Cascade-delete risk on structural tables.** `Section → Timetable/DiaryEntry/Circular` are still
  `onDelete: Cascade` — deleting a section silently wipes its academic history.
- **Staff "free pass" in `StudentAccessService`.** Any staff role can access any student's record with no
  campus/section scoping. Fine at single-campus scale, a real gap once a second school is onboarded.
- **`MeService.getChildrenForUser` has an unhandled crash path.** Reads `enrollments[0]` with no null check
  (`me.service.ts:48`) — a student with zero ACTIVE enrollments throws an unhandled `TypeError`. Unreachable
  today, but will surface once a transfer/withdrawal workflow exists.
- **Diary attachment replacement isn't transactional.** `diary.service.ts:53-59` deletes existing
  attachments then creates new ones as two separate calls — a crash between them leaves a diary entry with
  zero attachments.
- **No centralized logging or error handling.** `backend/src/common/` contains only `StudentAccessService` —
  no exception filter, no interceptor, no logger service anywhere in `src/`.
- **No root README** — onboarding relies entirely on `PROJECT-STATUS.md`, which is a changelog, not a setup
  guide.

---

## 9. Security Findings

No exploitation was attempted; findings are static-analysis observations with impact notes.

- **Unbounded file uploads.** `FileInterceptor('file', { storage: memoryStorage() })` sets no `limits`, and
  `FilesService.upload` applies no MIME allowlist (`files.controller.ts:32`, `files.service.ts:21`).
  *Impact: disk-exhaustion DoS via repeated large uploads; arbitrary file types can be stored (render-time
  risk is mitigated by forced-download + `X-Content-Type-Options: nosniff` on serve, but storage abuse is
  not).*
- **Hardcoded JWT-secret fallback.** Both `jwt.strategy.ts:21` and `auth.module.ts:16` fall back to the
  literal string `'dev-only-change-me-access'` if `JWT_ACCESS_SECRET` is unset, with no boot-time check
  forcing a real secret outside dev. *Impact: if this ever ships to a real environment without the env var
  set, tokens are forgeable using a value that's public in this repo.*
- **Wide-open CORS.** `app.enableCors()` is called with no origin restriction (`main.ts:10`). *Impact: lower
  severity given Bearer-token (not cookie) auth, but any origin can read API responses from a client holding
  a valid token.*
- **Global `?access_token=` query-param auth fallback.** Designed for file-download links only, but wired
  into the shared `JwtStrategy` so it works on every route (`jwt.strategy.ts:16-19`). *Impact: tokens can
  land in server access logs/browser history on any route, not just downloads.*
- **No general rate limiting.** Only per-account lockout exists; no IP-level or route-level throttle, so
  credential-stuffing across many accounts is unthrottled.
- **Cross-campus staff access.** `StudentAccessService` grants any staff-role user access to any student
  regardless of campus/section (`student-access.service.ts:24-26`). *Impact: low today (single school,
  small staff), real before multi-campus staff restriction is needed.*
- **Positives worth noting:** generic invalid-credential errors (never reveal which field was wrong),
  passwords/tokens never logged, no secrets found committed to git history, download responses correctly
  forced to `attachment` with `nosniff`, global `ValidationPipe` genuinely enforced.

---

## 10. Data Model Findings

`backend/prisma/schema.prisma` (477 lines, 6 migrations) is the strongest part of this codebase.
Normalized, UUID-keyed, consistently indexed on foreign keys, and shows evidence of real iteration:
Sprint 6.5 replaced a denormalized `Student.campusId/sectionId` with a proper dated `Enrollment` model
specifically because the old shape silently rewrote historical diary/timetable data on a mid-year section
transfer — a genuine bug caught and fixed, not a hypothetical.

Money is modeled as integer paisa (never float) with a dedicated `FeePaymentAllocation` join to support
partial/lump-sum payments across multiple vouchers — a shape decision made ahead of building the Fees
feature specifically so it wouldn't need reshaping later.

**Schema is well ahead of backend logic.** Six models exist with zero controller/service behind them:
`Message`/`MessageRecipient`, `Notification`, `FeeStructure`/`FeeVoucher`/`FeeItem`/`FeePayment`/
`FeePaymentAllocation`/`Receipt`, `LeaveRequest`, `DeviceToken`. Two features from `MVP-Plan-V3.md` aren't
modeled at all yet: `Holiday` (calendar-wide) and `Complaint`/concern tracking.

One live inconsistency: `FeePaymentAllocation.feePayment` is `onDelete: Restrict` while its sibling
`Receipt.feePayment` is `Cascade` — two children of the same parent disagreeing on delete policy, flagged
in the team's own notes as unresolved.

---

## 11. API Findings

Consistent shape across every real endpoint: `/api/v1` prefix, DTO + global `ValidationPipe`,
deny-by-default guards, explicit `@Roles()` where a route isn't universally accessible. No inconsistency
found between the endpoints that exist.

The surface itself is the gap, not its design: roughly nine real resource groups exist (`auth`, `me`,
`students/:id/timetable`, `students/:id/attendance`, `attendance`, `sections`, `subjects`, `diary`,
`circulars`, `files`) against the roughly fourteen FEAT areas `plan/docs/FEATURES.txt` defines. No
versioning conflicts, no breaking-change history to audit (single version, two days old).

---

## 12. Parent App Findings

Flutter, `provider` for state, `go_router` for navigation, `flutter_secure_storage` for tokens (confirmed
actually used, not just a dependency listed) — genuinely appropriate stack choices for the plan's
"Android-first, mid/low-end device" target. `ApiClient` (`api_client.dart`) is a thin, well-scoped HTTP
wrapper injected for testability.

What's real: login, multi-child switching, Home, and the three-tab Calendar (Timetable/Attendance/Diary)
with correct Urdu RTL — plus a fully working Circulars screen (real unread badge, real mark-read), though
its bottom-nav slot is mislabeled "Notifications", which invites confusion with the push-notification
feature that doesn't exist. What's a genuine placeholder: Messages, Fees, and Profile/More — three of six
bottom-nav destinations render one shared static string ("Messages/fees land here in future sprints…"). The
stored refresh token is never redeemed (no client code calls a refresh endpoint, and none exists
server-side either). No offline caching, no push notifications, no forgot-password flow anywhere in the
tree.

---

## 13. Staff/Admin App Findings

Vue 3 + Pinia + vue-router, role-gated at the router level (`router/index.ts:55-77`) with a genuine
deny-by-default redirect for the wrong role, not a UI-only hide. What's real: Login, Teacher's
attendance-marking screen (the one screen most actively refined — segmented Present/Absent/Late control
with a sticky submit footer, though see the Admin/Super-Admin marking bug noted above), Diary compose, and
Circulars publish. `AdminHomeView`'s dashboard is real, well-built UI — stat cards, a trend chart, an
alerts panel — sourced entirely from `lib/mockDashboard.ts`, not a live backend call; a convincing shell
around data that doesn't exist yet.

Two "Timetable" and "Messages" nav links on the Teacher side are also dead `href="#"` anchors — a teacher
has no way to see their own timetable or read a parent message anywhere in this console today.

`FeesView.vue` is a fully-built reconciliation-queue UI wired to `lib/mockFees.ts` — good UI work, zero
live data, isolated behind one function so the real endpoint can be swapped in later without a rewrite (a
genuinely good decision, correctly documented as such).

**Every admin CRUD nav item — Students, Parents, Teachers, Classes, Timetable — is a dead `href="#"`
anchor** with no route or component behind it. A live, unfixed bug: the Circulars nav link is shown to the
`ACCOUNTS` role (`isAdmin` includes it, `AppShell.vue:12`) but the route requires `SCHOOL_ADMIN`/
`SUPER_ADMIN` (`router/index.ts:49`) — an Accounts user clicking it silently bounces back to `/admin` with
no explanation.

---

## 14. Highest-Risk Technical Issues

1. **No CI/CD.** The single fastest way this codebase regresses silently — a real test suite exists and
   nothing runs it automatically.
2. **Auth session has a silent failure mode.** A 15-minute access token with no working refresh path means
   every real session degrades to unexplained 401s after 15 minutes with zero client-side handling —
   during a pilot this will present as "the app randomly breaks."
3. **SQLite in a codebase about to hold real attendance/fee data.** The Postgres cutover is planned but not
   started; SQLite's write-locking and lack of managed backup/replication are not appropriate for even a
   small live pilot.
4. **Unbounded file uploads** become a real risk the moment diary/circular attachments see actual usage,
   not just seeded test files.
5. **CORS-wildcard + hardcoded-secret-fallback, stacked.** Neither is exploitable in local dev, but the
   combination is exactly the kind of default that survives unnoticed into a first deployment without an
   explicit fail-fast check.
6. **Scope gap vs. the plan's own acceptance criteria.** Of the acceptance-criteria bullets in
   `MVP-Plan-V3.md`, roughly three are demonstrably met end-to-end (login + isolation; calendar/attendance/
   diary; circulars). Fees, messaging, leave, push notifications, and every admin CRUD screen remain
   unbuilt.

---

## 15. Recommended Stabilization Work

Hardening what already exists — not the next-feature roadmap.

- Wire `POST /auth/refresh` with rotation-on-use, plus client-side 401→refresh-retry — or stop
  minting/storing refresh tokens that nothing redeems.
- Add a file-upload MIME allowlist and size cap (`multer` `limits`) before any real user-generated
  attachment traffic.
- Scope the `?access_token=` fallback to the files route only, instead of every route globally.
- Add IP/route-level rate limiting (e.g. `@nestjs/throttler`) beyond the existing account lockout.
- Fail fast at boot if `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` are unset outside `NODE_ENV=development`,
  instead of silently defaulting.
- Stand up a CI workflow running all three test suites + lint + typecheck on every PR.
- Execute the SQLite → PostgreSQL migration and a first staging deploy before any pilot commitment.
- Add an `AuditLog` write on login (success and lockout).
- Fix the Accounts-sees-Circulars-nav dead-end (`AppShell.vue` `isAdmin` condition).
- Resolve the `FeePaymentAllocation` vs `Receipt` `onDelete` disagreement before any Fees work begins on
  top of it.
- Fix the `markAttendance` Teacher-row lookup so Admin/Super Admin can actually use the role they're
  authorized for (or narrow the `@Roles()` decorator to match reality).

---

## 16. Open Questions Requiring Manual Verification

- Per-field `class-validator` decorator coverage on every DTO — the global `ValidationPipe` is confirmed
  registered; not every individual DTO file was opened.
- Actual green test runs — this audit read the test files and confirmed real, DB-backed assertions, but
  did not execute `npm test`/`flutter test`/builds itself, and no CI exists to have already done so.
- Whether any deployed environment exists anywhere outside this repo (no deployment config of any kind was
  found; treated as "none exists yet").

---

## 17. What Is the True Functional Maturity of This MVP Today?

Two separate questions collapse into one number here, and they pull in opposite directions. **Engineering
quality of the shipped slice is high** — real RBAC, a genuinely enforced isolation boundary, a schema
that's been iterated on for correctness, and a test discipline unusual for a two-day-old codebase.
**Breadth against the stated MVP scope is low** — of 78 audited capabilities, 26 (33%) are confirmed
working end-to-end with no caveats, 38 (49%) are either entirely absent or exist only as an unused schema
table, and the remainder are partial, weak, or stubbed — including two items that looked confirmed at a
glance but turned out, once traced end to end, to be a role-gated bug (Admin/Super-Admin attendance
marking) and mock data (the Admin dashboard).

### Overall functional maturity: 36/100

Blends 33% full-completion breadth with the shipped slice's high build quality — not a precise metric, a
judgment call.

Read plainly: this is **a well-built foundation for roughly a third of an MVP**, not an MVP that's
"basically done." Four verticals (auth/isolation, attendance, timetable-read, diary+circulars) could
plausibly survive a very narrow pilot today if fees, messaging, leave, and every admin CRUD screen were
explicitly out of scope for that pilot's first weeks. As a claim that this repository delivers the MVP
defined in `MVP-Plan-V3.md`, it does not yet — Sprints 7 through 12 of the document's own six-sprint-
remaining plan are still ahead, and `PROJECT-STATUS.md` says so itself, clearly, if read past the
checkmarks.

---

*Compiled by static source review of `github.com/zainknoman/SchoolPortal` at commit `1e74697` against
`docs/Seedsapk/MVP-Plan-V3.md`. No code was executed; no vulnerabilities were exploited. Scope: baseline
verification only — no feature roadmap proposed.*
