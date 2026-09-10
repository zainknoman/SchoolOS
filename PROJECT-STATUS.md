# SEEDS Digital Platform — Project Status

Living checklist. Update this file (don't just report progress in chat) whenever a feature lands
or scope changes. Spec source: `Seeds/apk/MVP-Plan-V3.md` (validated MVP plan) → `plan/docs/FEATURES.txt`
(FEAT-001..014, full detail).

**Architecture:** one NestJS+Prisma backend, two clients — a Vue staff console (Teacher + Admin/
Accounts, role-gated, one app) and a Flutter parent app. Public website refresh and a parent web
portal are separate, lower-priority tracks (see Deferred below), not part of this build.

Repo: https://github.com/zainknoman/SchoolPortal

---

## Sprint 1 — Foundation ✅ DONE

- [x] **FEAT-001** — Prisma schema (all Tier-1+2 entities), migrations, seed script
      (school, 2 campuses, class/section, teacher, admin, student, 2 linked parents)
- [x] **FEAT-002** — Auth + RBAC: login (email/GR-number + password), JWT access+refresh, argon2
      hashing, account lockout after 5 failed attempts, server-enforced `@Roles()`/`@Public()` guards
- [x] **FEAT-003** — Multi-campus + multi-child data model, `/api/v1/me/children` (parent-isolation
      verified by e2e test — a parent can never see another parent's child)
- [x] Backend hardening: CORS enabled, global `ValidationPipe` (DTOs actually enforced)

## Sprint 2 — Staff console + parent app shells ✅ DONE

- [x] **FEAT-004** — Staff console (Vue): login screen, role-gated shell (Teacher vs Admin/
      Accounts — nav items absent from the DOM per role, not CSS-hidden), router guards, session
      persistence, logout
- [x] **FEAT-005** — Parent app (Flutter): login screen, secure session (`flutter_secure_storage`),
      multi-child switcher wired to the real `/me/children` endpoint, router guards, bottom nav
      shell (Home/Calendar/Notifications/Messages/Fees/More placeholders)
- [x] Design system (ui-ux-pro-max, curated) applied to both clients — Plus Jakarta Sans,
      navy/blue-accent palette, one consistent brand (`staff-console/design-system/seeds-staff-console/MASTER.md`)

## Sprint 3-4 — Timetable + Attendance ✅ DONE

- [x] **FEAT-006** — Timetable: `GET /students/:id/timetable` (ownership-checked) + `POST
      /timetable` (Admin/Super Admin only); parent-app Calendar tab lists day/period/time/subject/
      teacher/room
- [x] **FEAT-007** — Attendance: `POST /attendance` (TEACHER/Admin/Super Admin only — a PARENT
      token is rejected outright, e2e-verified) writes an AuditLog row every time; `GET
      /students/:id/attendance?month=` returns today's status + a monthly day list + a summary
      (holiday-excluded attendance %); staff-console Teacher gets a real attendance-marking screen
      (section → roster → per-student status → save); parent-app Calendar tab shows it all
- [x] New shared `StudentAccessService` (parent-isolation check) + `GET /sections` /
      `GET /sections/:id/students` (staff-only, needed so the staff console can pick who to mark)
- Verified: 31 backend unit + 13 e2e, 14 staff-console, 12 parent-app tests — all passing, all
  three lint/type-check/build clean

## Dev environment note (2026-08-27)

- [x] Fixed: local dev seed (`backend/prisma/seed.ts`) created school/campus/class/section/teacher/
      admin/student/parents but never a Timetable or Attendance row (gap left over from FEAT-001;
      Sprint 3-4 added those features but never touched the seed script) — parent-app Calendar tab
      and any timetable/attendance query against a freshly seeded `dev.db` was correctly empty, not
      broken. Seed now also creates a Mon-Fri/6-period timetable for section 3A and 10 weekdays of
      attendance for the seeded student. Re-seed with `npx prisma migrate deploy` +
      `npm run prisma:seed` after deleting `dev.db` to pick this up in an existing local checkout.
- Reminder: none of backend (`npm run start:dev`, :3000), staff-console (`npm run dev`, :5173), or
  parent-app (`flutter run -d chrome`, needs `D:\dev\flutter\bin` on PATH) auto-start — a "blank app"
  is almost always one of these three not running, check that before assuming a code bug.
- Reminder (2026-08-28): `backend/dev.db` is git-ignored, so each git worktree (and the main
  checkout) has its own separate SQLite file — merging a branch that added Prisma migrations does
  NOT apply them to the main checkout's `dev.db`, and the Prisma Client there stays stale until
  `npx prisma generate` runs against the merged schema. After merging any branch with schema
  changes, run `npx prisma generate` then `npx prisma migrate deploy` (or delete `dev.db` and
  redo migrate+seed from scratch, per the Sprint 3-4 note above) in the checkout you'll actually
  run the app from.

## Sprint 5-6 — Diary + Circulars ✅ DONE

- [x] **FEAT-008** — Diary/homework: per-subject entries, attachments, due dates, correct Urdu RTL
      rendering (no auto-translation) — teacher/admin-authored (`POST /diary` accepts
      TEACHER/SCHOOL_ADMIN/SUPER_ADMIN), section-scoped, staff-console compose screen + parent-app
      Diary sub-tab (3rd tab of the Calendar screen)
- [x] **FEAT-009** — Circulars: school/section scope, attachments, read/unread tracking (delivered
      vs read counts visible to admin) — staff-console publish screen (Admin/Super Admin) + parent-app
      Circulars tab (fills the Notifications bottom-nav slot, unread badge)
- [x] New shared Files module (`POST/GET /files/:id`, local-disk storage behind a swappable
      `STORAGE_ADAPTER` token — S3 swap later is a one-file change) and Urdu RTL/font-detection
      helpers (`detectDirection`/`DirectionalText`, one implementation per client, pure Unicode
      script detection, no translation)
- Verified: 15 backend unit suites/53 tests + 5 e2e suites/21 tests, 7 staff-console files/24
  tests, parent-app 20/20 tests — all passing on both the feature branch and after merge to main;
  lint/type-check clean on both clients
- Follow-up (tracked, not blocking, deferred from the final review): no orphaned-file cleanup when
  an entry is re-posted or a create fails post-upload; `Circular` school-wide fan-out and staff file
  access have no school/campus boundary (fine today — single-school system — but will need one
  before a second school is onboarded). (The upload size/type-filter gap and the global
  `?access_token=` scope gap named here originally were closed by the Security Hardening Pass,
  2026-09-05 — see above.)
- [x] Fixed (2026-08-28): `/teacher/diary` and `/admin/circulars` routed straight to `DiaryView.vue`/
      `CircularsView.vue`, skipping the `AppShell` wrapper every other route uses (see
      `TeacherHomeView.vue` wrapping `AttendanceView.vue`) — so navigating into either screen made
      the entire sidebar nav and logout button disappear, with no way back except the browser's
      back button. Added `DiaryPageView.vue`/`CircularsPageView.vue` thin wrappers, matching the
      existing pattern, and repointed the router at them. Caught during manual post-merge browser
      testing, not by any automated test (the view specs mount the view directly, without a
      router/shell, so this class of bug won't show up in `npm test` — worth a browser smoke-test
      pass after any new route lands, not just unit/e2e coverage).

## Sprint 6.5 — Data Model Correction ✅ DONE

- [x] Added `Enrollment` (student ↔ campus/section/academic-session, dated) — replaces
      `Student.campusId`/`sectionId` direct fields. Fixes a real bug: `Diary`/`Timetable`/`Sections`/
      `Circulars`/`Me` all resolved a student's section by reading the *current* placement, so a
      mid-year section transfer would have silently rewritten what a parent saw for past months
      (most visibly in Diary's month view). New shared `EnrollmentService` (same pattern as
      `StudentAccessService`) is now the one place every module resolves this.
- [x] `FeePayment` now allocates across vouchers via `FeePaymentAllocation` instead of a 1:1
      `feeVoucherId` tie — done ahead of `FEAT-012` (Fees, not yet built) so that feature isn't
      built against a shape that can't represent a lump-sum or partial payment.
- [x] `Student → Attendance/FeeVoucher/LeaveRequest` changed from `onDelete: Cascade` to
      `Restrict` — deleting a student can no longer silently wipe their attendance/fee/leave
      history.
- Scope note: did **not** adopt multi-tenancy/RLS or a full accounting ledger
  (Invoice/Refund/Reconciliation) — this project is a single-school platform per
  `docs/Seedsapk/MVP-Plan-V3.md`, not multi-tenant SaaS; see
  `docs/Plan-Ideas/Feature-Chatgpt-CodeValidateFEAT5-6.txt` for the full analysis this sprint
  addresses (and what it deliberately doesn't).
- Found and fixed along the way (not anticipated when this sprint was planned): `FilesAccessService`
  also depended on the removed `Section.students` relation (a sixth consumer the original plan
  missed) — fixed to resolve via active `Enrollment`, same as the five originally-planned consumers.
  `EnrollmentService.getEnrollmentForDate`'s single-point-in-time query broke Diary's month view in
  the common case (any enrollment that didn't start exactly on the 1st of the queried month) — widened
  to an overlap-window query, backward-compatible for every other caller.
- Follow-up (tracked, not blocking): `Section/Class/Campus → Timetable/DiaryEntry/Circular` are
  still `onDelete: Cascade` — lower urgency than the financial/attendance-compliance tables fixed
  here, revisit before a second school/campus is onboarded. `StudentAccessService`'s staff-role
  free-pass (any `TEACHER`/`SCHOOL_ADMIN`/`ACCOUNTS`/`SUPER_ADMIN` can access any student) is
  unchanged — fine for one campus's staff, worth scoping if multi-campus staff restriction becomes
  a real need. `MeService.getChildrenForUser` assumes every student has exactly one ACTIVE
  enrollment at all times and will throw an unhandled error otherwise — currently unreachable (no
  code path creates a student with zero active enrollments yet), but will need revisiting once a
  student-transfer workflow is built. `timetable-attendance.e2e-spec.ts`'s own self-healing
  pre-flight block (the pattern the other e2e specs now follow) clears stale students without first
  clearing their `Attendance` rows — since `Attendance.student` is now `Restrict`, that delete can
  silently fail (swallowed by `.catch`), leaving a crashed run's fixtures un-recoverable on the next
  attempt; worth updating it to match `cascade-delete-restrictions.e2e-spec.ts`'s more thorough
  pre-flight (clear `Attendance`/`LeaveRequest`/`FeeVoucher` per stale student before the student
  itself). A student who transfers section mid-month currently gets
  `getEnrollmentForDate`'s newer enrollment for that whole straddling month in Diary (correct before
  and after the transfer month, wrong only for the transfer month itself) — same footing as the
  `MeService` gap above: unreachable until a transfer workflow exists, revisit then.
  `FeePaymentAllocation.feePayment` is `onDelete: Restrict` while its sibling `Receipt.feePayment` is
  `Cascade` — the two children of the same `FeePayment` disagree on delete policy; decide the right
  one before `FEAT-012` is built, not after. The `Enrollment` model has no backfill path from the old
  `Student.campusId`/`sectionId` fields — safe today since nothing is deployed and no pilot database
  exists, but if a seeded pilot ever does, it needs a manual backfill before this migration runs
  against it.

## UI Refresh — Wireframe-driven Design Pass (2026-08-28/29) ✅ DONE

- [x] Four `docs/wireframe/` mockups (OwnerDashboard, FeeReconciliation, TeacherMarkAttendance,
      ParentHome) used for layout/UX only — restyled onto the existing SEEDS token system (navy/blue,
      Plus Jakarta Sans, no new brand/font/icon library), per
      `docs/superpowers/specs/2026-08-28-wireframe-css-refresh-design.md`. Two parallel
      implementation plans, each independently executed via subagent-driven-development:
      `docs/superpowers/plans/2026-08-28-staff-console-ui-refresh.md` and
      `2026-08-28-parent-app-ui-refresh.md`.
- [x] **staff-console**: AppShell chrome (Dashboard nav link, notification bell, role-initials
      avatar, active-nav highlighting); Dashboard rebuilt from a placeholder into real stat
      cards/trends chart/alerts panel; Attendance roster rebuilt from a dropdown-per-student table
      into a segmented Present/Absent/Late control (+Leave/Holiday overflow) with a sticky submit
      footer — the one screen here still wired to the real backend; new Fee Reconciliation Queue
      view (`FeesView.vue`) built against local mock data, since FEAT-012 doesn't exist yet — isolated
      behind one function so wiring the real endpoint later is a data-layer swap, not a rewrite.
- [x] **parent-app**: new Home tab (greeting, child card, real attendance-% stat, static
      Fees/Results placeholders, announcements) replacing a placeholder; Calendar tab's Timetable
      sub-tab reworked into a 7-day weekly grid (period chips per day, including empty days);
      Attendance/Diary sub-tabs card-wrapped.
- [x] Both final whole-branch reviews caught real defects narrower per-task review couldn't see:
      staff-console's Dashboard chart used `var(--...)` in SVG presentation attributes (invisible in
      real browsers — attributes don't resolve CSS custom properties, only `style` bindings do);
      parent-app's Home stat grid used `childAspectRatio` (device-width-dependent — broken on every
      real phone, only green in the 800×600 test harness), fixed to a fixed `mainAxisExtent`. Both
      fixed and re-reviewed clean before merge.
- Verified: staff-console 63/63 tests, `npm run build` (type-check + build) clean; parent-app
  27/27 tests, `flutter analyze` clean (2 pre-existing info lints in untouched `auth_state.dart`
  aside). Both pushed to `origin/main`.
- Follow-up (tracked, not blocking): a repo-wide `dart format` page-width mismatch in parent-app
  predates this pass entirely (confirmed via git-history baseline) — either add a
  `formatter: page_width:` entry to `analysis_options.yaml` or run a dedicated repo-wide reformat
  task. An accessibility pass (aria-pressed on segmented controls, aria-expanded on overflow menus,
  an accessible name on the Dashboard chart) is worth doing as one dedicated task across the ~5
  screens touched here rather than patched piecemeal. `AppShell`'s `isAdmin` shows the Circulars nav
  link to the `ACCOUNTS` role, but `/admin/circulars` requires `SCHOOL_ADMIN`/`SUPER_ADMIN` — an
  accounts user clicking it silently bounces to `/admin`; pre-existing, found during final review,
  not fixed here.

## Sprint 7-8 — Messages + Notifications ✅ DONE

- [x] **FEAT-010** — Messages: scoped inbox (Parent → Class Teacher / Admin / Accounts / Principal
      only, server-enforced via `@Roles('PARENT')` on create + per-row party checks on reply/read),
      staff-console `MessagesView.vue` (list/search/thread/reply, routed for Teacher and
      Admin/Accounts) and parent-app `MessagesTab` (list/compose/thread, Class Teacher requires a
      child picker, Admin/Accounts/Principal don't).
- [x] **FEAT-011** — Notifications: in-app notification center backing both clients
      (`GET/POST /api/v1/notifications`), staff-console bell dropdown + parent-app modal sheet,
      deep-links to the right screen (diary/circular/message) with unread badges. Real push
      delivery is stubbed behind a swappable `PushAdapter` (logging/no-op) — no Firebase project
      exists yet, tracked below under Environment / one-time setup, same as before this sprint.
- New backend Messages + Notifications modules (`Conversation`/`Message`/`Notification` models,
  `NotificationsService.notify()` write-then-swallow-push contract), one Prisma migration.
- Built via subagent-driven-development: 11 tasks (backend Tasks 1-5, staff-console Tasks 6-8,
  parent-app Tasks 9-11), each with its own implementer + task review; 3 fix rounds during
  per-task review (a parent-student ownership check the plan omitted from conversation creation;
  a double-toolbar bug from two Flutter views nesting their own `Scaffold`/`AppBar` inside
  `HomeShell`'s single one; a diary notification landing on Calendar's Timetable sub-tab instead
  of Diary). A final whole-branch review then caught 4 more cross-task issues no per-task review
  could see (fixed): the spec's mandated search box on `MessagesView.vue` never got built despite
  the API already supporting it; both notification bells silently ate the user's tap on a failed
  mark-read instead of still navigating; a whitespace-only staff reply could reach the DB; and
  staff-console's notification routing could silently bounce a user to an unrelated page when a
  notification's type didn't match their role.
- Verified: 19 backend unit suites/77 tests + 7 e2e suites/30 tests, 15 staff-console files/71
  tests, parent-app 32/32 tests — all passing on the merged `main`, migration applied and Prisma
  Client regenerated in this checkout, both clients' build/analyze clean.
- Follow-ups (tracked, not blocking, surfaced by the final review — none are regressions, all
  pre-existing or deliberately narrowed scope):
  - **Fixed 2026-09-05 (see Security Hardening Pass section above).** `auth.module.ts`'s
    `JwtModule.register(...)` used to read `process.env.JWT_ACCESS_SECRET` before
    `ConfigModule.forRoot()` populated it (import-hoisting order) — a real sign/verify
    secret-mismatch race on a cold process boot. Pre-dated this sprint (`auth.module.ts` last
    touched Sprint 1), reproduced independently during e2e test-writing.
  - Notification fan-out (`CircularsService.publish`, `DiaryService.create`) does one concurrent
    Prisma write per recipient instead of a batched `createMany` — fine at this sprint's scale,
    will need a `NotificationsService.notifyMany()` helper before a large circular fan-out
    (hundreds of parents) is realistic.
  - Two spec-vs-plan narrowings accepted as-is this sprint: `notification.read` writes no
    `AuditLog` row (spec named it, low value/high volume for a read-marker); conversation search
    (`?q=`) matches participant name only, not message bodies (spec named both, low urgency at
    current per-parent conversation counts).
  - `ConversationsService.markRead`'s non-party-rejection path has no dedicated unit test (only
    `reply`/`getById` are tested for that guard) — same low-risk category, add opportunistically.
  - Minor UX gaps, not blocking: no keyboard access on staff-console's conversation list items; a
    parent-app child-switcher edge case can leak a "open on Diary" sub-tab choice onto a
    newly-selected child; two consecutive taps on the same notification type don't reliably
    re-navigate.

## Sprint 7-8 Follow-ups + Timetable Management (2026-08-30/31) ✅ DONE

- [x] **Messages/Notifications polish** (post-merge, surfaced by live testing): each message now
      shows its sender's display name and a formatted timestamp (`ConversationsService.getById`
      resolves `senderName` per party); tapping a message notification opens the specific
      conversation directly in both clients (`?conversationId=` query param in staff-console,
      `MessagesTab.initialConversationId` in parent-app) instead of just landing on the list/tab;
      principal is now a dedicated `principal@seeds.edu.pk` account (`SCHOOL_ADMIN` + `isPrincipal`),
      separate from `admin@seeds.edu.pk`, so both are independently testable.
- [x] **Seed data**: 3 classes/sections now exist (3A/4B/5C, split across both campuses), each with
      its own class teacher (`teacher@`/`teacher2@`/`teacher3@`) and a full 30-period timetable +
      10 days of attendance + a diary entry. Parent B's 3 children (Eshaal/Ibrahim/Hania) are split
      one per section, for multi-class-teacher Messages testing.
- [x] **Attendance fix**: the Teacher's Attendance screen showed a blank roster every time it was
      reopened, even when that day was already marked — `markAttendance` was correctly upserting,
      the screen just never read it back. New `GET /api/v1/sections/:id/attendance?date=`
      pre-fills the roster from what's already marked.
- [x] **Timetable management screen** (`/admin/timetable`, Admin/Super Admin only) — closes the
      "no admin UI, seed-only" gap left open since Sprint 3-4/FEAT-006. Backend gained the missing
      `PATCH`/`DELETE /api/v1/timetable/:id` (only `create` existed before) and a new `GET`/`PUT
      /api/v1/sections/:id/timetable` pair (list, and an atomic bulk replace); new `GET /api/v1/
      teachers` (Admin/Super Admin) for the teacher-picker dropdowns. All writes audit-logged,
      matching the rest of the app's convention.
- [x] **Grid composer** — the screen's bulk-editing mode: set periods/day + working days once, get
      an empty Mon-Sat × N grid (periods across as columns, days down as rows — matches the parent
      app's own Calendar tab convention), fill each cell via subject/teacher dropdowns, save the
      whole week in one click via the bulk-replace endpoint. Reopening it on a section that
      already has entries pre-fills the grid (review-and-replace, not a blind overwrite) and
      auto-detects any day already running different times, marking it custom automatically. Each
      day can independently opt into its own per-period times (`Custom times` toggle, seeded from
      the shared defaults) — e.g. a Friday that finishes at 12:30 while the rest of the week runs
      the normal schedule — and a read-only "Break" column between every pair of periods shows the
      computed gap in minutes, derived from each day's own effective times.
- Verified: backend 20/20 suites + 89/89 unit tests (e2e passes 30/30 in isolation — see follow-up
  below), staff-console 16/16 files + 96/96 tests, both client builds clean. The Timetable screen's
  full CRUD + grid composer flow (add/edit/delete/bulk-save, resize, per-day override, break
  display) was smoke-tested live in the browser end to end, including a real render bug caught and
  fixed mid-session (`<td>` with `display: flex` breaks out of table-cell column layout — correct
  in the DOM/accessibility tree, visibly broken on screen; fixed by moving the flex styling to an
  inner `<div>`).
- Follow-up (tracked, not blocking, found this session): `backend/test/jest-e2e.json` points e2e
  tests at the same `dev.db` the local dev server uses (`DATABASE_URL=file:./dev.db`, no separate
  test database) — running e2e while the dev server is up causes SQLite lock-contention timeouts,
  and e2e fixture data (visible as `DC Teacher`/`MN Teacher`/`TTA Teacher` and stray timetable rows
  after a run that didn't reach its own cleanup) leaks into the dev environment. Give e2e its own
  SQLite file (e.g. `file:./test.db`) as a follow-up.

## Sprint 9-10 — Fees + Leave ✅ DONE

- [x] **FEAT-012** — Fees: backend `FeeStructuresService`/`FeeVouchersService`/`FeePaymentsService`/
      `FeesPdfService` (`backend/src/fees/`) — server-computed voucher amounts (never a stored or
      client-supplied total), voucher/receipt PDFs via pdfkit, in-app payment behind a swappable
      `PaymentGatewayAdapter` (stubbed JazzCash/EasyPaisa, one-file swap later); staff-console
      `FeeManagementView.vue` (issuance + student ledger, routed at `/admin/fees`); parent-app
      `fees_tab.dart` (voucher list/detail, stub checkout, payment history/receipts).
- [x] **FEAT-013** — Leave applications: backend `LeaveService`/`LeaveController`
      (`backend/src/leave/`) — submit/list/approve/reject, approving writes `LEAVE` attendance rows
      (skipping days already `HOLIDAY`) so it surfaces on the existing attendance calendar with no
      new rendering path; staff-console Leave approval queue (`LeaveManagementView.vue`, routed at
      `/admin/leave`, `SCHOOL_ADMIN`/`SUPER_ADMIN` only); parent-app `leave_screen.dart` (submit +
      status, under the More tab).
- Notable fixes caught during this sprint's own task/final review (not regressions on prior
  sprints):
  - A plan-mandated arity fix — `StubPaymentGatewayAdapter.confirm()` didn't accept the
    `gatewayReference` parameter its interface declared — was caught only by `tsc` (`npm run
    build`'s type-check step), not `jest` (ts-jest runs with `isolatedModules: true`, so
    interface-conformance errors don't fail a unit-test run).
  - `FeePaymentsService.confirm()`'s failed-payment branch used to delete the
    `FeePaymentAllocation` row outright, which orphaned the payment (ownership resolution reads
    `payment.allocations[0]?.feeVoucher.studentId`) — a retried `confirm()` or a receipt PDF
    request 404'd with a misleading "Payment not found" instead of the real "Cannot confirm a
    payment in status failed". Fixed by zeroing the allocation's amount instead of deleting it,
    keeping the FK (and ownership resolution) intact.
  - `LeaveService.approve()` used to write `status: 'approved'` before validating the
    class-teacher precondition; a precondition failure after that write permanently stranded the
    request at `approved` with no attendance rows and no way to re-approve/reject/retry it (`decide()`
    only allows `pending → X` once). Fixed by resolving every precondition before any write, then
    wrapping the status update + attendance upserts + audit log in one `$transaction`, mirroring
    `FeePaymentsService.confirm()`'s established pattern.
  - Most significant: a Critical regression where both new admin screens (`/admin/fees`,
    `/admin/leave`) routed their views directly, with no `AppShell` in the render tree — reproducing
    the exact Sprint 5-6 Diary/Circulars incident (sidebar nav and logout button disappear entirely).
    Fixed with the same `FeeManagementPageView.vue`/`LeaveManagementPageView.vue` thin-wrapper
    pattern already established for Circulars/Timetable/Messages.
  - The final whole-branch review also caught and removed dead code: the pre-FEAT-012
    bank-reconciliation mock screen (`FeesView.vue` + `mockFees.ts`, left in place unrouted when
    `/admin/fees` was repointed at the real feature) had become fully orphaned — deleted along with
    their spec files.
- Verified: backend 115 unit + 41 e2e tests (26 + 9 suites), staff-console 100 tests (16 files),
  parent-app 38 tests — all passing, all three lint/type-check/build clean.
- Follow-up (tracked, not blocking): `FeePaymentsService.pay()` eagerly allocates a payment before
  `confirm()` runs; if `confirm()` is never called (client crash, network partition), the voucher
  becomes permanently un-payable with no recovery path. Currently unreachable — the stub gateway is
  synchronous and always succeeds — but will need a reconciliation/expiry mechanism before a real
  JazzCash/EasyPaisa integration lands. Also still open from prior sprints (unchanged here): the
  remaining Sprint 5-6 file-storage hardening items (orphaned-file cleanup, `Circular`/staff-file
  school-boundary) — the upload size/type-filter gap, the global `?access_token=` scope gap, and
  the Sprint 7-8 `JwtModule` secret-load-order race, also named here originally, were closed by the
  Security Hardening Pass (2026-09-05, see above).

## Org Structure CRUD (2026-09-04/05) ✅ DONE

Not an original MVP feature — requested directly during live testing of Sprint 9-10 ("remove
hard coded mock data from all app, and create CRUD for Students, Parents, Teachers, Classes
etc"), decomposed during brainstorming into two sub-projects by dependency order. This is the
first: School/Campus/AcademicSession/Class/Section. People CRUD (Student/Teacher/Parent) is
deliberately deferred to its own later spec — it needs a harder design pass (creating a person
also means creating a `User` login account: password handling, role assignment).

- [x] **School/Campus/AcademicSession/Class CRUD** — four new backend modules
      (`backend/src/school/`, `campus/`, `academic-session/`, `class/`), each `SUPER_ADMIN`-only,
      audit-logged, following the existing single-entity-module shape. `AcademicSession` enforces a
      single-active-session invariant (creating/activating one deactivates whichever was previously
      active, in one transaction) — `FeeVouchersService` already assumed this elsewhere.
- [x] **Section write operations** — the existing (previously read-only) `sections/` module gained
      `POST`/`PATCH`/`DELETE`, plus class-teacher assignment on create/update.
- [x] **Cascade-delete safety fix** — `Timetable.section`/`DiaryEntry.section`/`Circular.section`
      flipped from `Cascade` to `Restrict` (matching the `Student→Attendance/FeeVoucher/LeaveRequest`
      precedent from Sprint 6.5): deleting a Section with real Timetable/Diary/Circular history now
      fails with a clear error instead of silently wiping it. A shared `assertDeletable` helper
      translates the underlying Prisma FK violation into a 400 for every entity's delete route.
- [x] **staff-console admin screens** — one bespoke management screen per entity (School/Campus/
      AcademicSession/Class/Section), all `/admin/...`, following `TimetableView.vue`'s table +
      inline-edit-row pattern. Replaced the long-inert "Classes" nav placeholder with a real,
      role-gated route.
- [x] **Dashboard live data** — `staff-console/src/lib/mockDashboard.ts` (hardcoded fake numbers)
      deleted; `AdminHomeView.vue` now calls a real `GET /api/v1/admin/dashboard-summary` aggregate
      endpoint (student count, today's attendance %, this month's fees collected/outstanding, a
      7-day trend, and the 5 most recent real `Notification` rows as "alerts"). Two cards with no
      real data behind them ("At-risk students", "Teachers absent") were dropped rather than backed
      by invented business rules.
- Notable fixes caught during this feature's own review process (not regressions on prior
  sprints):
  - A Section's class teacher could be assigned but never un-assigned through the UI — clearing
    the dropdown sent no key at all (`'' || undefined` is dropped by `JSON.stringify`) instead of
    an explicit `null`, so the backend's "only update what's present" check silently no-op'd.
    Caught by the final whole-branch review; fixed to send `null`.
  - Two pre-existing, unrelated e2e specs (`diary-circulars`, `timetable-attendance`) had their own
    cleanup silently broken by the cascade-delete safety fix above — both relied on the old cascade
    behavior to clean up a fixture Section via a School delete in `afterAll`; that delete now
    silently no-ops against the new `Restrict`, so every run after the first leaked fixture data
    and failed on a unique-constraint collision. Only surfaced by running the full test suite twice
    in a row during the finishing-a-development-branch verification step — neither spec was in this
    feature's diff, so no task-level review saw it. Fixed by explicitly clearing the
    now-`Restrict`ed rows before the school delete, in both `afterAll` and each spec's self-healing
    pre-flight.
- Verified: backend 159 unit + 45 e2e tests (32 + 10 suites, e2e stable across repeated runs),
  staff-console 126 tests (20 files) — all passing, both clients' lint/type-check/build clean.
- Follow-up (tracked, not blocking): the previously-open "no floor on active `AcademicSession`s" gap
  and the "`CampusService.create()` (and by the same logic Class's/Section's create paths) returns a
  raw 500 on an invalid parent ID instead of a clean 400" gap were both closed by the Security
  Hardening Pass (2026-09-05, see above). Still open from prior sprints (unchanged here): the
  Sprint 9-10 stuck-pending-payment risk and the remaining Sprint 5-6 file-storage hardening items
  (orphaned-file cleanup, `Circular`/staff-file school-boundary).

## People CRUD — Students, Parents, Teachers (2026-09-05) ✅ DONE

Second sub-project of the "remove hard coded mock data, add CRUD for core entities" request,
deferred from Org Structure CRUD above for its own design pass (creating a Teacher/Parent also
means creating a `User` login account — password handling, role assignment — unlike Org
Structure's plain reference-data rows). All three entities previously existed only via
`prisma/seed.ts`; now have real create/edit/delete in both the backend and staff-console.

- [x] **Shared `assertCreatable` helper** (`backend/src/common/prisma-create-guard.ts`) — the
      create-side companion to `assertDeletable`, translates a Prisma unique-constraint violation
      (P2002 — e.g. a duplicate `User.identifier`) into a clean 400 instead of a raw 500.
- [x] **Teacher CRUD** (`backend/src/teacher/`, singular — distinct from the pre-existing
      read-only plural `backend/src/teachers/` picker module, untouched) — creates `User`
      (role `TEACHER`) + `Teacher` in one `$transaction`; `identifier`/role not updatable after
      creation.
- [x] **Parent CRUD** (`backend/src/parent/`) — creates `User` (role `PARENT`) + `ParentProfile`
      in one `$transaction`. Its creation logic (`createParentWithUser`) is a standalone function,
      not a class method, specifically so Student creation's inline-new-parent branch can reuse
      the exact same code path rather than duplicating it.
- [x] **Student CRUD** (`backend/src/student/`) — the most involved module: one combined
      `$transaction` creates the `Student`, its `Enrollment` (client supplies only `sectionId` —
      `campusId` is always derived server-side from `section.class.campusId`, `academicSessionId`
      from the currently-active session, matching `FeeVouchersService.issue`'s precedent), and a
      `StudentParent` link — either to an existing `parentProfileId` or, via a "+ New Parent"
      toggle, a freshly created Parent through the same `createParentWithUser` reused from the
      Parent module. `update()` covers name/GR-number only — no re-enrollment/transfer workflow
      exists yet (tracked as a deliberate, pre-existing gap since Sprint 6.5).
- [x] **staff-console screens** — `TeacherManagementView.vue`/`ParentManagementView.vue`/
      `StudentManagementView.vue` (all `/admin/...`, wrapped in `AppShell`), following the
      established table + inline-add-form + inline-edit-row + `window.confirm`-delete pattern.
      Student's form has the parent-linking toggle: an existing-parent `<select>` (sourced from
      the new `GET /admin/parents`) or, behind "+ New Parent", the same fields Parent's own create
      form uses. Replaced the long-inert `nav-teachers`/`nav-parents`/`nav-students` placeholders
      with real role-gated routes, gated by a new `canManagePeople` computed (`SCHOOL_ADMIN`/
      `SUPER_ADMIN` — broader than Org Structure's `SUPER_ADMIN`-only `canManageOrgStructure`).
- Notable fixes caught during this feature's own review process (not regressions on prior work):
  - `ParentService.delete()`/`TeacherService.delete()` originally did two sequential
    non-transactional Prisma deletes (profile then `User`) — a mid-failure could orphan the
    `User` row with no rollback and skip the audit log. Fixed by wrapping both in `$transaction`,
    matching the create paths' own pattern.
  - `StudentService.create()`'s existing-`parentProfileId` branch never validated the id actually
    existed before linking — a bad id threw an unhandled Prisma P2003 (500) instead of a clean
    400. Fixed with an explicit existence check, following this codebase's own precedent
    (`FeeVouchersService.issue` validates referenced ids before use).
  - Caught only by the final whole-branch review (no single task's diff contained both sides):
    the inline-new-parent branch of Student creation provisioned a real login account but wrote
    no audit-log row for it (only `student.create` was logged, unlike the same account created
    via `POST /admin/parents`) — fixed to also write a `parent.create` row, inside the same
    transaction. Also found while fixing that: an explicit `null` on one of
    `parentProfileId`/`newParent` (with the other omitted) slipped past the "exactly one" XOR
    check (`!== undefined` doesn't catch `null`) and crashed instead of returning a 400 — fixed
    to treat `null` and omitted identically.
- Verified: backend 37 unit + 11 e2e suites (198 + 50 tests), staff-console 23 files/146 tests —
  all passing on the merged `main`, both clients' type-check/build clean.
- Follow-up (tracked, not blocking, deferred from the final review): `argon2.hash` runs inside the
  open write `$transaction` on all three create paths — plan-prescribed, blocks other SQLite
  writers for the hash's duration, trivially hoistable later if it becomes a real bottleneck.
  `staff-console/src/lib/api.ts`'s `createTeacher`/`createParent` are typed `Promise<void>` while
  `createStudent` is typed `Promise<StudentAdminSummary>` — all three backends actually return a
  summary; cosmetic typing drift, no runtime defect. All three management screens' add-forms
  return silently (no error message) when a required field is left blank (e.g. no section chosen)
  — a UX polish item, not a correctness bug. `parent.module.ts` exports `ParentService`, which
  nothing outside the module imports (a leftover from before `createParentWithUser` existed as a
  standalone function).

## Security Hardening Pass (2026-09-05) ✅ DONE

Not tied to a single MVP feature — closes five specific, previously-tracked "not blocking" follow-up
items from Sprint 7-8, Sprint 5-6, and Org Structure CRUD (see `docs/superpowers/plans/
2026-09-05-security-hardening-pass.md`). Scoped to pure code fixes needing no external
infrastructure — the SQLite→PostgreSQL, JWT-secret-rotation, S3, Firebase, and Play Store items
under Sprint 11-12 below are unrelated and still open.

- [x] **JWT access-token secret-load-order race** (Sprint 7-8 follow-up) — `AuthModule` read
      `process.env.JWT_ACCESS_SECRET` at import time, before `ConfigModule.forRoot()` loaded `.env`,
      while `JwtStrategy` read the same var later at provider-instantiation time — a real
      sign/verify secret mismatch if the two `.env` values ever diverged from the shared fallback
      default. Fixed via `JwtModule.registerAsync({ imports: [ConfigModule], inject: [ConfigService],
      useFactory })`, matching the recommendation already on file.
- [x] **`?access_token=` JWT-in-query fallback scoped to specific download routes** (Sprint 5-6
      follow-up) — previously accepted as a bearer-token substitute on every route (leakable via
      server logs, browser history, `Referer` headers); now only authenticates the three routes that
      actually need it as plain download links: `GET /api/v1/files/:id`, `GET
      /api/v1/fee-vouchers/:id/pdf`, and `GET /api/v1/fee-payments/:id/receipt.pdf`.
- [x] **Upload hardening** (Sprint 5-6 follow-up) — `POST /api/v1/files` gained a 10MB size limit and
      a blocklist of executable/script extensions (`.exe`/`.bat`/`.ps1`/etc.); the download path's
      existing forced-attachment + `nosniff` headers were left untouched.
- [x] **FK-validation guard on Campus/Class/Section create+update** (Org Structure CRUD follow-up) —
      new shared `assertValidReferences` helper (mirrors `assertCreatable`/`assertDeletable`,
      translates a Prisma P2003 into a 400) wired into all three entities' `create()` and Section's
      `update()`; an invalid `schoolId`/`campusId`/`academicSessionId`/`classTeacherId` now returns a
      clean 400 instead of a raw 500.
- [x] **AcademicSession floor** (Org Structure CRUD follow-up) — `update()`/`delete()` now refuse to
      deactivate or delete the sole active session, closing the gap `FeeVouchersService` and the
      Dashboard's `studentsTotal` both silently assumed could never happen.
- Built via subagent-driven-development: 5 tasks, each with its own implementer + task review; 3 of
  the 5 needed one fix round apiece, all for the same root cause — the plan's own illustrative code
  blocks weren't Prettier-formatted, so copying them verbatim failed this repo's lint gate (no
  behavior was ever wrong, only formatting). The final whole-branch review caught two more: Tasks 1
  and 2 had the identical un-caught lint gap (fixed), and this file update itself was the plan's own
  missed final-verification step (also fixed, here). A third gap — the `?access_token=` fix
  initially only covered `/api/v1/files/`, missing two fee-PDF download routes
  (`fee-vouchers/:id/pdf`, `fee-payments/:id/receipt.pdf`) that both frontends actually use the same
  way — surfaced only when running the full e2e suite during the finishing-a-development-branch
  verification step, past every per-task and whole-branch review. Fixed in two passes: the first
  attempt widened by resource prefix (`/api/v1/fee-vouchers/`), which a review caught also silently
  admitting the fallback on two unrelated payment-mutation endpoints
  (`fee-vouchers/:id/pay`, `fee-payments/:id/confirm`); the second attempt matched each download
  route by exact regex instead.
- Verified: backend unit suite green (all suites, all touched services individually re-verified),
  `org-structure.e2e-spec.ts` and `diary-circulars.e2e-spec.ts` green including new coverage for
  every fix above, run twice consecutively per this project's own "run e2e twice" convention,
  `npm run build` (type-check) clean, `npm run lint` clean on every line this pass touched
  (pre-existing CRLF/Prettier debt elsewhere in the repo is untouched and out of scope).
- Follow-up (tracked, not blocking, deferred from the final review): `AcademicSessionService`'s new
  floor-guard message says "the only active session" but the check is really just `existing.isActive`
  — correct given the API-path single-active-session invariant, but several e2e fixtures create
  multi-active states via direct Prisma writes in their own `beforeAll`, so the message can overclaim
  in a DB state the API itself would never produce; low real risk, wording only. `POST /api/v1/files`
  bounds `fileSize` but not multer's `files`/`fields` counts (staff-only route, low urgency). The
  extension blocklist doesn't cover every renderable type (`.html`/`.svg`/`.hta`/etc.) — deliberate
  blocklist-not-allowlist design, and the download path's forced-attachment + `nosniff` headers
  already close the render vector. `org-structure.e2e-spec.ts`'s new floor test has no `afterAll`
  cleanup fallback (its siblings do) — purely defensive, both consecutive test runs passed clean.
  Still open from prior sprints (unchanged here): the Sprint 5-6 orphaned-file-cleanup gap and the
  `Circular`/staff-file school-boundary gap (fine today, single-school system), and the Sprint 9-10
  stuck-pending-payment risk.

## Sprint A — Stabilization I: Session, CI, Data ✅ DONE

Not tied to a single MVP feature — the roadmap's first Tier-0 stabilization sprint, closing the
"login only ever fails hard" and "no CI" gaps identified as risks before a pilot. Built via
subagent-driven-development in worktree `sprint-a-stabilization`: 8 code tasks (backend Tasks 1-3,
staff-console Tasks 4-5, parent-app Tasks 6-7, CI Task 8), each with its own implementer + task
review, plus this closing verification task.

- [x] **Boot-time JWT-secret fail-fast** — new shared `resolveAccessTokenSecret()`
      (`backend/src/auth/jwt-secret.ts`), used by both `AuthModule`'s `JwtModule.registerAsync` and
      `JwtStrategy`, throws at boot if `JWT_ACCESS_SECRET` is unset outside `development`/`test`
      instead of silently signing/verifying with the shared `dev-only-change-me-access` fallback —
      closes a real "ships with a guessable default secret" risk before any staging/production
      deploy.
- [x] **Refresh-token loop with rotation-on-use** — new `POST /api/v1/auth/refresh`
      (`AuthService.refresh()`), backed by a hashed (`sha256`), single-use `RefreshToken` row per
      session: presenting a token revokes it immediately, then issues a fresh access+refresh pair
      via the same `issueSession()` `login()` already used — so a replayed/stolen refresh token is
      rejected on its second use even though the legitimate caller already has a new pair. e2e
      coverage for both the happy path (refresh-then-retry with the new access token) and the
      rotation-on-reuse rejection.
- [x] **staff-console retry-on-401 interceptor** — `api.refresh()` + `authStore.refreshSession()`
      (single-flight-guarded, so several requests expiring around the same moment share one
      in-flight refresh instead of each racing their own) wired into a new fetch interceptor
      (`installFetchInterceptor`, `main.ts`): on a 401, attempt exactly one silent
      refresh-and-retry before forcing logout, matching the spec's client-session contract.
- [x] **parent-app retry-on-401 interceptor** — the same contract on the Flutter side:
      `ApiClient.refresh()` + `AuthState.refreshSession()`, consumed by a new
      `RefreshingHttpClient` (`lib/src/api/refreshing_http_client.dart`) wrapping `http.Client` —
      one silent refresh-and-retry on a 401, then forced logout, wired into `main.dart`'s client
      construction.
- [x] **CI pipeline** — new `.github/workflows/ci.yml`, three jobs (`backend`/`staff-console`/
      `parent-app`) on every PR and push to `main`: backend runs
      `lint`/`build`/`test`/`test:e2e`, staff-console runs `lint`/`test`/`build`, parent-app runs
      `flutter analyze`/`flutter test`. Codifies exactly the commands each of Tasks 1-7 already
      verified locally, run against a real GitHub Actions checkout rather than a developer machine.
- Notable finding (from this task's own closing verification, not a defect in Tasks 1-8): running
  the full combined suite for the first time surfaced that `backend/test/jest-e2e.json`'s default
  Jest hook timeout (5000ms) is too tight for a full `AppModule` bootstrap (Nest DI container +
  Prisma/`better-sqlite3` connect) under Jest's default parallel workers — 11 suites, each booting
  its own app instance concurrently — and that those parallel workers also contend for locks on the
  one shared SQLite `dev.db` file, so `npm run test:e2e` as literally specified failed
  deterministically (8-10 of 11 suites) purely on `beforeAll` timeouts, reproduced identically on
  pre-Sprint-A `main`. **Root-caused and fixed in the post-review fix wave**: `jest-e2e.json` now
  sets `"maxWorkers": 1` and `"testTimeout": 30000`, so the bare `npm run test:e2e` command is
  reliable on its own — no `--runInBand` workaround needed. This sharpens (doesn't replace) the
  Sprint 7-8 follow-up that first flagged `dev.db` lock contention; giving e2e its own SQLite file
  remains a possible future improvement but is no longer required for a trustworthy signal.
- Verified (real numbers, this closing run): backend 225 unit tests (40 suites) all passing,
  `npm run build` (type-check) clean; backend e2e 57 tests (11 suites) passing, run twice
  back-to-back with the bare `npm run test:e2e` command (both runs clean, no fixture leakage, no
  `--runInBand` needed once `maxWorkers`/`testTimeout` were set); staff-console 191 tests (27 files)
  passing, `npm run lint` and `npm run build` both clean; parent-app 62/62 tests passing,
  `flutter analyze` reports 3 info-level `prefer_initializing_formals` style suggestions (0
  errors/warnings — 2 pre-existing in `auth_state.dart`, 1 new in this sprint's own
  `refreshing_http_client.dart`, same non-blocking category as before). Backend's `npm run lint`
  itself still reports the same pre-existing, repo-wide Prettier/formatting debt already named in
  the Security Hardening Pass section above (682 errors — confirmed byte-for-byte identical in count
  and file list to pre-Sprint-A `main`'s 672, aside from 10 new errors confined to the 3 files this
  sprint touched/added under `src/auth/`, following the same never-`prettier --write`d convention as
  the rest of the codebase); those 10 were fixed in the post-review fix wave (see below), leaving the
  672 pre-existing errors untouched and out of scope for a session-layer/CI sprint.
- Follow-up (tracked, not blocking): the CI workflow has been created and committed
  (`.github/workflows/ci.yml`) but **has not yet been pushed to GitHub** — pushing it and confirming
  the workflow actually runs green on GitHub Actions, and then turning on branch protection
  requiring it before merge, are both still open and require the repo owner's action. The backend
  `lint` step in that workflow is deliberately `continue-on-error: true`, non-blocking pending the
  672-error pre-existing Prettier/CRLF backlog (see Security Hardening Pass section above); flip it
  to blocking once that backlog is cleared — staff-console's `lint` step stays blocking, it's clean.
  Still open from prior sprints (unchanged here): everything under Sprint 11-12 below.
- Follow-up (tracked, not blocking, found in the final whole-branch review): `AuthService.issueSession()`
  mints a new `RefreshToken` row on every refresh, not just every login — with the 15-minute
  access-token TTL, one actively-used session writes roughly a new row every 15 minutes (~96/day for
  a single active user), and nothing ever prunes revoked or expired rows. Not a problem at pilot
  scale, but worth tracking before it becomes one — e.g. a `deleteMany` on expired/revoked rows
  inside `issueSession()`, or a scheduled sweep, whenever `auth/` is next touched.
- Follow-up (tracked, not blocking, found in the final whole-branch review): the retry-on-401
  interceptors added by this sprint (staff-console's `installFetchInterceptor`, parent-app's
  `RefreshingHttpClient`) don't cover every authenticated request. `voucherPdfUrl`/`receiptPdfUrl` on
  both clients build `?access_token=<token>` URLs opened via `<a href>` (staff-console) or
  `url_launcher` (parent-app) — neither ever passes through `window.fetch` or `RefreshingHttpClient`,
  so a user whose access token has expired and whose first action after being idle is clicking one of
  those links gets a hard 401 with no silent refresh. This is a real, if narrow, gap in this sprint's
  own "zero user-visible interruption" goal for that one traffic class — a known limitation, not a
  closed item.

## Sprint B — Stabilization II: Database & Hardening ✅ DONE

Roadmap's second Tier-0 stabilization sprint (`docs/superpowers/plans/2026-09-08-sprint-b-stabilization-ii.md`),
closing the remaining Repo-Audit security gaps appropriate-for-dev-only plus the SQLite→PostgreSQL
migration. Merged to `main` 2026-09-09 (`b762240..fc53413`), 4 tasks: onDelete-policy fix, CORS
allow-list, rate limiting, Postgres migration.

- [x] **`FeePaymentAllocation`/`Receipt` `onDelete` policy resolved** — `Receipt.feePayment` changed
      from `Cascade` to `Restrict`, matching its sibling `FeePaymentAllocation.feePayment` (both are
      now un-droppable via a parent `FeePayment` delete, same precedent as the Sprint 6.5
      `Student → Attendance/FeeVoucher/LeaveRequest` fix).
- [x] **CORS scoped to a known allow-list** — new `backend/src/config/cors.config.ts`
      (`CORS_ORIGINS` env var, defaults to staff-console's `http://localhost:5173`), replacing the
      previous bare `app.enableCors()` (reflected any Origin).
- [x] **Rate limiting** — global `@nestjs/throttler` guard (100 req/min general) plus a stricter
      5/min override on `POST /auth/login`; test-only limits relaxed to 1000 so existing e2e suites
      that log in repeatedly aren't broken.
- [x] **Postgres migration** — `schema.prisma` datasource switched to `postgresql`, `PrismaService`/
      `seed.ts` now construct `PrismaClient` via `@prisma/adapter-pg`, SQLite-era migrations replaced
      with one generated Postgres baseline, CI's backend job gained a `postgres` service container.
      Local dev now requires a reachable Postgres instance (`backend/.env`'s `DATABASE_URL`) — SQLite
      is no longer a fallback.
- Verified: full backend unit suite (237 tests) and `npm run build` clean on 2026-09-10; the
  pre-existing upload-limit e2e tests (Sprint B's "Upload limits" item, actually landed in the
  2026-09-05 Security Hardening Pass) reverified passing, confirming that checklist item was already
  satisfied rather than newly done here.
- Follow-up (tracked, not blocking): `docs/superpowers/plans/2026-09-08-sprint-b-stabilization-ii.md`'s
  own "Final verification" step of confirming CI is green on GitHub Actions has not been done from
  this session — verified locally only; someone with repo access should confirm the Actions run.

## Sprint C — Attendance & Access Bug Fixes + Verification Pass ⏳ IN PROGRESS

- [x] **Parent-app login unreachable from local dev preview (found 2026-09-10, not an originally
      planned Sprint C item)** — the parent app is Flutter-mobile in production (not subject to
      CORS), but this dev machine has no Android emulator and no Windows C++ toolchain, so
      `flutter run -d chrome` (a real browser origin, a fresh port every run) is the only way to
      preview it locally, and Sprint B's new CORS allow-list didn't include it. Every request from
      the parent-app preview failed as a generic, unhelpful `TypeError: Failed to fetch` in the
      browser console, surfacing in the UI as "Something went wrong. Please try again." on login —
      looked like an auth bug, wasn't one (curl against the same endpoint with the same credentials
      always succeeded). Fixed: `buildCorsOriginOption()` (`backend/src/config/cors.config.ts`)
      accepts any `localhost`/`127.0.0.1` origin, any port, in development/test only; staging/
      production keep the strict `CORS_ORIGINS` allow-list unchanged. Verified live in a real browser
      session against both `parent-a@seeds.edu.pk` and `parent-b@seeds.edu.pk` (real JWTs issued, Home
      dashboard rendered with real seeded data). New unit coverage in `cors.config.spec.ts` (10 tests,
      up from 4); full backend suite (237 tests) and `npm run build` clean.
- Found during the same verification pass (not fixed yet, tracked as a Sprint C follow-up): 
  `FeeVouchersService`'s status computation (`voucher.dueDate < new Date()`) flags a voucher
  `overdue` from the moment its due date starts (any time past midnight on the due date), not once
  it's actually passed — a voucher due "today" already reads as overdue. Caught by
  `fees.e2e-spec.ts` failing when run on the voucher's own due date.
- [ ] Fix Admin/Super-Admin attendance-marking bug (`Teacher.findUnique` role fallthrough) — root
      cause confirmed: `AttendanceService.markAttendance()` requires a `Teacher` row for the acting
      user (`Attendance.markedById` is a required FK to `Teacher.id`), which a `SCHOOL_ADMIN`/
      `SUPER_ADMIN` account doesn't have, so the `@Roles()` guard authorizes them but the service then
      404s. `LeaveService.approve()` already solved the identical FK problem for admin-approved leave
      by attributing the write to the student's section's `classTeacherId` instead of the acting
      admin — same fix applies here. Not yet implemented.
- [x] Fix Circulars nav-role bug (`AppShell.vue`'s `isAdmin` condition) — already closed by the
      2026-09-07 Staff Console Shell Redesign's `canManageCirculars` computed (ahead of this sprint
      being scoped); confirmed via code read, no new work needed.
- [ ] Verify Fees/Messaging enforce the same scoping rigor already proven on Attendance/Diary — not
      started.

## Sprint 11-12 — Hardening + Pilot ⏳ PENDING

- [x] **FEAT-014 (offline-caching slice only)** — parent-app's Timetable/Attendance/Diary/Circulars
      screens now cache their last-successful response (`shared_preferences`, new `DataCache`/
      `loadWithCache` helpers in `lib/src/cache/`) and show a "Last updated: …" line
      (`LastUpdatedBanner`) instead of going blank when a refresh fails — cache is read and shown
      immediately, then a live fetch silently replaces it, or on failure the cached data + old
      timestamp stays on screen. Cache keys are scoped per student (+ month for Attendance/Diary);
      Circulars uses one global key (single-parent-per-device assumption, acceptable at MVP scale).
      Added `toJson()` to `TimetableEntry`/`AttendanceReport`/`DiaryEntry`/`CircularSummary` (+
      nested types) to make caching possible. staff-console intentionally untouched (desktop,
      always-connected, not in scope). Verified: 16 new tests (data cache, cached-load flow,
      timestamp formatting, model JSON round-trips, 3 widget-level offline-fallback tests) — 54/54
      parent-app tests passing, `flutter analyze` clean (same 2 pre-existing info lints as before);
      manually smoke-tested in a real running app (`flutter run -d web-server` + backend), logged in
      as `parent-a@seeds.edu.pk`, confirmed the banner renders on all four screens.
- [ ] **FEAT-014 (remaining)** — security review pass, Play Store submission (own developer
      account, not sideloaded)
- [ ] Switch Prisma datasource from SQLite (local dev) to PostgreSQL before any staging/production
      deploy
- [ ] Real secrets: rotate the dev-only JWT secrets in `backend/.env` before deploy
- [ ] Wire real S3-compatible storage (currently unwired — needed once FEAT-008/009/012 attachments
      land)
- [ ] Real Firebase project for FCM (currently unwired)
- [ ] Pilot rollout: one campus/class, 20-50 parents, before full cutover

## Staff Console Shell Redesign (2026-09-07) ✅ DONE

Not tied to an MVP feature — a UI/UX polish pass requested directly ("style looks good, implement
it for all interfaces... for super admin, admin, teacher, parent etc"), decomposed at brainstorming
time into two independent sub-projects by codebase. This is the first: the Vue staff console's
shared shell. The Flutter parent app gets its own later spec/plan (not started).

Spec: `docs/superpowers/specs/2026-09-07-staff-console-shell-redesign-design.md`. Plan:
`docs/superpowers/plans/2026-09-07-staff-console-shell-redesign.md`. Built via
subagent-driven-development in worktree `staff-console-shell-redesign`: 6 code tasks, each with its
own implementer + task review, plus this manual verification task.

- [x] **Design tokens** (`base.css`) — dark-mode variants for every existing token (both
      `prefers-color-scheme: dark` and an explicit `[data-theme]` override, so a manual toggle wins
      over the OS default in either direction), new semantic status tokens
      (`--color-status-success/warning/critical/info/neutral` + tint pairs, deliberately separate
      from `--color-accent`), `--font-family-mono` (IBM Plex Mono, for GR numbers/PKR amounts/dates
      in tables), and a global low-specificity `input,select,textarea{background;color}` default —
      closes a real gap where every existing view's form controls had no explicit
      background/color and would have rendered as unstyled white boxes the moment dark mode went
      live.
- [x] **Route meta titles** — every route in `router/index.ts` now carries `meta.title`, driving the
      new breadcrumb.
- [x] **Grouped, role-gated sidebar nav** (`AppShell.vue`) — Overview/People/Org Structure/
      Operations/Communication. Only the **People** (`v-if="canManagePeople"`) and **Org Structure**
      (`v-if="canManageOrgStructure"`) group wrappers are actually `v-if`-gated so an empty group
      never renders its label; **Overview**, **Operations**, and **Communication** render
      unconditionally because their anchor item (Dashboard/Fees/Messages, respectively) carries no
      further role gate today, so those labels never end up empty in practice. Fixes a real
      pre-existing bug: the nav used to show Circulars and Timetable to `ACCOUNTS`, but both routes'
      guards require `SCHOOL_ADMIN`/`SUPER_ADMIN` only, silently bouncing that role back to `/admin`
      on click — new `canManageCirculars`/`canManageTimetable` computeds close the gap.
- [x] **Breadcrumb**, **`CommandPalette.vue`** (new component — `Ctrl/Cmd+K`, role-gated "Go to" +
      "Actions" lists sourced from the same computeds the sidebar uses, Actions deep-link into a
      specific form field via a `?focus=<id>` query param — same low-tech convention
      `MessagesView.vue` already used for `?conversationId=`), **two-tier notifications** (numeric
      badge for unread `message`-type only, a dot for unread `diary`/`circular`, derived
      client-side from the existing `NotificationSummary.type` — no backend change), and a
      **persisted light/dark theme toggle** (`localStorage`, wrapped in try/catch, defaults to
      unset/OS-following until the user picks explicitly).
- [x] New `useFocusTarget()` composable (`lib/useFocusTarget.ts`) wired into
      `StudentManagementView`/`FeeManagementView`/`CircularsView` for the command palette's
      "Actions" to focus the right input after navigating.
- Notable fixes caught during this pass's own review process (not regressions on prior work):
  - Adding `useFocusTarget()` (which calls `useRoute()`) to the three views above broke their
    existing spec files, none of which previously mounted with a router. Fixed by adding a
    router-in-scope mount helper to each, mirroring the existing precedent in
    `MessagesView.spec.ts` (which has the same `useRoute()` need) — mount setup only, no
    assertions changed.
  - The plan's own literal `AppShell.spec.ts` text had two defects, both caught during
    implementation: an imported-but-never-called `beforeEach`, and a genuine test-order bug where
    a "no unread notifications" test inherited a leftover mocked value from an earlier test in the
    same file (no reset between them) — fixed with an `afterEach` mock reset.
- Verified: 180/180 staff-console tests passing (26 files), `npm run lint` and `npm run build`
  (type-check) both clean, manually smoke-tested in a real running app (`npm run start:dev` +
  `npm run dev`) logged in as `admin@seeds.edu.pk` (SCHOOL_ADMIN) and `accounts@seeds.edu.pk`
  (ACCOUNTS) — confirmed grouped nav, breadcrumb, command palette (open via button and via
  `Ctrl+K`, filtered search, navigation), two-tier notification badge/dot, light↔dark toggle
  (including persistence across a reload), and the Circulars/Timetable role-gating fix, all
  against real seeded data.
- Final whole-branch review (opus) caught what the per-task reviews couldn't see: `AppShell.vue`
  loaded the persisted theme only inside its own `<script setup>`, but `LoginView.vue` is the one
  route not wrapped in `AppShell` — an explicit theme choice was silently ignored on a cold load of
  the pre-login screen (the manual smoke-test's "including...on the pre-login screen" claim in an
  earlier draft of this section didn't actually hold for a cold load — logging out after toggling
  inside the app looked correct but wasn't the same test). Fixed by extracting the theme logic to
  a new `lib/theme.ts` and booting it from `main.ts` before `app.mount`, so every route — including
  `/login` — gets the right theme before first paint; `AppShell.vue` now imports the same functions
  instead of redefining them. Also fixed in the same pass: the `CommandPalette.spec.ts` unused
  `vi` import that had been deferred through two task reviews as Minor (it actually left
  `npm run lint` red — closed here, not deferred further), and a `PROJECT-STATUS.md` line that
  overstated which nav-group wrappers are `v-if`-gated (only People and Org Structure actually are;
  Overview/Operations/Communication render unconditionally today because their anchor item —
  Dashboard/Fees/Messages — carries no further role gate).
- Follow-up (tracked, not blocking): fixing the lint gate above surfaced a separate, pre-existing
  `eslint` error in `TimetableView.vue:206` (`periodsRange` unused) that predates this pass
  entirely (confirmed via git history) and that no task here touches — it had been masked because
  `npm run lint`'s `oxlint`-then-`eslint` pipeline stops at the first failure, and oxlint was
  failing first until this pass fixed it. Out of scope for this branch; worth a one-line fix
  whenever `TimetableView.vue` is next touched. The per-screen pass this shell redesign's spec also
  scoped (empty/loading/error state machine + a shared `StatusPill.vue` across all 14 admin/teacher
  views) was deliberately not started here — it's its own later plan, not a gap in this one. Also
  flagged by the final review but explicitly deferred to that later plan rather than fixed here:
  `?focus=` round-trip test coverage (the query-param contract between `AppShell.vue`'s command
  palette and the three views it deep-links into is currently verified by inspection, not a test),
  and exporting `CommandPalette.vue`'s `GoToItem`/`ActionItem` interfaces instead of `AppShell.vue`
  redeclaring them structurally-identical copies (same one-source-of-truth treatment already given
  to `IconName`).

## Deferred (explicitly out of this build's scope)

- [ ] Parent **web** portal (Phase 2 — same backend, zero rework, just not built alongside mobile)
- [ ] Public website refresh (separate, lower-priority track)
- [ ] WhatsApp integration
- [ ] Results/report cards, exam timetable, PTM booking, homework tracker, event RSVP (Release 2+
      per `MVP-Plan-V3.md`)
- [ ] Payroll, full accounting ERP, library, transport GPS, RFID/biometric, canteen/wallet, AI
      tutor, complex LMS, online exams, inventory/HR — never in scope for this MVP

## Environment / one-time setup

- [x] PostgreSQL — installed and running locally (`localhost:5432`, native Windows service, not
      Docker — `docker` itself is still unavailable on this machine) as of Sprint B (2026-09-09/10);
      `backend/.env`'s `DATABASE_URL` points at it. SQLite is no longer a valid fallback (see Sprint
      B above).
- [x] Flutter SDK installed (3.47.1), Android SDK cmdline-tools installed, `flutter doctor` green
      except Visual Studio (unrelated — only needed for native Windows desktop builds)
- [x] Windows Developer Mode enabled (needed for Flutter plugin builds)
- [ ] Android emulator/AVD — cmdline-tools/SDK are installed but no emulator has been created yet;
      needed for a real on-device preview (web preview works today via `flutter run -d chrome`)
- [ ] Visual Studio + "Desktop development with C++" — only if a native Windows desktop build is
      ever wanted; not required for Android/web

---

**Next step:** **Sprint A** and **Sprint B** (Stabilization I and II) are both done (see above). What's
left from Sprint A is not code: pushing `.github/workflows/ci.yml` to GitHub, confirming it runs
green, and turning on branch protection requiring it, all need the repo owner's action (see Sprint
A's Follow-up above); Sprint B similarly needs someone with repo access to confirm its CI run is
green on GitHub Actions (see Sprint B's Follow-up above). **Sprint C — Attendance & Access Bug Fixes
+ Verification Pass** is in progress (see above): the parent-app-login CORS gap found while starting
this sprint is fixed and verified; the Circulars nav-role bug turned out already fixed by an earlier
sprint; still open are the Admin/Super-Admin attendance-marking fix (root cause confirmed, fix
designed, not yet implemented), the Fees/Messaging scoping verification pass, and the
newly-found fee-voucher-due-date-off-by-one bug — see
`docs/Plan-Ideas/SchoolPortal-PostMVP-Roadmap-2026-09-08.md` for the implementation plan. Separately,
the Staff Console Shell Redesign is done (see above); its own spec scoped a follow-up per-screen pass
(empty/loading/error state machine + a shared `StatusPill.vue` across all 14 admin/teacher views)
that has not been started — spec/plan not yet written. The parent-app (Flutter) half of the
original design-refresh request also has not been started — its own spec is next after that.
**Sprint 11-12 — Hardening + Pilot** remains open — FEAT-014's offline-caching slice is done, and the
Prisma-to-PostgreSQL switch this section used to list is now done (Sprint B, above); remaining:
FEAT-014's Play Store submission, rotate the dev-only JWT secrets in `backend/.env` (Sprint A's
boot-time fail-fast now
refuses to boot on the dev-only secret outside dev/test, so a stale secret is caught immediately
rather than silently deployed — the rotation itself still needs doing), wire real S3-compatible
storage and a real Firebase project for FCM, then a pilot rollout (one campus/class, 20-50 parents)
before full cutover. A broader security review pass beyond the five items the Security Hardening
Pass already closed is worth doing before that pilot, but nothing specific is queued.
