# SchoolPortal — Post-MVP Roadmap, Sprints & Implementation Plan

**Compiled 2026-09-08.** Fifth and final document in the `docs/Plan-Ideas/` series. Synthesizes:

1. `SchoolPortal-Repo-Audit-2026-09-08.md` — functional audit at commit `1e74697` (36/100 maturity).
2. `SchoolPortal-Global-Competitor-Research-2026-09-08.md` — ten global school-platform leaders.
3. `SchoolPortal-Gap-Analysis-Feature-Prioritization-2026-09-08.md` — gap tiers, scored on the `1e74697` baseline.
4. `SchoolPortal-UIUX-Audit-Modernization-Roadmap-2026-09-08.md` — UI/UX audit at the **later** commit `988278a`.

No new research was performed. Every claim below traces to one of the four documents above.

---

## Implementation Checklist (living — updated on every completed task)

> Update this section every time a sprint or task from §4 ships — check a sprint's box once every
> item in its **Features** line has landed and been verified (not just merged); leave sub-items
> checked individually for partial progress within an in-flight sprint. Note the merge commit range
> and date next to a completed sprint. Last updated: **2026-09-13** (Sprint M — P0 test coverage,
> UI half — merged; Sprints N–Q remain sequenced below from the Master Validation Prompt audit — see
> `build/MASTER-PROMPT-TRACKER.md` for the per-item evidence).

- [x] **Sprint A — Stabilization I: Session, CI, Data** — merged to `main` 2026-09-08 (`988278a..7081595`)
  - [x] Working refresh-token loop with rotation-on-use — `POST /api/v1/auth/refresh`
  - [x] Boot-time fail-fast if `JWT_ACCESS_SECRET` is unset outside dev/test
  - [x] CI pipeline — backend unit+e2e, staff-console Vitest, Flutter test on every PR
  - Follow-ups opened (tracked in `PROJECT-STATUS.md`, not blocking): `RefreshToken` rows aren't
    pruned yet (unbounded growth over time); authenticated PDF download links (`?access_token=`
    URLs) bypass both clients' retry-on-401 interceptors; backend lint is non-blocking in CI
    pending a dedicated cleanup of ~672 pre-existing repo-wide Prettier/CRLF errors.
- [x] **Sprint B — Stabilization II: Database & Hardening** — merged to `main` 2026-09-09 (`b762240..fc53413`)
  - [x] Postgres migration (Prisma provider switch) — `schema.prisma` datasource is `postgresql`, `PrismaPg` adapter wired, CI runs a `postgres` service container
  - [x] Upload limits — size cap + MIME allowlist on `FileInterceptor` (landed earlier, in the 2026-09-05 Security Hardening Pass; reverified passing here)
  - [x] CORS scoped to known client origins (no longer wide-open) — `cors.config.ts`'s `CORS_ORIGINS` allow-list, extended 2026-09-10 (see Sprint C note) with a dev/test-only localhost carve-out
  - [x] Rate limiting (`@nestjs/throttler`) on auth + general routes — global `ThrottlerGuard` + a stricter 5/min override on `POST /auth/login`
  - [x] Resolve the `FeePaymentAllocation` vs `Receipt` `onDelete` policy disagreement — `Receipt.feePayment` is now `onDelete: Restrict`, matching its sibling
- [x] **Sprint C — Attendance & Access Bug Fixes + Verification Pass** — merged to `main` 2026-09-10 (`b487cee..14428ce`)
  - [x] Fix Admin/Super-Admin attendance-marking bug (`Teacher.findUnique` role fallthrough) — fixed via class-teacher attribution, mirroring `LeaveService.approve()`'s precedent; verified by e2e test and smoke-tested live against real seed data (`admin@seeds.edu.pk` marking Eshaal Sample present, visible to `parent-a@seeds.edu.pk`)
  - [x] Fix Circulars nav-role bug (`AppShell.vue`'s `isAdmin` condition) — already closed by the 2026-09-07 Staff Console Shell Redesign's `canManageCirculars` computed, ahead of this sprint being scoped; no new work needed
  - [x] Verify Fees/Messaging enforce the same scoping rigor already proven on Attendance/Diary — Fees already had full coverage; added the one missing Messaging test (a parent can't start a `CLASS_TEACHER` conversation using another parent's child's `studentId`) — passed on the first run, confirming the scoping was already correct
  - [x] **Found during Sprint C prep (2026-09-10), not originally listed:** parent-app login was unreachable from the only locally-previewable Flutter target (`flutter run -d chrome`, no Android emulator/Windows toolchain in this dev environment) — Sprint B's CORS allow-list didn't include the parent-app's dev-preview origin. Fixed: `buildCorsOriginOption()` accepts any `localhost`/`127.0.0.1` origin in development/test only; staging/production behavior (strict allow-list) is unchanged. Verified live against both `parent-a@seeds.edu.pk` and `parent-b@seeds.edu.pk`.
  - [x] **Found during Sprint C prep (2026-09-10), not originally listed:** `FeeVouchersService`'s status computation (`voucher.dueDate < new Date()`) marked a voucher `overdue` the instant its due date arrived (time-of-day is always past midnight), not after it passed. Fixed: compare against the start of today instead.
  - Plan: `docs/superpowers/plans/2026-09-10-sprint-c-attendance-access-bugfixes.md`. Verified: full backend suite green (239 unit tests, 64 e2e tests), `npm run build` clean.
  - **CI confirmed green on GitHub Actions (2026-09-10):** all three jobs (backend, staff-console,
    parent-app) pass against `main` at `2fcea2f` — closes the open "someone with repo access must
    confirm the Actions run" follow-up from both Sprint A and Sprint B. One earlier `parent-app` run
    hit a transient `curl` TLS handshake failure (exit 35) downloading the Flutter SDK from Google's
    CDN mid-download — not a workflow or code defect; the identical step succeeded on retry with the
    same 1.5GB download. Not worth a retry wrapper unless it recurs.
- [x] **Sprint D — Staff Console Component Extraction (UI Sprint 2)** — merged to `main` 2026-09-10 (`01fd167..d4e4e50`)
  - [x] `EntityTable.vue`, shared form-field component (`FormField.vue`), `Button.vue`, one themed `ConfirmDialog.vue` + a `useConfirm()` singleton queue — each with its own component spec
  - [x] Replace every remaining `window.confirm()` call — all 8 CRUD screens' delete guards, plus Timetable's delete/bulk-replace and Leave's reject (previously unconfirmed), now go through `useConfirm()`; a regression spec bans any `window.confirm` reference in `staff-console/src`
  - [x] Fix or remove the dead Teacher → Timetable nav link — removed (no real teacher-facing timetable view exists yet; Sprint I re-adds a real `RouterLink` once one ships); also fixed the breadcrumb `aria-label`/label mismatch the UI/UX Audit flagged
  - Plan: `docs/superpowers/plans/2026-09-10-sprint-d-component-extraction.md`. Verified: `npm run test` (33 files, 226 tests), `type-check`, and `lint` all green in `staff-console`; live-smoke-tested against real seed data (Super Admin role) — the new `ConfirmDialog` correctly guards a Student delete and surfaces the backend's real referential-integrity rejection ("Cannot delete this Student: other records still reference it.") with zero data loss.
- [x] **Sprint E — Payment Gateway & Local Rails (Phase 2)** — committed to `main` 2026-09-10/11
      (`325f752..1e82044`)
  - [x] `PaymentGateway` adapter interface + JazzCash/EasyPaisa implementation — built to public
    spec (JazzCash's confirmed field names + community-standard secure-hash algorithm; EasyPaisa's
    HMAC shape with its exact field list flagged `// TODO: confirm` in code) behind a new
    `PaymentGatewayAdapterFactoryImpl`, falling back to the existing stub in dev/test. **Not
    verified against a live sandbox** — no real merchant account exists; blocked on merchant
    onboarding lead time, not an engineering gap.
  - [x] PDF voucher generation — already shipped in Sprint 9-10, before this roadmap was compiled;
    re-verified only (live smoke test against real seed data), no new work needed.
  - [x] Cash/manual-payment reconciliation workflow — new staff-only `POST
    /fee-vouchers/:id/reconcile`, added to `FeeManagementView.vue`'s existing ledger.
  - [x] Webhook signature verification on the gateway callback endpoint — new `POST
    /api/v1/payments/webhook/:gateway`; also closed a real security hole found while building
    this: the prior flow let a parent's own client self-confirm its payment directly, which is now
    removed entirely (e2e-locked).
  - Verified: backend 278 unit + 70 e2e tests (twice consecutively), staff-console 227 tests,
    parent-app `flutter analyze`/`flutter test` clean, all three lint/build clean; live-smoke-tested
    against real seed data (voucher issue → cash reconcile → receipt PDF; voucher issue → parent
    pay → signed-webhook confirm → receipt PDF; unsigned webhook rejected; old confirm route 404s).
    Full detail: `build/PROJECT-STATUS.md`'s Sprint E section.
- [x] **Sprint F — Push Notifications, Both Clients (Phase 3)** — merged to `main` 2026-09-11
      (`daa53fe..65c88de`)
  - [x] `NotificationDispatchService` (backend, consumed by diary/circulars/messages write paths)
    — already existed as `NotificationsService` (built ahead of schedule in Sprint 7-8, discovered
    during this sprint's prep); this sprint added the real `FcmPushAdapter` behind its existing
    `PushAdapter` seam, auto-selected when `FIREBASE_PROJECT_ID`/`CLIENT_EMAIL`/`PRIVATE_KEY` are
    configured, falling back to the existing `LoggingPushAdapter` otherwise — same config-present-
    or-absent shape as JazzCash/EasyPaisa's stub fallback in Sprint E.
  - [x] FCM integration on Flutter (`firebase_messaging`/`firebase_core`) — added to
    `pubspec.yaml`; `PushTokenProvider`/`DeviceTokenRegistrar` wired into `HomeShell`, degrading
    gracefully to no-push (not a crash) since no real Firebase project exists yet
    (`lib/firebase_options.dart` is a placeholder, not `flutterfire configure`-generated).
    **Not verified against a real Firebase project or a physical/emulated Android device** — no
    Android emulator/Windows Flutter toolchain in this dev environment (same constraint noted in
    Sprint C prep), and no real Firebase project exists; blocked on Firebase project creation, not
    an engineering gap. Mirrors Sprint E's "not verified against a live sandbox" JazzCash/EasyPaisa
    precedent.
  - [x] `POST /me/device-tokens` registration endpoint — new, e2e-tested, upserts by token so a
    device moving between accounts (logout/login) doesn't leave a stale mapping.
  - [x] Interim foreground-resume polling stopgap — `HomeShell` re-fetches notification/circular
    counts on `AppLifecycleState.resumed`, shipped and tested independently of live FCM
    verification, per this item's own note that it "can ship independently of full FCM."
  - Also shipped, beyond the four listed items: tapped-push-notification deep linking, reusing the
    same type→tab mapping the in-app `NotificationsSheet` already used (background/foreground tap
    only — a terminated-state cold-start deep link via `getInitialMessage()` is a known, documented
    follow-up gap, not silently dropped).
  - Plan: `docs/superpowers/plans/2026-09-11-sprint-f-push-notifications.md`. Verified: backend 287
    unit + 73 e2e tests (`npm run build` clean, lint clean on every touched file), parent-app
    `flutter analyze` clean and all 77 tests passing (10/10 in `home_shell_test.dart`, including the
    3 new device-registration/resume-polling/push-tap cases). Two real bugs were caught and fixed
    during this verification pass: an e2e test harness gap (`test/me.e2e-spec.ts` never wired up
    `ValidationPipe`, so DTO validation was silently inert there) and a test-file structural bug
    (three new Flutter tests were nested inside an existing test's body instead of being siblings).
- [x] **Sprint G — Parent App Second-Pass UI Polish (UI Sprint 3)** — committed to `main` 2026-09-11
      (`bceade8..c8e6b89`)
  - [x] Parent-app dark theme (mirrors staff-console token values)
  - [x] Fix `HomeTab`'s hardcoded Fees/Results stat cards
  - [x] Thread `activeChildId` into `LeaveScreen` and Messages-compose
  - [x] Rename "Notifications" bottom-nav tab to "Circulars"
  - [x] Extend offline caching (`loadWithCache`) to Fees and Messages
  - Verified: `flutter analyze` clean, full `flutter test` suite green (86 tests). Three real bugs
    (a perpetual-spinner bug in `FeesTab`'s payment-history failure path, a test off-by-one, and a
    test assertion that didn't account for two stat cards failing under one mock) caught and fixed
    during verification — see `build/PROJECT-STATUS.md`'s Sprint G section for detail.
- [x] **Sprint H — Communication Depth: WhatsApp, SMS, Digest Bundling (Phase 4)** — merged to `main`
      2026-09-11 (`2937df2..02a6243`; closed out `32d6e26`)
  - [x] `WhatsAppChannel`/`SmsChannel` behind `NotificationDispatchService`
  - [x] Digest-style notification bundling (scheduled batch job)
  - [x] Per-user channel-preference setting
  - Verified: backend unit 308/308 + e2e 77/77, staff-console 227, parent-app 88 — all green. Not
    live-verified against a real WhatsApp Business/SMS sandbox (no credentials in this environment).
    Full detail: `build/PROJECT-STATUS.md`'s Sprint H section.
- [x] **Sprint I — Remaining Feature Gaps (Phase 5)** — committed to `main` 2026-09-11 (`32d6e26..0a2a558`)
  - [x] Report cards (static PDF upload/view)
  - [x] Calendar-wide `Holiday` model (replaces per-student-per-day pattern)
  - [x] Complaint/concern tracking
  - [x] Forgot-password flow
  - [x] Teacher's own timetable view (fixes the dead nav link from Sprint D)
  - [x] Bulk attendance-marking endpoint (`POST /attendance/bulk`)
  - [x] Timetable scheduling-conflict detection
  - Shipped as a single combined commit (`0a2a558`, feature work) plus a preceding fix for
    pre-existing test regressions (`b8fe38e`), not task-by-task. Verified 2026-09-11: full backend
    (308/308), staff-console (227/227) and parent-app (88/88) suites all green. **Known gap:** none
    of the five new backend modules this sprint added (`holidays`, `complaints`, `report-cards`, and
    `auth`'s `forgotPassword`/`resetPassword`, `attendance`'s bulk-mark endpoint, `timetable`'s
    conflict check) or their new staff-console/parent-app screens ship with their own dedicated
    unit/e2e tests yet — a tracked follow-up, not a blocker. Full detail:
    `build/PROJECT-STATUS.md`'s Sprint I/J/K section.
  - **Backend half of the test-coverage gap closed 2026-09-12** (`bb7bd14..67aa03b`, plan:
    `build/docs/superpowers/plans/2026-09-12-p0-test-coverage-backfill.md`) — dedicated unit/e2e
    coverage added for all five modules plus `forgotPassword`/`resetPassword`, bulk attendance, and
    timetable-conflict detection. Backend unit 309→360, e2e 79→97, all green, independently
    re-verified. **Still open:** the matching staff-console/parent-app UI test coverage — tracked as
    Sprint M below, not closed here.
  - **Gap closed 2026-09-11 (`ba0df6f..4c33451`):** report-card upload had only ever shipped for
    Admin (`ReportCardsView`), not Teacher, despite this sprint's own scope line saying "upload for
    staff, read for parent"; and the Teacher nav's Complaints link pointed at the generic admin
    `ComplaintsPageView` (a cross-student queue) instead of a section/student-scoped view. Added
    `TeacherReportCardsView`/`TeacherReportCardsPageView` (with its own spec) and
    `TeacherComplaintsView`/`TeacherComplaintsPageView` (with its own spec), re-pointed the Teacher
    nav, and extended `academic-sessions` read access to TEACHER/SCHOOL_ADMIN so a teacher can pick a
    session when uploading. Verified: backend unit 309/309, backend e2e 79/79, staff-console
    238/238, `vue-tsc` clean.
- [x] **Sprint J — Accessibility & Localization Scope Decision + Build-Out (Phase 6)** — committed to
      `main` 2026-09-11 (`32d6e26..0a2a558`, same combined commit as Sprint I/K)
  - [x] Command-palette focus trap + ARIA, skip-to-content link
  - [x] Flutter `Semantics`/tooltip sweep on icon-only buttons
  - [x] Localization scope decision (which chrome, which client) + first-phase translation — both
    clients (`vue-i18n` on staff-console, `flutter_localizations` on parent-app), chrome-only
    coverage, English/Urdu
  - [x] Responsive-shell scope decision — real collapsible/overlay sidebar below a mobile breakpoint
    (not a documented desktop-only call)
  - **Known gap:** the staff-console accessibility/i18n/sidebar additions (focus trap, ARIA, skip
    link, collapsible sidebar) have no dedicated new test cases of their own yet, though every
    pre-existing `AppShell.spec.ts` case still passes unmodified. Parent-app's side (theme/locale) *is*
    covered — `theme_controller_test.dart`, `text_direction_test.dart`. Full detail:
    `build/PROJECT-STATUS.md`'s Sprint I/J/K section.
- [x] **Sprint K — Differentiation Kickoff: AI Drafting + Predictive Analytics (Phase 7–8)** —
      committed to `main` 2026-09-11 (`32d6e26..0a2a558`, same combined commit as Sprint I/J)
  - [x] `AiDraftingService` — "Suggest draft" on circulars/diary compose (stub provider by default —
    no Anthropic API key in this environment)
  - [x] `AttendanceRiskService` — nightly-computed early-warning panel on the admin dashboard
  - **Known gap:** neither new backend module (`ai-drafting`, `attendance-risk`) nor the compose
    "Suggest draft" button/dashboard risk panel has dedicated test coverage yet. Full detail:
    `build/PROJECT-STATUS.md`'s Sprint I/J/K section.
- [x] **Sprint L — Cross-Tenant/Cross-Campus Access Boundary (Security)** — merged to `main` 2026-09-12
  - [x] Fixed `StudentAccessService.assertCanAccessStudent()` and new sibling `assertCanAccessSection()`
    — rewritten with one branch per role (`SUPER_ADMIN` unrestricted, `SCHOOL_ADMIN`/`ACCOUNTS` scoped
    to their own `User.schoolId`, `TEACHER` scoped to `Teacher.campusId`, `PARENT` unchanged link
    check). Scope grew mid-brainstorm at the user's explicit direction to include tenant (`schoolId`)
    scoping, not just campus — the product will be multi-tenant SaaS in the future.
  - [x] Found and fixed 8 previously-unguarded routes across 5 controllers (`attendance`, `diary`,
    `complaints`, `report-cards`, `sections`) — 4 were write paths (mark attendance, diary entry,
    complaint, report-card upload) with **zero** ownership check at all, not merely campus-blind.
  - [x] Two real regressions caught and fixed during implementation, not shipped: parent access was
    briefly made to depend on enrollment status (would have broken a real guarantee that a parent can
    see a withdrawn child's historical fee/diary/report-card records) — fixed by decoupling `PARENT`
    from enrollment resolution entirely; and two e2e-fixture audit gaps (a missing `campusId` on an
    HTTP test payload, missing `schoolId` on several `SCHOOL_ADMIN` fixtures) surfaced and were fixed
    proactively across affected files.
  - Spec: `build/docs/superpowers/specs/2026-09-12-cross-tenant-access-control-design.md`. Plan:
    `build/docs/superpowers/plans/2026-09-12-cross-tenant-access-control.md`. Executed via
    subagent-driven-development in an isolated worktree, 10 tasks, each independently reviewed.
    Verified: backend unit 369/369 (up from 360), e2e 105/105 (up from 97), staff-console 239/239 (up
    from 238), build clean, staff-console lint/type-check clean. Full detail:
    `build/PROJECT-STATUS.md`'s Sprint L section.
- [x] **Sprint M — P0 Test Coverage, UI Half** — merged to `main` 2026-09-13 (`b6092b8..eb6671d`)
  - [x] Staff-console spec coverage added for `HolidaysView` (4 tests), `ComplaintsQueueView` (3
    tests), `ReportCardsView` (4 tests), the "Suggest draft" button on both `DiaryView` and
    `CircularsView` (1 new test each), and the attendance-risk dashboard panel on `AdminHomeView` (3
    new tests, plus the 3 pre-existing tests updated with a default `getFlaggedStudents` mock).
    `*PageView.vue` wrappers (`HolidaysPageView`, `ComplaintsPageView`, `ReportCardsPageView`,
    `TeacherComplaintsPageView`, `TeacherReportCardsPageView`) confirmed zero-logic and deliberately
    left untested, per this codebase's existing convention.
  - [x] Parent-app spec coverage added for `complaints_screen.dart` and `report_cards_screen.dart` (3
    tests each).
  - **Caught mid-verification, not in the original plan:** the plan's own literal test code for
    `DiaryView.spec.ts`'s "Suggest draft" case had been committed with only the mock plumbing
    (`suggestDiaryDraft: vi.fn()` + its `mockReset()`) — the actual test case was missing from that
    commit. Found during the Task 9 full-suite re-verification pass and fixed in a follow-up commit
    (`4c03fd5`).
  - Closes the "Still open" line noted against Sprint I/J/K above and in
    `build/MASTER-PROMPT-TRACKER.md`.
  - Spec: `build/docs/superpowers/specs/2026-09-13-sprint-m-test-coverage-ui-design.md`. Plan:
    `build/docs/superpowers/plans/2026-09-13-sprint-m-test-coverage-ui.md`.
  - Verified: backend unit 373/373, backend e2e 111/111 (both unaffected by this sprint — no backend
    files touched), staff-console **255/255** (up from 239, +16 new tests), `vue-tsc` clean,
    parent-app `flutter analyze` clean, parent-app **94/94** (up from 88, +6 new tests). Full detail:
    `build/PROJECT-STATUS.md`'s Sprint M section.
- [ ] **Sprint N — Structured Gradebook (Phase 8, P1)**
  - [ ] Confirmed 2026-09-12: report cards are currently an uploaded PDF
    (`backend/src/report-cards/report-cards.service.ts:36-51`), not structured marks — no
    subjects/assessment-categories/weights/grade-calculation model exists anywhere in the schema or
    backend.
  - [ ] Design (in the spec, not guessed here): subjects, weighted assessment categories
    (assignments/quizzes/midterm/final), marks + max-marks entry, term, calculated final grade.
    Report cards should consume this structured data instead of (or alongside) the existing PDF
    upload path — decide during spec whether PDF upload is retained as a fallback or superseded.
  - Spec: TBD. Plan: TBD.
- [ ] **Sprint O — Admissions/Enrollment Pipeline (Phase 8 remainder, P1)**
  - [ ] Confirmed 2026-09-12: the existing `EnrollmentService` only reads which class/section an
    already-created student is enrolled in (`getCurrentEnrollment`/`getEnrollmentForDate`) — there is
    no applicant → application → review → approval/rejection → student-creation pipeline.
  - [ ] Extend the existing Enrollment module rather than building a parallel system — design during
    spec how an `Applicant`/`Application` model relates to the existing `Student`/`Class`/`Section`/
    `AcademicSession` models.
  - [ ] EMI-style fee installments (depends on Sprint E's payment gateway) — carried forward from the
    original Phase 8 remainder line; scope during this sprint's spec whether it's bundled here or
    split into its own sprint.
  - Spec: TBD. Plan: TBD.
- [ ] **Sprint P — Bulk Import/Export (Phase 8, P1)**
  - [ ] Confirmed 2026-09-12: no CSV/Excel import exists anywhere in the backend for
    Students/Parents/Teachers.
  - [ ] Design during spec: validation, duplicate detection, preview-before-import, safe transaction
    handling (no partial/corrupted imports), role authorization, audit logging — per the master
    validation prompt's explicit requirements for this feature.
  - Spec: TBD. Plan: TBD.
- [ ] **Sprint Q — StatusPill + Remaining Accessibility Follow-Through**
  - [ ] `StatusPill.vue` — confirmed 2026-09-12 still not implemented; the Staff Console Shell
    Redesign spec already scoped this (empty/loading/error state machine + shared `StatusPill.vue`
    across all 14 admin/teacher views) but it was never started. Use existing spec if still valid,
    otherwise refresh it.
  - [ ] Attendance segmented-control keyboard/focus/screen-reader audit and Dashboard chart
    accessible-name audit — not yet reviewed as of 2026-09-12.
  - Spec: reuse Staff Console Shell Redesign's existing follow-up scope if still accurate; otherwise
    TBD. Plan: TBD.
- **Blocked on external access, not schedulable as engineering work:** live sandbox verification of
  JazzCash/EasyPaisa (needs a real merchant account) and FCM/WhatsApp/SMS (needs a real Firebase
  project + WhatsApp Business/SMS gateway credentials). Re-check each the moment credentials exist;
  do not fabricate verification in the meantime.

---

## 0. A required reconciliation before anything else

The four source documents do not describe one static codebase — they describe two different points in
time, and the newer one materially changes what "next" means.

The Repo Audit and the Gap Analysis it builds on are both anchored to commit **`1e74697`**, where Fees,
Messaging, Leave, every admin CRUD screen, and the Admin dashboard were dead nav links, placeholder
strings, or 100%-mock UI. The Gap Analysis's Tier 1 "Commercial Readiness" list and its Top-10 list are
built entirely on that snapshot.

The UI/UX Audit is anchored to the **later** commit **`988278a`** and states plainly that, as of that
commit: all eight admin CRUD screens (Students/Parents/Teachers/Classes/Sections/School/Campus/
Academic-Session) are live and built; a Fees module, a Messages module, and a Leave module all exist,
live-wired end to end; the staff console shipped a full shell redesign (dark mode, grouped nav,
breadcrumb-label, command palette, two-tier notifications) on 2026-09-07; and — per its own §1 summary
table — **"all screens on both clients are confirmed live-wired — no stub/mock arrays found anywhere in
production code on either client."** That last line directly supersedes the Repo Audit's finding that
`AdminHomeView` was 100% `mockDashboard.ts` data.

**What this means for this roadmap:** the single biggest-ticket items in the Gap Analysis's Tier 1 and
its "top 10" list — Admin CRUD, Fees backend, Messaging backend, a real (non-mock) admin dashboard,
Leave workflow — are **already built**, not still ahead of us. Treating them as open work in this
roadmap would be planning against a codebase that no longer exists.

What the newer document does **not** re-verify, because it was scoped to UI/UX only, is everything the
Repo Audit flagged as security/infrastructure debt: no CI/CD, the dead refresh-token loop, SQLite still
in place, unbounded file uploads, wide-open CORS, the hardcoded JWT fallback, no rate limiting, the
`markAttendance` Teacher-row bug, the `onDelete` policy disagreement. None of these are UI-visible, so
the UI/UX Audit had no reason to touch them, and nothing in it contradicts their status — they should be
treated as **still open** until a fresh technical audit says otherwise.

**Net effect on this roadmap:**
- Do **not** re-plan Admin CRUD, Fees backend, Messaging backend, Leave backend, or "wire the dashboard
  to live data" as new build work. Plan a short **verification pass** instead (confirm scope-correctness,
  security posture, and data integrity of what's already shipped — the two audits disagree exactly on
  this point, so it must be checked, not assumed).
- **Do** carry forward, unmodified, every Tier 0 stabilization item from the Repo Audit/Gap Analysis —
  nothing in the newer document closes any of them.
- **Do** carry forward every UI/UX finding as-is — it is the newest and most specific evidence on the
  presentation layer.
- Payment gateway integration (JazzCash/EasyPaisa), push notifications (FCM), WhatsApp/SMS, offline
  caching extension, and the Tier 3/4 differentiation items are unaffected by the commit gap — none of
  the four documents claims any of these exist.

This roadmap is built on that reconciled picture, not on either document read in isolation.

---

# 1. Product Strategy

### Product Vision
A Pakistan-first School Operating System built around a **Parent Super App core** — one unified backend
serving a staff console and a parent app, closing the loop on attendance, academics, fees, and
communication that Pakistani private schools currently run across WhatsApp groups, paper vouchers, and
a fragmented two-vendor setup. (Gap Analysis §8.)

### Target Customers
Single-campus to small multi-campus private K-12 schools in Pakistan — the exact profile `MVP-Plan-V3`
was written against, not an enterprise district or an international/IB school. (Gap Analysis §8.)

### Primary Users
Parents (the highest-frequency user, mobile-first, often single-Android-device households), teachers
(attendance, diary, and now messaging/leave-approval-adjacent workflows), school admins/accounts staff
(the console's power users), and indirectly students (no student-facing surface exists or is planned —
consistent with the MVP's deliberate exclusion).

### Core Problem
Fragmented parent-school communication and opaque, manual fee collection, with no single source of
truth for attendance, academics, or campus-level student history. (Gap Analysis §8.)

### Product Positioning
A hybrid of SIS-depth and Parent-Super-App reach, localized as **Pakistan-first School OS** — not a pure
enterprise SIS (PowerSchool/Alma shape, wrong market for a single-school customer) and not a pure
engagement app (ClassDojo/Remind shape, which would strand the SIS-depth work already built). (Gap
Analysis §8.)

### Competitive Advantage
Three things the competitor research independently confirms are rare or absent in the ten leaders
reviewed:
- A genuinely unified single-backend, two-client architecture, while the market's biggest names
  (PowerSchool/Schoology, Remind/ParentSquare) are mid-multi-year efforts to *undo* the fragmentation
  their own acquisitions created.
- A real, point-in-time multi-campus `Enrollment` model — several of the ten competitors reviewed don't
  correctly model campus/section transfer at all.
- Content-level Urdu RTL correctness (not a translated UI shell) — most global players, including
  PowerSchool's own portal, only translate UI chrome.

### Differentiation Strategy
Layer Pakistan-specific mechanics on top of the SIS foundation that already exists: local payment rails
(JazzCash/EasyPaisa/1LINK) plus a first-class cash/manual-reconciliation workflow, WhatsApp/SMS fallback
channels, and genuinely bilingual (not chrome-only) UX — a combination no competitor profiled, including
the closest regional analog (Teachmint), currently matches in full. (Gap Analysis §7–§8.)

### Long-term Product Direction
Move from "credible commercial platform" → "the default school OS for Pakistani private-school
networks," using usage data no global competitor is positioned to collect in this market to power
predictive/early-warning analytics and AI-assisted staff drafting, then an EMI-style fee-installment
layer and an audit-logged admissions module scoped to single-school/small-network size (not
district-scale).

---

# 2. Product Maturity Roadmap

### Current MVP (reconciled state, 2026-09-08)
Two vertical layers exist at different levels of confidence:
- **Feature-complete, live-wired** (per UI/UX Audit @ `988278a`): auth + parent isolation, multi-campus
  enrollment, attendance, timetable (read + admin write), diary/circulars, all 8 admin CRUD screens,
  Fees (voucher/structure/ledger — payment gateway itself still a stub), Messages, Leave, a real admin
  dashboard, dark/light theming, a command palette.
- **Unresolved infrastructure debt** (per Repo Audit @ `1e74697`, not yet re-verified): no CI/CD, dead
  refresh-token loop, SQLite in place, unbounded uploads, wide-open CORS, hardcoded JWT fallback, no
  rate limiting, the Admin/Super-Admin attendance-marking bug, the `onDelete` policy disagreement.

This is a codebase with **real feature breadth** sitting on **unverified production-readiness** — not
the "one third of an MVP" picture the Repo Audit alone would suggest, but not yet safe to put a paying
school on either.

### Commercially Credible Version
Unlocked by: closing every Tier 0 item (CI/CD, refresh-token loop, Postgres migration, security
hardening, the attendance bug fix), completing a verification pass on the already-built Fees/
Messaging/CRUD/dashboard modules, and landing push notifications + a JazzCash/EasyPaisa gateway. This is
the version a pilot school can actually be put on without an engineer on standby.

### Growth Version
Unlocked by: local payment-rail depth (cash reconciliation, 1LINK), WhatsApp/SMS fallback channels,
offline caching extended to Fees/Messages/Leave, digest-style notification bundling, and the parent
app's second-pass UI polish reaching parity with the staff console's 2026-09-07 redesign. This is the
version that retains schools past the first term and reduces support load.

### Differentiated Version
Unlocked by: AI-assisted staff drafting (circulars/diary/report comments), predictive/early-warning
attendance analytics, EMI-style fee installments, and an audit-logged admissions/lottery module. This is
the version that competes on more than parity.

### Long-term Platform
Unlocked by: full app-chrome localization on both clients, a completed accessibility program, deeper
multi-campus admin analytics (converting an existing schema strength into a user-facing feature), and a
small-network-scale admissions/enrollment product.

---

# 3. Roadmap Phases

Deliberately not the generic 9-phase SaaS template — reshaped around what's actually left after the
reconciliation in §0.

### Phase 0 — Stabilization & Security Hardening
Every Tier 0 item from the Repo Audit/Gap Analysis: CI/CD, refresh-token loop, Postgres migration, file
upload limits, JWT fail-fast, CORS scoping, rate limiting, the attendance-marking bug, the Circulars
nav-role bug, the `onDelete` disagreement, `MeService` crash path, non-transactional diary attachments.
**Nothing below this line should be treated as trustworthy to build on until Phase 0 is done.**

### Phase 1 — Verification & Consolidation
Because the Gap Analysis and UI/UX Audit disagree on whether Fees/Messaging/CRUD/dashboard are
"missing" or "built," this phase re-verifies the built modules against real conditions: server-side fee
computation correctness, messaging recipient-scoping enforcement, admin-dashboard data accuracy
(including the flagged PKR-currency-formatter check on headcount), and cross-campus staff-access
scoping. Paired with UI Sprint 2 (component extraction) since both touch the same 8 CRUD screens.

### Phase 2 — Payments & Local Rails
JazzCash/EasyPaisa gateway integration, PDF voucher generation, cash/manual-payment reconciliation
workflow — the highest business-value gap with the least design risk (UI already built, shape already
validated by Teachmint/Brightwheel in the competitor research).

### Phase 3 — Parent Engagement & Mobile Parity
Push notifications (FCM, both clients), parent-app second-pass UI polish (dark theme, fixed stat cards,
fixed wrong-child defaults, renamed nav collision), offline caching extended to Fees/Messages/Leave.

### Phase 4 — Communication Depth
WhatsApp integration, SMS fallback channel, digest-style notification bundling (ParentSquare pattern).

### Phase 5 — Remaining Feature Gaps
Report cards (static PDF, MVP-scope), calendar-wide Holiday model, complaint/concern tracking,
forgot-password flow, teacher's own timetable view, bulk attendance-marking endpoint, timetable
scheduling-conflict detection.

### Phase 6 — Accessibility & Localization
Focus trap + ARIA on the command palette, skip-to-content, `Semantics`/tooltip sweep on Flutter,
app-chrome localization scope decision and build-out on whichever client(s) it's committed to,
responsive-shell scope decision for the staff console.

### Phase 7 — Analytics & Admin Depth
Audit-log viewer UI, predictive/early-warning attendance analytics (Alma BeaconAI pattern), deepened
multi-campus admin reporting.

### Phase 8 — Differentiation
AI-assisted staff drafting, EMI-style fee installments, admissions/lottery module with audit trail.

---

# 4. Sprint Planning

Ten two-week sprints, following the cadence `MVP-Plan-V3` already used. Sprint numbering continues from
where the MVP plan's own "Sprints 7–12" language left off, since Sprints 7–10-equivalent work (CRUD,
Fees, Messaging, Leave) has already shipped per the UI/UX Audit.

### Sprint A — Stabilization I: Session, CI, Data
- **Duration:** 2 weeks
- **Goal:** Make the app stop silently breaking, and make regressions visible before merge.
- **User Outcome:** A parent/teacher session survives longer than 15 minutes without an unexplained logout.
- **Business Outcome:** The engineering team can trust `main` again; the codebase becomes demo-safe.
- **Features:** Working refresh-token loop; CI pipeline.
- **Backend:** `POST /auth/refresh` with rotation-on-use; boot-time fail-fast if JWT secrets are unset outside dev.
- **Database:** No schema change. Confirm `RefreshToken` table usage matches the new redemption flow.
- **API:** New `/api/v1/auth/refresh` endpoint, versioned consistently with the rest of the surface.
- **Staff Web:** Axios/fetch interceptor: on 401, attempt one silent refresh-and-retry before forcing logout.
- **Parent Mobile:** Same pattern in `ApiClient` — retry-once-on-401 via the stored refresh token.
- **UI/UX:** No visible change on success; a clear, non-cryptic session-expired screen on hard failure.
- **Integrations:** None.
- **Testing:** e2e test for refresh-then-retry; e2e test for rotation-on-reuse (old refresh token rejected).
- **Security:** Refresh-token rotation closes the "dead code that mints tokens nothing redeems" gap flagged in the Repo Audit.
- **Performance:** N/A.
- **Dependencies:** None — first sprint.
- **Definition of Done:** A session survives >15 minutes of active use with zero user-visible interruption; CI runs backend unit+e2e, staff-console Vitest, and Flutter test on every PR and blocks merge on failure.
- **Deliverables:** `/auth/refresh` route + rotation, CI workflow file(s), updated client interceptors.

### Sprint B — Stabilization II: Database & Hardening
- **Duration:** 2 weeks
- **Goal:** Move off SQLite and close the security gaps flagged as appropriate-for-dev-only.
- **User Outcome:** No user-visible change — this sprint is entirely trust infrastructure.
- **Business Outcome:** The product becomes safe to put a real pilot school's data on.
- **Features:** Postgres migration; upload limits; CORS scoping; rate limiting.
- **Backend:** Prisma `provider` switch to `postgresql`; re-run all migrations against Postgres; `multer` `limits` + MIME allowlist on `FileInterceptor`; `@nestjs/throttler` on auth and general routes; scope `?access_token=` fallback to the files route only; `app.enableCors()` restricted to known client origins.
- **Database:** Provider change only — no model changes. Resolve the `FeePaymentAllocation` vs `Receipt` `onDelete` policy disagreement before Phase 2 (Fees) work touches this table further.
- **Migrations:** One provider-switch migration; verify seed script still runs against Postgres.
- **API:** No new endpoints; existing ones gain size/MIME/rate constraints.
- **Staff Web / Parent Mobile:** No functional change; handle the new 429 (rate-limited) and 413 (payload-too-large) responses gracefully instead of a generic error.
- **Background jobs:** None yet — no job runner exists in the repo; note as a Phase 2+ prerequisite if PDF generation or scheduled digests need one.
- **Testing:** Re-run the full e2e suite against Postgres; add an upload-size-rejection test; add a rate-limit-trip test.
- **Security:** Closes 4 of the Repo Audit's 6 named security findings (uploads, JWT fallback covered in Sprint A, CORS, rate limiting). Cross-campus staff-access scoping (finding #5) is explicitly deferred — single-campus scale today, tracked for whenever a second school onboards.
- **Performance:** Postgres write-locking/backup characteristics are a strict improvement over SQLite for concurrent attendance/fee writes.
- **Dependencies:** None blocking; can run in parallel with Sprint A if staffing allows (both touch different layers).
- **Definition of Done:** Staging environment runs on Postgres; a large/wrong-type file upload is rejected with a clear error; CORS only accepts the known staff/parent origins; a credential-stuffing attempt against many accounts is throttled.
- **Deliverables:** Postgres staging deploy, hardened `main.ts`/`FilesService`/`AuthModule`.

### Sprint C — Attendance & Access Bug Fixes + Verification Pass
- **Duration:** 2 weeks
- **Goal:** Fix the two credibility-damaging bugs the Repo Audit found, and verify the modules the UI/UX Audit says are now live are actually scope-correct.
- **User Outcome:** Admin/Super-Admin users can mark attendance using the role they're already authorized for; a Fee ledger/Message thread only shows data its recipient should see.
- **Business Outcome:** Closes the two "looked confirmed but weren't" findings before either surfaces during a pilot.
- **Features:** Attendance role-lookup fix; Circulars-nav role fix; Fees/Messaging scoping verification.
- **Backend:** Fix `attendance.service.ts`'s `Teacher.findUnique` lookup to fall through correctly for Admin/Super-Admin roles (either a role-branch or a synthetic `Teacher`-equivalent path); audit `FeesService`/`MessagesService` (module names inferred from feature area — verify actual file names before implementing) against the same `StudentAccessService` isolation pattern proven for attendance/diary.
- **Database:** No new models. Confirm Fee/Message tables carry the same campus/section scoping columns already proven on `Enrollment`.
- **Validation/Permissions:** Re-run the RBAC test pattern already used for attendance (`e2e-spec.ts` style) against Fees and Messaging endpoints.
- **Staff Web:** Fix `AppShell.vue`'s `isAdmin` condition so an Accounts-role user isn't silently bounced off Circulars.
- **UI/UX:** No new screens — this is correctness work on existing ones.
- **Testing:** New e2e case: Admin/Super-Admin successfully marks attendance. New e2e cases: a parent/staff user cannot read a Fee/Message record outside their campus/section scope.
- **Security:** This sprint is the direct answer to the Gap Analysis's Critical gap #4 (attendance bug) and closes the trust question raised in §0 of this document about Fees/Messaging scoping.
- **Dependencies:** Should follow Sprint B (Postgres) so verification runs against the target production database.
- **Definition of Done:** Every role named in `@Roles()` on the attendance endpoint can actually use it; a documented cross-campus access test suite passes for Fees and Messaging.
- **Deliverables:** Bug-fix commits + a short verification report confirming (or correcting) the UI/UX Audit's "live-wired, no mock data" claim for Fees/Messaging.

### Sprint D — Staff Console Component Extraction (UI Sprint 2)
- **Duration:** 2 weeks
- **Goal:** Stop duplicating table/form/button markup across 8+ screens — the single highest-leverage UI fix in the whole audit.
- **User Outcome:** Consistent confirmation dialogs and table behavior everywhere, not just some screens.
- **Business Outcome:** Every future screen ships faster and drifts less.
- **Features:** `EntityTable.vue`, shared form-field component, `Button.vue`, one themed `ConfirmDialog.vue`.
- **Vue Components:** Extract from the 8 duplicated `.entity-table` implementations; replace all `window.confirm()` calls; add confirmation to Timetable's delete/bulk-replace and Leave's reject (currently unconfirmed).
- **UI/UX:** Fix the dead Teacher → Timetable nav link (build against the existing `GET /students/:id/timetable` endpoint) or remove it; fix the breadcrumb label/`aria-label` mismatch.
- **Testing:** Component specs for the three new shared components; regression specs confirming all 8 CRUD screens still function after the swap.
- **Dependencies:** None blocking, but logically pairs with Sprint C since both touch the CRUD screens.
- **Definition of Done:** Zero remaining `window.confirm()` calls in the staff console; one shared table component backs all 8 CRUD screens.
- **Deliverables:** `src/components/EntityTable.vue`, `Button.vue`, `ConfirmDialog.vue`, refactored CRUD views.

### Sprint E — Payment Gateway & Local Rails (Phase 2)
- **Duration:** 3 weeks (higher technical risk/effort per the Gap Analysis scoring — Score 10.0, EE 4, TR 4)
- **Goal:** Let a parent actually pay a fee voucher through a rail they already use.
- **User Outcome:** Pay a fee voucher via JazzCash/EasyPaisa from the Fees tab, or have a cash/bank-deposit payment reconciled by staff.
- **Business Outcome:** Closes the single most Pakistan-specific, most competitor-validated (Teachmint TeachPay) gap.
- **Features:** JazzCash/EasyPaisa gateway integration; PDF voucher generation; cash/manual-reconciliation workflow.
- **Backend — PROPOSED architecture change:** No payment-gateway adapter exists today (confirmed absent by the Repo Audit). Introduce a `PaymentGateway` interface (mirroring the existing swappable `StorageAdapter` pattern already proven in `files`) with a JazzCash/EasyPaisa implementation behind it.
- **Database:** Existing `FeePayment`/`FeePaymentAllocation`/`Receipt` schema is already modeled (paisa-integer amounts, multi-voucher allocation) — reuse as-is. Add a `paymentMethod`/`gatewayReference` field if not already present (verify against current schema before assuming).
- **Migrations:** One additive migration for the gateway-reference field, if needed.
- **API:** `POST /fees/vouchers/:id/pay` (gateway-initiated), a webhook/callback endpoint for gateway confirmation, `POST /fees/vouchers/:id/reconcile` (manual/cash path, staff-only).
- **Background jobs — PROPOSED:** No job runner exists in the repo today. Payment-status polling/webhook retry likely needs one (e.g., a lightweight queue or a scheduled Nest `@Cron` task) — flagged as a new architectural addition, not assumed to exist.
- **Notifications:** Payment-confirmation push/message on success (depends on Sprint F/G's notification infrastructure — sequence accordingly, or fall back to in-app-only for this sprint).
- **Vue:** Wire the already-built `FeesView.vue` reconciliation UI (currently against `lib/mockFees.ts`, per the original Repo Audit — verify in Sprint C whether it's since been wired) to the real reconciliation endpoint.
- **Flutter:** Replace the parent app's "checkout stub" (confirmed present, per UI/UX Audit §3.1) with a real gateway redirect/webview flow.
- **Validation/Permissions:** Only the enrolled parent (or their scoped staff) can initiate payment for a given voucher; only Accounts/Admin roles can mark a manual reconciliation.
- **Testing:** Gateway-integration tests against JazzCash/EasyPaisa sandbox credentials; e2e for the full voucher → pay → receipt loop; e2e for the cash-reconciliation path.
- **Security:** Webhook signature verification is mandatory — do not trust an unauthenticated callback.
- **Performance:** N/A at pilot scale.
- **Dependencies:** Requires Sprint B (Postgres, security hardening) and Sprint C (Fees scoping verification) complete first — do not build a payment layer on top of an unverified fee-scoping boundary.
- **Definition of Done:** A test parent can pay a real (sandbox) JazzCash/EasyPaisa transaction end-to-end and see a receipt; staff can mark a cash payment reconciled and it reflects in the ledger.
- **Deliverables:** `PaymentGateway` adapter + JazzCash/EasyPaisa implementation, reconciliation UI wired live, PDF voucher generator.

### Sprint F — Push Notifications, Both Clients (Phase 3)
- **Duration:** 2 weeks
- **Goal:** A parent learns about a new circular/message/diary entry without opening the app.
- **User Outcome:** Real push notifications, not a badge that only updates on app open.
- **Business Outcome:** Closes a named global table-stakes gap (competitor research §9, §11) present on zero screens today.
- **Features:** FCM integration on Flutter; a push-dispatch path on the backend for circular publish / message send / diary publish.
- **Backend — PROPOSED architecture change:** No Firebase/FCM wiring exists anywhere (confirmed absent, both audits). Add a `DeviceToken`-consuming notification-dispatch service (the `DeviceToken` model already exists in schema per the Repo Audit's data-model findings — zero logic behind it today) that calls the FCM Admin SDK on the existing publish/send write paths (diary, circulars, messages).
- **Database:** `DeviceToken` model already present — register/refresh it from the client on login and token-refresh.
- **API:** `POST /me/device-tokens` (register), reuse existing publish endpoints as the trigger points for dispatch (no new public API surface needed beyond token registration).
- **Services:** New `NotificationDispatchService` in backend, called from `DiaryService`/`CircularsService`/`MessagesService` write paths.
- **Flutter:** Add `firebase_messaging`/`firebase_core` to `pubspec.yaml` (currently absent); handle foreground/background/terminated states; deep-link a tapped notification to the right screen (the app already has deep-linking from the in-app notification bell, per the UI/UX Audit — extend the same pattern to push).
- **Interim mitigation (can ship independently, smaller effort):** Foreground-resume polling via `WidgetsBindingObserver` — cheap, and the UI/UX Audit explicitly recommends it as a stopgap before full FCM lands, so it can ship in this sprint even if FCM slips.
- **Testing:** Manual device-matrix testing (push notifications are hard to unit-test meaningfully); an automated test for token registration/refresh at minimum.
- **Security:** FCM server key must not be committed to the repo — confirm secrets-management path exists (none was found for the JWT secret either, per the Repo Audit — this sprint is a good forcing function to fix that pattern generally).
- **Performance:** N/A.
- **Dependencies:** None blocking; can run in parallel with Sprint E.
- **Definition of Done:** A published circular/message triggers a real push notification on a physical/emulated Android device within a few seconds.
- **Deliverables:** FCM wiring on Flutter, `NotificationDispatchService` on backend, device-token registration endpoint.

### Sprint G — Parent App Second-Pass UI Polish (UI Sprint 3)
- **Duration:** 2 weeks
- **Goal:** Bring the parent app's design maturity in line with the staff console's 2026-09-07 pass.
- **User Outcome:** Dark mode on the parent app; no more fake stat cards; leave/message forms respect the actively-selected child.
- **Business Outcome:** The two clients stop reading as two different products.
- **Features:** Parent-app dark theme; Home-dashboard fake-card fixes; wrong-child-default fix; nav-naming-collision fix.
- **Flutter:** `ThemeData.dark()` branch mirroring the staff console's token values; fix `HomeTab`'s Fees stat card (real balance, not hardcoded `'—'`) and Results card (hide/gray until Release 2, since report cards aren't built yet); thread `activeChildId` into `LeaveScreen` and Messages-compose instead of defaulting to `children.first`; rename the "Notifications" bottom-nav tab to "Circulars."
- **State Management:** No new state-management pattern — extend the existing `provider`-based active-child state to the two screens currently ignoring it.
- **Offline behavior:** Extend `loadWithCache`/`LastUpdatedBanner` (already proven on Timetable/Attendance/Diary/Circulars) to Fees and Messages — the two screens a parent most wants stale-but-visible data for, per the UI/UX Audit.
- **Testing:** Widget tests confirming Leave/Messages respect the active child on switch; a dark-mode snapshot/golden-file pass if the project has one, otherwise manual verification across screens.
- **Dependencies:** None blocking; independent of Sprints E/F.
- **Definition of Done:** Switching the active child and opening Leave or Messages shows that child's data, not the first child's; dark mode is available and matches staff-console token values; Fees/Messages/Circulars all show a `Last updated:` timestamp when offline.
- **Deliverables:** Dark theme, corrected dashboard cards, threaded `activeChildId`, extended cache layer.

### Sprint H — Communication Depth: WhatsApp, SMS, Digest Bundling (Phase 4)
- **Duration:** 2–3 weeks
- **Goal:** Reach parents on the channel they actually check, and stop overwhelming them with individual alerts.
- **User Outcome:** Receive a circular/message summary over WhatsApp or SMS; get one digest instead of five separate pings.
- **Business Outcome:** Closes the Pakistan-specific communication gap the competitor research names as unmatched by any of the ten leaders reviewed.
- **Features:** WhatsApp Business API integration; SMS gateway integration; digest-style notification bundling.
- **Backend — PROPOSED architecture change:** Neither channel exists today. Add `WhatsAppChannel`/`SmsChannel` implementations behind the same `NotificationDispatchService` abstraction introduced in Sprint F, so push/WhatsApp/SMS are interchangeable delivery channels off one dispatch point rather than three separate ad hoc integrations.
- **Database:** Add a per-user channel-preference field (or table) if none exists — verify against current `User`/`DeviceToken` schema before assuming.
- **API:** No new public endpoints required beyond existing publish paths; add a channel-preference update endpoint under `/me`.
- **Background jobs:** Digest bundling requires a scheduled batch job (e.g., a Nest `@Cron` job) — another instance of the "no job runner exists yet" gap flagged in Sprint E; consolidate the job-runner decision across both sprints rather than solving it twice.
- **Integrations:** WhatsApp Business API (Meta) and a Pakistani SMS gateway provider — both external, both carry setup lead time (business verification, sender-ID registration) that should start before this sprint's engineering work, not during it.
- **Testing:** Integration tests against sandbox/test credentials for both channels; a digest-window test (multiple events bundled into one send within the configured window).
- **Security:** Phone numbers are PII — confirm they're already handled under whatever data-protection posture the rest of the schema follows (no explicit gap flagged here by the audits, but worth a check before adding a new PII-transmitting channel).
- **Dependencies:** Logically follows Sprint F (shares the dispatch-service abstraction) — do not build this as a separate one-off integration.
- **Definition of Done:** A test circular reaches a WhatsApp number and an SMS number; a parent with digest mode enabled gets one bundled message instead of three separate ones within the configured window.
- **Deliverables:** `NotificationDispatchService` extended with WhatsApp/SMS channels, digest batching job, channel-preference setting.

### Sprint I — Remaining Feature Gaps (Phase 5)
- **Duration:** 3 weeks (bundles several small-to-medium items)
- **Goal:** Close the named-but-still-open MVP-scope gaps that don't need their own sprint.
- **User Outcome:** Parents can view a static report-card PDF; a school-wide holiday shows correctly on every student's calendar without per-student re-entry; a forgotten password can be reset without calling the office.
- **Business Outcome:** Closes the remaining Critical/High items from the Gap Analysis register that Phase 0–4 didn't already cover.
- **Features:** Report cards (static PDF upload/view); calendar-wide `Holiday` model; complaint/concern tracking; forgot-password flow; teacher's own timetable view; bulk attendance-marking endpoint; timetable scheduling-conflict detection.
- **Backend:** New `Holiday` model (school/campus-scoped, date-ranged) replacing the per-student-per-day-only pattern; new `Complaint` model + minimal CRUD (not modeled in schema today per the Repo Audit — a genuine new addition); `POST /auth/forgot-password` + `POST /auth/reset-password` with a time-limited token; a bulk `POST /attendance/bulk` accepting an array (replacing the current N-sequential-call pattern flagged in the UI/UX Audit); a same-teacher/same-room/same-period conflict check added to `TimetableService.createEntry`.
- **Database:** `Holiday`, `Complaint`, `PasswordResetToken` — three new models. `ReportCard` model (PDF reference + student/term scoping) if not already present in schema.
- **Migrations:** Additive migrations for each new model above.
- **API:** `/holidays` CRUD, `/complaints` CRUD, `/auth/forgot-password`/`/reset-password`, `/students/:id/timetable` (teacher-facing read, reusing the existing endpoint), `/attendance/bulk`, `/report-cards` (upload for staff, read for parent).
- **Services/Controllers:** One new module per feature, following the existing per-bounded-context pattern (`holidays`, `complaints`, `report-cards`).
- **Validation/Permissions:** Report-card upload restricted to Admin/Teacher; complaint visibility scoped like every other student record (reuse `StudentAccessService`); password-reset tokens single-use and time-limited.
- **Notifications:** Report-card publish and complaint-status-change should route through the Sprint F/H dispatch service once it exists.
- **Vue:** New teacher timetable read-only view (fixing the dead `href="#"` nav link flagged in the UI/UX Audit); a Holiday admin screen; a Complaints queue screen; a forgot-password form on `LoginView.vue`.
- **Flutter:** A Report Cards screen under the parent app's "More" section (currently near-empty per the UI/UX Audit); surface complaint status if parent-facing submission is in scope (verify against `MVP-Plan-V3` scope before building parent-side submission — the Gap Analysis lists this as staff-facing "tracking," not necessarily parent-submittable).
- **Testing:** e2e for each new module; a bulk-attendance test confirming one round-trip replaces N; a conflict-detection test confirming a double-booked teacher/room is rejected.
- **Dependencies:** Report cards/Holiday/Complaints are independent of each other and can be split across parallel workstreams if staffing allows.
- **Definition of Done:** All items in the Gap Analysis's Medium/Low severity register that fall in this list are closed; the dead Teacher → Timetable link resolves to a real screen.
- **Deliverables:** Five to seven small modules, each following the existing Nest-module + Vue-view + Prisma-model pattern already proven elsewhere in the codebase.

### Sprint J — Accessibility & Localization Scope Decision + Build-Out (Phase 6)
- **Duration:** 3 weeks
- **Goal:** Turn the genuinely strong content-level RTL work into a complete localization story, and close accessibility gaps that are missing rather than deliberately deferred.
- **User Outcome:** A screen-reader/keyboard-only user can operate the command palette without escaping into the page behind it; a monolingual-Urdu parent sees Urdu app chrome, not just Urdu content (if the localization scope decision below commits to this).
- **Business Outcome:** Closes the accessibility infrastructure gap and resolves two explicitly half-finished scope questions the UI/UX Audit flags as reading "unfinished" rather than "deliberate."
- **Features:** Command-palette focus trap + ARIA; skip-to-content link; `Semantics`/tooltip sweep (Flutter); app-chrome localization (scope-decided, then built); staff-console responsive-shell scope decision.
- **Vue:** Focus-trap implementation on `CommandPalette.vue`; `role="option"`/`aria-selected` wiring; skip-to-content anchor + `#main` id; `aria-expanded`/`aria-haspopup` on disclosure buttons; accessible name on `TrendsSparkline.vue`; `lang="ur"` alongside `dir="rtl"` on Urdu content nodes.
- **Flutter:** `Semantics(label:)` on every icon-only button (attachment/receipt/send-reply, currently unlabeled per the UI/UX Audit); one automated a11y-guideline test added to the existing 18-file test suite.
- **Localization — requires an explicit product decision first, not just engineering:** Decide whether staff-console chrome, parent-app chrome, or both get translated, then implement via an i18n layer (staff: a Vue i18n library; parent: `flutter_localizations` + `.arb` files). The content-level RTL foundation already proves the team can do this correctly — this is "finish the job," not "start from zero," per the UI/UX Audit.
- **Responsive shell decision:** Either build a real collapsible/overlay sidebar for the staff console (if mobile staff use is a real requirement) or formally document it as desktop-only scope. Currently neither is true, which is the exact "undocumented, half-implemented" pattern the UI/UX Audit flags as reading as unfinished.
- **Testing:** Automated a11y test harness on both clients (new — none exists today); manual keyboard-only walkthrough of the command palette and CRUD screens.
- **Dependencies:** The localization and responsive-shell items require a product decision (§14, Q4/Q8 area) before engineering starts — do not let engineering silently make this call.
- **Definition of Done:** Tab-only navigation cannot escape an open command palette; every icon-only button announces its purpose to a screen reader; the localization and responsive-shell scope decisions are documented, not implied.
- **Deliverables:** Accessibility fixes across both clients, a documented localization scope decision + first-phase translation coverage, a documented responsive-shell decision.

### Sprint K — Differentiation Kickoff: AI Drafting + Predictive Analytics (Phase 7–8)
- **Duration:** 3–4 weeks
- **Goal:** Ship the first two Tier 3 differentiators — the ones with the clearest competitor-validated pattern and the least architectural risk.
- **User Outcome:** A teacher drafting a circular or diary entry gets an AI-assisted first draft to edit, not a blank field; an admin sees an early-warning flag on a student whose attendance pattern is degrading, not just a raw percentage.
- **Business Outcome:** First genuinely differentiated (not just at-parity) capability, following the Seesaw/Toddle "AI cuts staff time" pattern and the Alma BeaconAI "predictive, not static" pattern — explicitly not gated behind hardware the way Teachmint's EduAI is, per the competitor research's own warning.
- **Features:** AI-assisted drafting for circulars/diary/report-card comments; attendance early-warning analytics.
- **Backend — PROPOSED architecture change:** No AI/LLM integration exists anywhere in the current stack. Introduce a thin `AiDraftingService` calling an external LLM API (provider choice out of scope for this document) from the existing circular/diary compose endpoints as an optional "generate draft" action — never auto-publishing without staff review. Introduce an `AttendanceRiskService` computing rolling absence-rate trends from data already captured in the existing `Attendance` table — no new data collection required, only new computation over existing rows.
- **Database:** No new core models required for early-warning analytics (computed from existing `Attendance` rows). AI-drafting may need a lightweight `DraftSuggestion` audit table if draft provenance needs to be tracked (recommended, given the schema's existing audit-logging discipline).
- **API:** `POST /diary/draft-suggestion`, `POST /circulars/draft-suggestion`, `GET /students/:id/attendance-risk` (or a school/section-level aggregate view for the admin dashboard).
- **Services:** `AiDraftingService`, `AttendanceRiskService` — both new, both additive, neither touching existing write paths' core logic.
- **Vue:** A "Suggest draft" button on Diary/Circular compose forms; a new early-warning panel on `AdminHomeView.vue`, extending the dashboard's existing sparkline-chart pattern rather than building a new visualization system from scratch.
- **Notifications:** Early-warning flags should route through the existing dispatch service (Sprint F/H) to alert relevant staff, not just sit passively in a dashboard.
- **Background jobs:** Attendance-risk computation likely wants a scheduled recompute (nightly), reusing whatever job-runner decision was made in Sprint E/H rather than introducing a third pattern.
- **Testing:** Unit tests for the risk-scoring logic against known attendance patterns; integration test confirming a draft-suggestion call round-trips correctly (mocking the external LLM call in CI).
- **Security:** Do not send PII beyond what's strictly needed for a draft (e.g., a diary draft prompt shouldn't need to include unrelated students' data) — scope the LLM call payload carefully.
- **Dependencies:** Requires Sprint F/H's notification dispatch service for early-warning alerts to reach staff. AI drafting has no hard dependency and could ship earlier if prioritized.
- **Definition of Done:** A teacher can generate and then edit an AI-drafted circular before publishing; an admin sees a student flagged after a defined absence-rate threshold is crossed, sourced from real data, not a static dashboard number.
- **Deliverables:** `AiDraftingService`, `AttendanceRiskService`, updated compose UIs, dashboard early-warning panel.

---

# 5. Technical Implementation Detail

Consolidated by feature area — see Sprint sections above for the fully worked-out per-sprint detail.
Everything marked **PROPOSED** below is a new architectural addition not present in the current
repository, per the Repo Audit and UI/UX Audit; everything else extends an existing, evidenced pattern.

| Feature | DB models | Prisma/migrations | New API surface | Services/Controllers | Vue | Flutter | Architecture status |
|---|---|---|---|---|---|---|---|
| Refresh-token loop | Existing `RefreshToken` | None | `POST /auth/refresh` | Extend `AuthService` | Interceptor only | Interceptor only | Extends existing pattern |
| Postgres migration | None | Provider-switch migration | None | None | None | None | Extends existing (Prisma is provider-agnostic already) |
| File upload hardening | None | None | None | `FilesService`/`FilesController` config only | None | None | Extends existing `StorageAdapter` |
| Attendance role-bug fix | None | None | None | Fix `AttendanceService.markAttendance` | None | None | Bug fix, no new architecture |
| Payment gateway | Extend `FeePayment` (gateway ref field) | Additive migration | `POST /fees/vouchers/:id/pay`, webhook endpoint | **PROPOSED** `PaymentGateway` interface + JazzCash/EasyPaisa impl | Wire existing `FeesView.vue` | Replace checkout stub | **PROPOSED** — mirrors existing `StorageAdapter` pattern |
| Push notifications | Existing `DeviceToken` | None | `POST /me/device-tokens` | **PROPOSED** `NotificationDispatchService` | Notification-preference UI | `firebase_messaging` integration | **PROPOSED** — no FCM exists today |
| WhatsApp/SMS | New channel-preference field | Additive migration | `/me` preference endpoint | Extend `NotificationDispatchService` with channel adapters | Preference UI | Preference UI | **PROPOSED** |
| Digest bundling | None | None | None | New scheduled job | None | None | **PROPOSED** — no job runner exists today |
| Holiday model | New `Holiday` | Additive migration | `/holidays` CRUD | New `HolidaysModule` | New admin screen | Calendar display update | **PROPOSED** — replaces per-student-only pattern |
| Complaint tracking | New `Complaint` | Additive migration | `/complaints` CRUD | New `ComplaintsModule` | New queue screen | Optional parent-facing submission (verify scope) | **PROPOSED** — not in schema today |
| Forgot password | New `PasswordResetToken` | Additive migration | `/auth/forgot-password`, `/auth/reset-password` | Extend `AuthService` | New form | New form | **PROPOSED** |
| Bulk attendance | None | None | `POST /attendance/bulk` | Extend `AttendanceService` | Update `onSave()` call site | N/A | Extends existing endpoint |
| Timetable conflict detection | None | None | None | Extend `TimetableService.createEntry` | Surface validation error | N/A | Extends existing service |
| Report cards | Verify/add `ReportCard` | Additive if missing | `/report-cards` | New `ReportCardsModule` | New upload screen | New viewer screen | Mostly extends existing `StorageAdapter` for PDF storage |
| AI drafting | Optional `DraftSuggestion` | Additive if tracked | `/diary/draft-suggestion`, `/circulars/draft-suggestion` | **PROPOSED** `AiDraftingService` | "Suggest draft" button | N/A (staff-only feature) | **PROPOSED** — no LLM integration exists today |
| Predictive attendance analytics | None (computed) | None | `/students/:id/attendance-risk` | **PROPOSED** `AttendanceRiskService` | Dashboard panel | N/A | **PROPOSED** — computation over existing data only |
| Admissions/lottery module | New `Applicant`/`Application`/lottery models | New migration set | `/admissions/*` | **PROPOSED** new `AdmissionsModule` | New multi-step screens | New parent-facing application flow | **PROPOSED** — entirely new bounded context, largest architecture addition in this roadmap |
| EMI-style fee installments | Extend `FeeVoucher`/`FeePayment` with installment-plan fields | Additive migration | `/fees/vouchers/:id/installment-plan` | Extend `FeesService` | Extend ledger UI | Extend Fees flow | Extends existing Fees schema; installment-scheduling logic is new |

No exact field names are asserted above beyond what the four source documents already confirm exist
(`RefreshToken`, `DeviceToken`, `FeePayment`, `FeePaymentAllocation`, `Receipt`, `Enrollment`,
`StudentAccessService`, `StorageAdapter`). Every other model/field name is a proposed addition to be
finalized against the actual current `schema.prisma`, which this document's source audits did not fully
reproduce line-by-line for every table.

---

# 6. Dependency Graph

```text
Phase 0 — Stabilization
  CI/CD ──────────────┐
  Refresh-token loop ─┤
  Postgres migration ─┼──→ everything below depends on a trustworthy base
  Security hardening ─┤
  Attendance bug fix ─┘
        ↓
Phase 1 — Verification (Fees/Messaging/CRUD/Dashboard scope + data correctness)
        ↓
        ├──→ Phase 2 — Payment Gateway (JazzCash/EasyPaisa) ──┐
        │         ↓                                          │
        │    Cash reconciliation                              │
        │                                                      ↓
        ├──→ Phase 3 — Push Notifications (FCM) ──┐    Phase 8 — EMI Fee Installments
        │         ↓                               │    (needs Payment Gateway)
        │    Parent App UI Polish                 │
        │         ↓                               ↓
        │    Offline caching extension    Phase 4 — WhatsApp/SMS + Digest
        │                                  (needs Push Notification dispatch service)
        ↓
Phase 5 — Remaining Feature Gaps (Holiday, Complaints, Forgot-Password,
          Teacher Timetable, Bulk Attendance, Conflict Detection)
  — mostly independent of each other, parallelizable
        ↓
Phase 6 — Accessibility & Localization
  — independent of Phase 5, can run in parallel with it
        ↓
Phase 7 — Analytics & Admin Depth (Attendance Risk needs Push dispatch for alerts)
        ↓
Phase 8 — Differentiation
  AI Drafting (independent — can start as soon as Phase 0 is done)
  Predictive Analytics (needs Phase 3's dispatch service for alerts)
  Admissions/Lottery Module (independent — largest net-new bounded context)
  EMI Fee Installments (needs Phase 2's Payment Gateway)
```

**Parallelizable work once Phase 0 is complete:** Phase 1 verification, UI Sprint 2 (component
extraction), and the start of Phase 5's independent small items (Holiday model, Complaint tracking,
Forgot-password) can all run concurrently with different engineers. Phase 6 (accessibility/localization)
has no hard dependency on Phases 2–5 and can be staffed in parallel throughout.

---

# 7. Critical Path

### Critical path
Phase 0 (Stabilization) → Phase 1 (Verification) → Phase 2 (Payment Gateway) → Phase 8's EMI
installments. Phase 0 blocks everything; Phase 2 blocks the highest-business-value differentiator
(EMI fees); nothing after Phase 0 should be considered production-safe to build on until it's closed.

### Parallel workstreams
UI component extraction (Sprint D) alongside Phase 1 verification; parent-app UI polish (Sprint G)
alongside the payment gateway build (Sprint E); accessibility/localization (Sprint J) alongside
communication-depth work (Sprint H); AI drafting (part of Sprint K) has no hard blocker beyond Phase 0
and can start early if a team is free.

### Blocking dependencies
- Payment gateway (Phase 2) blocks EMI-style installments (Phase 8) and meaningfully de-risks Fees
  verification (Phase 1) — sequence Phase 1's Fees check before committing to gateway-integration detail.
- Push-notification dispatch service (Phase 3) blocks WhatsApp/SMS (Phase 4) and predictive-analytics
  alerting (Phase 7) — build it once, as a real abstraction, not three times.
- A job-runner decision (first needed in Phase 2 for payment-status polling, needed again in Phase 4 for
  digest bundling, and again in Phase 8 for nightly risk recomputation) should be made **once**, early,
  rather than three separate teams inventing three different scheduling mechanisms.

### High-risk technical areas
- Payment gateway integration (external dependency, webhook security, sandbox-to-production transition).
- Postgres migration (any data-shape surprise only surfaces once real data exists, not in a fresh
  migration test).
- The admissions/lottery module (Phase 8) — the largest net-new bounded context in this roadmap, with no
  existing schema or backend precedent to extend, unlike every other Phase 8 item.

### Long-lead integrations
JazzCash/EasyPaisa merchant onboarding (business verification, sandbox access, compliance review) and
WhatsApp Business API approval (Meta business verification) both carry vendor-side lead time measured in
weeks, not engineering days — start these processes at the start of Phase 2/4 planning, not when the
sprint begins.

### Features requiring architectural changes
Payment gateway (new `PaymentGateway` adapter interface), push/WhatsApp/SMS (new
`NotificationDispatchService`), a job-runner/scheduler (currently absent entirely), AI drafting (new
external-LLM integration point), and the admissions module (entirely new bounded context) — all flagged
**PROPOSED** in §5, none assumed to already exist.

---

# 8. 6-Month Roadmap

Starting 2026-09-08. Each month assumes the two-week sprint cadence from §4, roughly two sprints/month.

| Month | Engineering | UI/UX | Product Features | Infrastructure | Testing | Release Milestone |
|---|---|---|---|---|---|---|
| **Month 1** (Sep) | Sprint A + B: refresh-token loop, CI/CD, Postgres migration, security hardening | — | — | CI pipeline live; staging on Postgres | Full e2e suite green on CI, on Postgres | Internal: "stabilized backend" checkpoint |
| **Month 2** (Oct) | Sprint C + D: attendance/access bug fixes, Fees/Messaging verification, component extraction | Shared `EntityTable`/`Button`/`ConfirmDialog`, dead-link fixes | Verified Fees/Messaging scope-correctness | — | New RBAC/scoping e2e cases | **Release 1** candidate freeze (see §10) |
| **Month 3** (Nov) | Sprint E: payment gateway integration | Wire existing Fees UI to real gateway | JazzCash/EasyPaisa live in sandbox | Job-runner decision made | Gateway sandbox integration tests | — |
| **Month 4** (Dec) | Sprint F + G: push notifications, parent-app polish | Dark theme (parent), fixed dashboard cards, fixed child-context bugs | Real push notifications on both clients | FCM project provisioned | Device-matrix push testing | **Release 2** candidate freeze |
| **Month 5** (Jan) | Sprint H: WhatsApp/SMS, digest bundling | — | Multi-channel delivery live | WhatsApp Business + SMS gateway onboarding (started Month 3) | Channel-integration tests | — |
| **Month 6** (Feb) | Sprint I: report cards, Holiday model, complaints, forgot-password, teacher timetable, bulk attendance | New teacher timetable screen, Holiday admin screen, complaints queue | Five to seven small MVP-scope gaps closed | — | e2e per new module | **Release 3** candidate freeze |

---

# 9. 12-Month Roadmap

Months 7–12 (Mar 2027 – Aug 2027). Committed vs. exploratory is marked explicitly per the brief.

| Month | Committed | Exploratory |
|---|---|---|
| **Month 7** | Sprint J: accessibility fixes (focus trap, skip-link, Semantics sweep) | Localization scope decision (may extend into Month 8 depending on the decision's size) |
| **Month 8** | Localization build-out (whichever scope was committed in Month 7); responsive-shell decision + build if committed | — |
| **Month 9** | Sprint K part 1: AI-assisted drafting (circulars/diary) | Choice of LLM provider/vendor, cost-per-draft modeling |
| **Month 10** | Sprint K part 2: predictive/early-warning attendance analytics | Extending the risk model beyond attendance (e.g., fee-payment-lateness patterns) — exploratory only, not committed |
| **Month 11** | EMI-style fee installments (Phase 8, depends on Phase 2 gateway) | Cross-campus admin analytics/reporting (deepening the existing multi-campus schema strength into a visible feature) |
| **Month 12** | Admissions/lottery module — foundational schema + core application flow | Full lottery-fairness audit trail (PowerSchool Enrollment pattern) — commit to the core flow first, treat the audit-trail depth as a stretch goal within the same module |

**Explicitly exploratory, not committed anywhere in this 12-month window:** district-scale compliance
reporting, a 75+-integration marketplace, a custom drag-and-drop report builder, RFID/biometric
attendance, cashless canteen wallets — all named in the Gap Analysis's Tier 4 Defer list (§13 below) and
deliberately excluded from both the 6- and 12-month committed plans.

---

# 10. Release Strategy

### Release 1 — Stabilized MVP
- **Features:** CI/CD, working refresh-token loop, Postgres, security hardening, attendance/access bug
  fixes, verified (not just built) Fees/Messaging/CRUD/dashboard, extracted shared UI components.
- **Target users:** Internal team + a single friendly pilot school under close supervision.
- **Business value:** The first version safe enough to put real student/fee data on.
- **Product maturity:** Commercially Credible (lower end).

### Release 2 — Commercial School Platform
- **Features:** Release 1 + JazzCash/EasyPaisa payment gateway, push notifications, parent-app
  second-pass UI polish.
- **Target users:** A small cohort of paying pilot schools.
- **Business value:** First version with a real payment story and mobile-parity UX — the two biggest
  named gaps against global table-stakes.
- **Product maturity:** Commercially Credible (upper end) → early Growth.

### Release 3 — Parent Engagement Platform
- **Features:** Release 2 + WhatsApp/SMS channels, digest bundling, offline caching extended to
  Fees/Messages/Leave, remaining MVP-scope gaps (report cards, Holiday model, complaints,
  forgot-password).
- **Target users:** General availability to Pakistani private schools matching the target profile.
- **Business value:** Retention-focused — the version that keeps a school past its first term.
- **Product maturity:** Growth.

### Release 4 — School Operating System
- **Features:** Release 3 + full accessibility program, app-chrome localization, deepened multi-campus
  admin analytics, audit-log viewer.
- **Target users:** General availability, including small multi-campus school networks.
- **Business value:** Positions the product as a complete operating layer, not a point solution.
- **Product maturity:** Growth → early Differentiated.

### Release 5 — Differentiated Platform
- **Features:** Release 4 + AI-assisted staff drafting, predictive/early-warning attendance analytics,
  EMI-style fee installments, admissions/lottery module.
- **Target users:** General availability, competing on differentiation rather than parity.
- **Business value:** The version that competes on "meaningfully better," not just "equivalent."
- **Product maturity:** Differentiated.

---

# 11. Success Metrics

No baseline values are invented — none of the four source documents report production usage data (the
codebase is pre-pilot). Targets below are explicitly labeled **Proposed target** and should be replaced
with real baselines the moment any pilot school goes live.

- **School onboarding time** — time from signed pilot agreement to first live attendance mark.
  *Proposed target: under 1 week*, given the seed-script-only account-creation gap closes in Release 1.
- **Parent activation rate** — % of enrolled-student parent accounts that complete first login.
  *No baseline; measure from Release 1's first pilot.*
- **Weekly active parents** — % of activated parent accounts opening the app at least once/week.
  *No baseline.*
- **Teacher adoption** — % of teachers marking attendance without an admin nudge.
  *No baseline; the attendance-marking bug fix (Sprint C) is a prerequisite to measuring this honestly.*
- **Attendance completion rate** — % of school days with attendance marked by end-of-day.
  *No baseline.*
- **Fee collection rate** — % of issued vouchers paid within the due window, once the gateway (Release 2)
  and cash-reconciliation workflow exist.
  *No baseline; cannot be measured pre-Release 2.*
- **Notification engagement** — % of push notifications opened, once FCM (Release 2) ships.
  *No baseline.*
- **Homework engagement** — % of diary entries viewed by the relevant parent within 24 hours.
  *No baseline; the diary module already has read-tracking infrastructure to source this from.*
- **Support tickets** — volume/category, tracked from first pilot onward as a direct signal of which
  gaps in this roadmap are actually load-bearing versus theoretical.
- **Feature adoption** — % of active schools using Fees/Messaging/Leave beyond a first-week trial.
- **System performance** — p95 API latency, tracked once a real monitoring stack exists (none is
  confirmed present today).
- **Crash/error rate** — Flutter crash-free-session rate; backend 5xx rate — both require adding
  monitoring, which is not confirmed to exist in the current stack.

---

# 12. Risk Management

| Risk | Category | Probability | Impact | Mitigation |
|---|---|---|---|---|
| A pilot school goes live before Phase 0 (Tier 0) closes, and hits the refresh-token/SQLite/security gaps in production | Technical | High if sequencing isn't enforced | Severe — data loss/breach risk, reputational damage echoing the PowerSchool breach pattern the competitor research warns about | Hard-gate any pilot commitment behind Phase 0 completion; do not let a sales timeline override this |
| Fees/Messaging scoping turns out weaker than the UI/UX Audit's "live-wired" claim suggests once verified (Phase 1) | Product / Security | Medium — the two source audits genuinely disagree here | High — a scoping gap in Fees/Messaging is a real cross-student data-exposure risk | Phase 1's verification pass is mandatory, not optional, precisely because of this disagreement |
| JazzCash/EasyPaisa merchant onboarding takes longer than engineering expects | Integration | Medium-High — vendor-side process, not controlled by the team | Medium — delays Release 2 and the EMI-installment differentiator that depends on it | Start merchant onboarding in parallel with Phase 1, not when Phase 2 engineering begins |
| No job-runner/scheduler exists yet, and three separate features (payment polling, digest bundling, risk recompute) each need one | Technical / Architecture | High if not addressed deliberately | Medium — three ad hoc solutions compound into real maintenance debt | Make one job-runner decision in Phase 2, reuse it in Phases 4 and 8 |
| Staff console's desktop-only shell is never explicitly scoped, and a customer expects tablet/phone admin use | Product / UX | Medium | Medium — support burden and a credibility gap against documented (but unmet) breakpoints | Force the explicit scope decision in Sprint J rather than leaving it implied |
| AI-drafting feature is perceived as a "press release" feature rather than genuinely time-saving, echoing the Teachmint EduAI pattern the competitor research warns against | Product / Adoption | Medium | Medium — wastes a differentiation sprint if adoption is low | Ship it as an optional "suggest draft" action a staff member can ignore, not a forced flow; measure actual usage before investing further |
| Admissions/lottery module (Phase 8) is scoped too large for a single sprint, given it's the only entirely-new bounded context in this roadmap | Scope | Medium-High | Medium — schedule slip on the least time-critical committed item | Ship the core application flow first (Month 12), treat full audit-trail depth as a stretch goal, not a Definition of Done blocker |
| Cross-campus staff-access scoping gap (Repo Audit finding) is never addressed because it's "fine at current scale" | Security | Low near-term, rising as multi-campus schools onboard | Medium | Track explicitly in the backlog rather than letting "fine for now" become permanent; revisit before onboarding any school with more than one campus and multiple staff |
| Offline-caching extension (Phase 3) is deprioritized because it's not user-visible in a demo | Product / UX | Medium | Medium — exactly the Fees/Messages screens where stale-but-visible data matters most, per the UI/UX Audit | Keep it as an explicit Sprint G line item, not a "nice to have" that slips |

---

# 13. Build vs Defer

## Build

- Everything in Phase 0 (CI/CD, refresh-token loop, Postgres, security hardening, attendance/access bug
  fixes) — non-negotiable prerequisites.
- A verification pass on Fees/Messaging/CRUD/dashboard (Phase 1) — the two source audits disagree, so
  this must be checked before anything is built on top of it.
- JazzCash/EasyPaisa payment gateway + cash reconciliation (Phase 2) — highest business value, UI
  already built, shape already validated by competitor research.
- Push notifications, FCM (Phase 3) — named global table-stakes, currently absent entirely.
- Parent-app second-pass UI polish (Phase 3) — closes the visible maturity gap between the two clients.
- WhatsApp/SMS channels + digest bundling (Phase 4) — Pakistan-specific, competitor-validated pattern.
- The small remaining MVP-scope gaps: report cards, Holiday model, complaint tracking, forgot-password,
  teacher timetable view, bulk attendance endpoint, conflict detection (Phase 5).
- Accessibility infrastructure + a deliberate localization/responsive-shell scope decision (Phase 6).
- AI-assisted staff drafting and predictive attendance analytics (Phase 7–8) — the two differentiators
  with the clearest competitor-validated pattern and lowest architectural risk.
- EMI-style fee installments (Phase 8) — the single most directly transferable competitor idea
  (Teachmint's TeachPay) in the entire research set.
- A scoped-down admissions/lottery module — core application flow only, sized for a single school or
  small network, not district scale.

## Defer

- **Full standards-based/mastery gradebook, formal exams/assessments** — `MVP-Plan-V3` deliberately
  substituted a static report-card PDF; a live gradebook is a Schoology/Toddle-scale investment with no
  evidence the target segment (small private schools) needs it before the Build list above is done.
- **Transport, Library, Canteen, Inventory, HR, Payroll** — excluded by `MVP-Plan-V3` *and*
  independently market-validated: none of the ten global leaders researched build these as core product.
- **AI tutor / generative content for students** — explicitly excluded by `MVP-Plan-V3`; also the
  clearest "AI as press release" trap the competitor research warns against.
- **Campus-switching admin UI** — multi-campus already works as a schema property; a switching UI adds
  no capability that doesn't already exist.
- **Separate Teacher Portal / Admin Portal apps, a separate parent web portal** — the exact fragmentation
  the market (PowerSchool, Schoology, Remind/ParentSquare) is now paying multi-year integration cost to
  undo. SchoolPortal's single-backend, two-client architecture is a protected advantage, not a gap.
- **District-scale compliance reporting (Ed-Fi/SIF), a 75+-integration marketplace** — PowerSchool/
  Alma-tier enterprise capability; the target customer (single school to small network) has no
  regulatory or procurement need for it yet.
- **A custom drag-and-drop report builder** — named by Alma's own reviewers as a pain point even at
  enterprise scale (rigid, CSV-dependent complaints); high effort, unproven demand at this scale.
- **RFID/biometric attendance, cashless canteen wallets** — excluded by `MVP-Plan-V3`; hardware-dependent,
  no evidence of demand ahead of the software layer being credible.
- **District/enterprise-scale admissions depth (lottery-fairness audit trail at PowerSchool Enrollment's
  scale)** — build the core flow (Build list, Month 12); defer the full audit-trail sophistication until
  a customer's scale actually demands it.

---

# 14. Final Recommendation

### Question 1 — What prevents SchoolPortal from being considered a credible commercial school-management platform today?

1. No CI/CD — a real 45+-file test suite exists and nothing runs it automatically on a PR.
2. A dead refresh-token loop — every real session degrades to unexplained 401s after 15 minutes.
3. SQLite still in place for a codebase about to hold real attendance/fee data.
4. Unresolved security defaults (unbounded uploads, wide-open CORS, hardcoded JWT fallback, no rate
   limiting) — individually mild, stacked they're exactly the failure class behind PowerSchool's 2025
   breach of ~62M student records.
5. The Admin/Super-Admin attendance-marking bug — a role the system authorizes but can't actually use.
6. Genuine uncertainty (not confirmed absence, but not confirmed presence either) about whether the
   already-built Fees/Messaging modules enforce the same isolation rigor proven on Attendance/Diary —
   this must be verified, not assumed, before either is trusted with real fee/message data.
7. No payment gateway — Fees has a UI and a schema but no way to actually collect money digitally.
8. No push notifications on either client — a named global table-stakes item present on zero screens.

### Question 2 — What exact features should be implemented next?

In order: the Phase 0 stabilization items (§3), a Fees/Messaging verification pass (Phase 1), the
JazzCash/EasyPaisa payment gateway (Phase 2), push notifications (Phase 3), and the parent-app
second-pass UI polish (Phase 3). Everything else in this roadmap follows, but these five are what
converts the current codebase into something a pilot school can actually run on.

### Question 3 — What should be fixed before adding new functionality?

Session reliability (refresh-token loop), the database engine (Postgres), the four stacked security
defaults, and the attendance-marking bug. None of this is new functionality — it's the floor every
feature above it depends on, and it's exactly what the Repo Audit and Gap Analysis both name as
non-negotiable before anything else.

### Question 4 — What should NOT be built yet?

Everything in the Defer list (§13): a live gradebook, Transport/Library/Canteen/Inventory/HR/Payroll, an
AI tutor for students, separate portal apps, district-scale compliance/integration depth, a custom
report builder, and RFID/biometric/cashless-canteen hardware integrations. None of the ten global
competitors reviewed build most of these either — this exclusion list is market-validated, not just
internally convenient.

### Question 5 — What can make SchoolPortal meaningfully better than global competitors rather than merely equivalent?

The combination the competitor research explicitly says no researched competitor — including the
closest regional analog, Teachmint — fully matches: correct bilingual (Urdu/English) content handling
(already ahead, not aspirational), local payment rails with a first-class cash/manual-reconciliation
workflow (not a digital-only assumption), WhatsApp/SMS fallback for uneven connectivity, and a genuinely
unified single-backend architecture protecting against the fragmentation the market's biggest names are
paying years to undo.

### Question 6 — What should become the product's strongest differentiator?

Local payment-rail depth — JazzCash/EasyPaisa plus cash reconciliation plus, eventually, EMI-style
installments (Teachmint's TeachPay pattern) — because it's simultaneously the highest scored opportunity
in the Gap Analysis, the most Pakistan-specific gap identified, and the one with the clearest
competitor-validated mechanism to copy.

### Question 7 — What should the team build over the next 6 months?

Phase 0 through Phase 5 as sequenced in §8: stabilization, verification, the payment gateway, push
notifications, parent-app UI parity, WhatsApp/SMS, and the remaining small MVP-scope gaps (report cards,
Holiday model, complaints, forgot-password). This is Release 1 through the start of Release 3.

### Question 8 — What should the team build over the next 12 months?

Everything in Question 7, plus (§9): accessibility infrastructure, a deliberate localization/
responsive-shell decision and build-out, AI-assisted staff drafting, predictive attendance analytics,
EMI-style fee installments, and the core flow of a scoped-down admissions module. This is Release 3
through Release 5.

---

# 15. Final Executive Summary

## "If I Were the Product & Engineering Lead"

### Top 10 priorities
1. Stop the session from silently breaking (refresh-token loop).
2. Stand up CI so the existing 45+-file test suite actually protects `main`.
3. Migrate to Postgres and close the four stacked security defaults.
4. Fix the Admin/Super-Admin attendance bug — one line of damage to credibility for almost no fix effort.
5. Verify — don't assume — that Fees and Messaging enforce the same isolation rigor already proven on
   Attendance/Diary.
6. Ship the JazzCash/EasyPaisa gateway; the UI and schema are already built and waiting on it.
7. Ship push notifications on both clients — the single most-named global table-stakes gap.
8. Bring the parent app's UI up to the staff console's 2026-09-07 maturity — right now they read as two
   different products.
9. Add WhatsApp/SMS fallback channels — the most Pakistan-specific, least-matched-by-any-competitor gap.
10. Extract shared staff-console UI components (`EntityTable`, `ConfirmDialog`) — the highest-leverage
    fix that isn't feature work, and the one most likely to be skipped if it isn't made a first-class
    sprint.

### Recommended sprint order
Sprint A/B (stabilization) → Sprint C (verification + bug fixes) → Sprint D (component extraction, in
parallel) → Sprint E (payment gateway) → Sprint F (push) → Sprint G (parent UI polish, in parallel with
F) → Sprint H (WhatsApp/SMS) → Sprint I (remaining gaps) → Sprint J (accessibility/localization) →
Sprint K (differentiation kickoff).

### Major architectural decisions
Introduce a `NotificationDispatchService` abstraction once, in Sprint F, and reuse it for push,
WhatsApp, SMS, and digest bundling rather than building three ad hoc integrations. Introduce a
`PaymentGateway` interface mirroring the existing `StorageAdapter` pattern rather than hardcoding
JazzCash/EasyPaisa directly into `FeesService`. Make one job-runner/scheduler decision early (needed by
payment polling, digest bundling, and nightly risk recomputation) instead of three teams inventing three
schedulers independently.

### Major UI decisions
Commit explicitly to either a real responsive staff-console shell or a documented desktop-only scope —
don't leave it implied. Commit explicitly to a localization scope (which chrome, on which client) before
starting the i18n build-out. Extract shared components before the CRUD screen count grows further, since
every additional screen built against the current pattern compounds the duplication debt.

### Features to defer
A live gradebook and formal assessments, Transport/Library/Canteen/Inventory/HR/Payroll, an AI tutor for
students, separate portal apps, district-scale compliance/integration depth, a custom report builder,
and RFID/biometric/cashless-canteen hardware — see §13 for the full list and reasoning per item.

### Competitive strategy
Don't chase feature parity with PowerSchool/Alma's enterprise SIS depth — that's the wrong market. Don't
chase ClassDojo/Remind's pure-engagement play either — that would strand the SIS-shaped foundation
already built (Enrollment, RBAC, the Prisma schema). Compete on the combination no researched competitor
fully matches: bilingual content correctness + local payment rails + cash-tolerant workflows +
WhatsApp/SMS fallback, on top of an already-unified architecture the market's biggest names are paying
years to retrofit.

### Product positioning
Pakistan-first School Operating System, built around a Parent Super App core — not a generic SaaS SIS,
not a pure communication app, but the hybrid the target customer (single-campus to small multi-campus
private Pakistani K-12 schools) actually needs.

### 6-month outcome
A codebase that has closed every Tier 0 stabilization item, verified its already-built Fees/Messaging/
CRUD/dashboard modules rather than assumed them correct, shipped a real payment gateway and push
notifications, and brought both clients to comparable UI maturity — in short, a platform a pilot school
can actually be put on without an engineer on standby, and a Release 3-candidate feature set.

### 12-month outcome
The above, plus a completed accessibility program, a deliberate and executed localization decision, and
the first three genuinely differentiated capabilities — AI-assisted staff drafting, predictive
attendance early-warning, and EMI-style fee installments — plus the foundational flow of a
right-sized admissions module. A platform that competes on being meaningfully better in a specific,
evidenced way, not merely equivalent to the ten global leaders it was benchmarked against.

---

*Compiled 2026-09-08. Synthesizes `SchoolPortal-Repo-Audit-2026-09-08.md` (commit `1e74697`),
`SchoolPortal-Global-Competitor-Research-2026-09-08.md`, `SchoolPortal-Gap-Analysis-Feature-
Prioritization-2026-09-08.md` (built on the `1e74697` baseline), and
`SchoolPortal-UIUX-Audit-Modernization-Roadmap-2026-09-08.md` (commit `988278a`, the newest evidence).
No new research was performed. §0 documents the required reconciliation between the two commit
snapshots; every phase, sprint, and recommendation above is built on that reconciled picture.*
