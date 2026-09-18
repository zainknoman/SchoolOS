# Sprint M — P0 Test Coverage, UI Half

Status: approved (design), ready for implementation planning.
As of `main` at commit `bb7bd14..67aa03b` (backend half of this same gap already closed
2026-09-12, plan: `build/docs/superpowers/plans/2026-09-12-p0-test-coverage-backfill.md`) plus
Sprint L (`cross-tenant access control) merged on top.
Spec source: `docs/Plan-Ideas/PHASE-1/SchoolOS-PostMVP-Roadmap-2026-09-08.md`, Implementation
Checklist, Sprint M:
- Staff-console spec coverage for `HolidaysView`, `ComplaintsPageView`/`ComplaintsQueueView`,
  `ReportCardsView`/`ReportCardsPageView`/`TeacherReportCardsView`, the "Suggest draft" button, and
  the attendance-risk dashboard panel.
- Parent-app spec coverage for `complaints_screen.dart`/`report_cards_screen.dart`.

No new features, no new architecture. This sprint closes the "known gap" flagged repeatedly in
Sprints I/J/K's own Implementation Checklist entries: five backend modules shipped without
dedicated UI test coverage on either client.

## Reconciliation with the roadmap doc before scoping work

Verified directly against `build/staff-console/src` and `build/parent-app` rather than assumed —
this project's specs have repeatedly found the roadmap's item list slightly stale on specifics.

**Staff-console — confirmed, with one correction to the roadmap's own list:**
- `HolidaysView.vue` **and** `HolidaysPageView.vue` both exist, neither has a `.spec.ts`.
- `ComplaintsPageView.vue` and `ComplaintsQueueView.vue` both exist, neither has a `.spec.ts`.
- `TeacherComplaintsView.vue` **already has** `TeacherComplaintsView.spec.ts` (shipped as part of
  Sprint I's own gap-closing pass, per that sprint's Implementation Checklist entry) — genuinely
  covered already, not a gap.
- `ReportCardsView.vue` and `ReportCardsPageView.vue` both exist, neither has a `.spec.ts`.
- `TeacherReportCardsView.vue` **already has** `TeacherReportCardsView.spec.ts` (same Sprint I
  precedent as Complaints) — covered.
- **Correction to the roadmap, and a second finding beyond what was asked:** it names
  `TeacherReportCardsView` as needing coverage — that file is already covered; the actual content-view
  gap is `HolidaysView`, `ComplaintsQueueView`, and `ReportCardsView` only. Every `*PageView.vue` in
  this codebase (`ls views/*PageView*.vue` — 19 files, including `HolidaysPageView`,
  `ComplaintsPageView`, `ReportCardsPageView`, `TeacherComplaintsPageView`,
  `TeacherReportCardsPageView`) is a **zero-logic wrapper**, byte-for-byte the same shape:
  `<AppShell><TheRealView /></AppShell>`, no props, no computed state, no conditionals. **None of
  the 19 has a spec anywhere in the tree** — this is an established, consistent pattern across the
  entire app, not a per-module oversight. Writing specs for the four wrappers named in the roadmap
  would invent a testing pattern this codebase deliberately doesn't use anywhere else, for files
  with no branching logic to exercise. This sprint tests the content views only
  (`HolidaysView`/`ComplaintsQueueView`/`ReportCardsView`); the `*PageView` wrappers are correctly
  covered by nothing, matching every other `*PageView` in the app.
- "Suggest draft" button: confirmed absent from test coverage. `grep -i suggest` across
  `DiaryView.spec.ts`/`CircularsView.spec.ts` returns zero hits — genuinely untested, matching the
  roadmap.
- Attendance-risk dashboard panel: **confirmed untested — the fetch call itself isn't even
  mocked, though production code already tolerates that.** `AdminHomeView.vue:32-36` calls
  `api.getFlaggedStudents(auth.accessToken)` inside its own dedicated `try/catch` that silently
  swallows any failure with an explicit comment ("Non-critical — the rest of the dashboard still
  renders without the early-warning panel"). `AdminHomeView.spec.ts`'s `vi.mock('../lib/api', ...)`
  (line 10-12) only stubs `dashboardSummary`, so in every existing test `api.getFlaggedStudents` is
  `undefined` — calling it throws synchronously, and that throw is caught by the component's own
  `try/catch` exactly as a real rejected call would be. **Not a live bug** (no unhandled rejection,
  no test failure today) — but the panel's actual rendering path (populated list, empty state) has
  never been exercised by any test, which is the real gap this sprint closes.

**Parent-app — confirmed:** `lib/src/screens/complaints_screen.dart` and
`lib/src/screens/report_cards_screen.dart` both exist; `find test -iname "*complaint*" -o -iname "*report*"`
returns nothing — zero existing test files for either screen.

## Decisions this spec makes so engineering doesn't have to guess

**Add the `getFlaggedStudents` mock to the same file's existing `vi.mock` block as part of adding
the new risk-panel tests**, not as a separate cleanup — it's the same file, same root cause (a
fetch call added in Sprint K without a matching mock update). This is a test-file completeness fix,
not a production bug fix: the component's own `try/catch` already made the missing mock harmless.

**Coverage bar matches this project's established convention, not a new stricter one:** one
component/widget spec per view file, covering the state machine already used everywhere else in
this codebase (loading → success → empty → error), any role-gating the view enforces, and the
one or two view-specific behaviors flagged below. No snapshot testing, no new test-infrastructure
patterns — plain `@vue/test-utils`/`vitest` (staff-console) and `flutter_test` (parent-app), same
as every other spec in the tree.

**No production-code behavior changes this sprint** — the `getFlaggedStudents` gap above is a
test-file completeness fix only; production code already handles it correctly. If a test surfaces
a real behavior gap while being written, fix it inline and note it
in the plan's verification section — matching Sprint F/G's own precedent (both found and fixed
real bugs during their "add tests" work) — but this is not expected to be the norm here since these
five modules already shipped and were smoke-tested once, per Sprint I/J/K's own notes.

## Design

### 1. `HolidaysView.spec.ts`
Mirror `CampusManagementView.spec.ts` (same `EntityTable`/`FormField`/`AppModal`/`useConfirm` shape,
admin-only CRUD, one dependent lookup list) as the exact template: mount → assert list renders from
a mocked `api.listHolidays` (paired with `api.listCampuses`, since `HolidaysView.vue` loads both) →
create via the add-modal flow → edit (title/dates only, matching the view's actual editable fields)
→ delete goes through `useConfirm()` (not `window.confirm`, per Sprint D's regression ban), including
the "confirmation declined does nothing" case → error state on a rejected `listHolidays`/
`listCampuses`/`createHoliday`/`updateHoliday`/`deleteHoliday` call.

### 2. `ComplaintsQueueView.spec.ts`
Queue-view shape: a student picker drives which student's complaints load
(`api.listAdminStudents` then `api.listComplaints(token, studentId)` on selection) → raise a new
complaint via the add-modal (`api.createComplaint`) → a status `<select>` per row calls
`api.updateComplaintStatus(token, id, status)` and reloads the list → error state on any of the
four API calls failing. Role-gating for this screen is enforced by the router
(`router/index.ts:164-167`'s `meta.requiresRole: ['SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN']`), not
by the component itself — this project has no router-guard test suite at all yet, and adding one is
new, unrequested scope beyond this sprint's five named modules, so this spec does not assert
role-gating at the component level (there is none to assert).

### 3. `ReportCardsView.spec.ts`
Admin/staff upload flow: student picker + session picker + file input → `api.uploadReportCard`
called with the right `FormData` shape → the existing-list re-renders after a successful upload →
a duplicate-upload 409 (per `report-cards.service.ts:42-47`'s `ConflictException`) surfaces as a
visible error, not a silent failure.

### 4. "Suggest draft" button (`DiaryView.spec.ts` / `CircularsView.spec.ts` additions)
Add cases to the existing spec files (not new files — the button lives inside these existing
compose forms): clicking "Suggest draft" calls `api.suggestDraft(...)` (confirm the exact method
name in `lib/api.ts` before writing the mock) and populates the compose textarea with the
response; the button never auto-publishes — asserting the publish action still requires an
explicit separate click, per the roadmap's own "never auto-publishing without staff review"
constraint from Sprint K's spec.

### 5. Attendance-risk dashboard panel (`AdminHomeView.spec.ts` additions + mock fix)
```ts
vi.mock('../lib/api', () => ({
  api: { dashboardSummary: vi.fn(), getFlaggedStudents: vi.fn() },
}));
```
Add `getFlaggedStudents: vi.fn()` to the mock factory and `vi.mocked(api.getFlaggedStudents).mockReset()`
to `beforeEach`, then give every existing test a `.mockResolvedValue([])` default (matching today's
de-facto empty-panel behavior) so each stays exercising exactly what it exercises today, then add:
- a case asserting `[data-testid="attendance-risk-panel"]` renders one `risk-student-*` row per
  flagged student, with the rounded `absenceRate` percentage, when `getFlaggedStudents` resolves a
  non-empty array;
- a case asserting the panel is absent when it resolves `[]` (extends the existing "with
  at-risk/teachers-absent dropped" test's intent to the new panel specifically);
- a case asserting a rejected `getFlaggedStudents` call is swallowed by the component's own
  `try/catch` (`AdminHomeView.vue:32-36`) — the panel is simply absent and the rest of the
  dashboard (KPIs, trends chart) still renders normally, with no error message shown for this
  specific failure (confirmed production behavior, not a new assertion invented for this test).

### 6. `complaints_screen_test.dart` / `report_cards_screen_test.dart` (parent-app)
New files under `test/`, following whatever existing screen-test template this project uses for a
comparable read-list screen (e.g. the Leave or Messages screen test, if one already covers a
similar "list scoped to the active child" shape — confirm the closest existing template before
writing rather than inventing a new widget-test pattern). Cover: loading → populated list for the
active child → empty state → `activeChildId` switch reloads the list for the newly-selected child
(the exact bug class Sprint G fixed on Leave/Messages — worth explicitly asserting here since these
two screens were never checked for it).

## Testing

This entire sprint *is* testing — no separate "Testing" section beyond Design §1-6 above. Definition
of done: every file named in Design §1-6 has a passing spec/test; the full existing suites
(backend, staff-console, parent-app) stay green; `AdminHomeView.spec.ts`'s three pre-existing tests
no longer run against an unmocked `getFlaggedStudents` call.

## Out of scope this sprint

- Any new feature behavior — this sprint adds tests, and fixes exactly one test-infrastructure gap
  (the unmocked `getFlaggedStudents` call), nothing else.
- RBAC/e2e backend coverage — already closed 2026-09-12 per the roadmap's own note ("Backend half of
  the test-coverage gap closed").
- Visual/snapshot regression testing — not this project's established pattern; not introduced here.
