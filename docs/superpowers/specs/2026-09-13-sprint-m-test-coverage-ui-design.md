# Sprint M — P0 Test Coverage, UI Half

Status: approved (design), ready for implementation planning.
As of `main` at commit `bb7bd14..67aa03b` (backend half of this same gap already closed
2026-09-12, plan: `build/docs/superpowers/plans/2026-09-12-p0-test-coverage-backfill.md`) plus
Sprint L (`cross-tenant access control) merged on top.
Spec source: `docs/Plan-Ideas/PHASE-1/SchoolPortal-PostMVP-Roadmap-2026-09-08.md`, Implementation
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
  covered already, not a gap. `TeacherComplaintsPageView.vue` (the page-level wrapper) has no spec.
- `ReportCardsView.vue` and `ReportCardsPageView.vue` both exist, neither has a `.spec.ts`.
- `TeacherReportCardsView.vue` **already has** `TeacherReportCardsView.spec.ts` (same Sprint I
  precedent as Complaints) — covered. `TeacherReportCardsPageView.vue` has no spec.
- **Correction to the roadmap:** it names `TeacherReportCardsView` as needing coverage — that one
  file is already covered; the actual gap is the four `*PageView.vue` wrappers plus the two admin
  (non-teacher) views, not the teacher views themselves.
- "Suggest draft" button: confirmed absent from test coverage. `grep -i suggest` across
  `DiaryView.spec.ts`/`CircularsView.spec.ts` returns zero hits — genuinely untested, matching the
  roadmap.
- Attendance-risk dashboard panel: **confirmed untested, and worse than "no coverage" — the
  fetch call itself isn't even mocked.** `AdminHomeView.vue:33` calls
  `api.getFlaggedStudents(auth.accessToken)` on mount; `AdminHomeView.spec.ts`'s `vi.mock('../lib/api', ...)`
  (line 10-12) only stubs `dashboardSummary`. Every existing test in that file mounts the view
  with `getFlaggedStudents` unmocked — an unhandled-rejection risk in every one of the file's three
  existing tests, not just an untested-but-harmless gap. Fixing this is now in scope for this
  sprint, not just adding a new test.

**Parent-app — confirmed:** `lib/src/screens/complaints_screen.dart` and
`lib/src/screens/report_cards_screen.dart` both exist; `find test -iname "*complaint*" -o -iname "*report*"`
returns nothing — zero existing test files for either screen.

## Decisions this spec makes so engineering doesn't have to guess

**Fix the `getFlaggedStudents` mock gap in the same commit as the new risk-panel test**, not as a
separate cleanup — it's the same file, same root cause (a fetch call added in Sprint K without a
matching mock update), and splitting it into two changes would leave the existing three tests
silently fragile in between.

**Coverage bar matches this project's established convention, not a new stricter one:** one
component/widget spec per view file, covering the state machine already used everywhere else in
this codebase (loading → success → empty → error), any role-gating the view enforces, and the
one or two view-specific behaviors flagged below. No snapshot testing, no new test-infrastructure
patterns — plain `@vue/test-utils`/`vitest` (staff-console) and `flutter_test` (parent-app), same
as every other spec in the tree.

**No production-code behavior changes** except the one true bug found above (the unmocked
`getFlaggedStudents` call is a test-file fix, not a production fix — production already awaits it
correctly). If a test surfaces a real behavior gap while being written, fix it inline and note it
in the plan's verification section — matching Sprint F/G's own precedent (both found and fixed
real bugs during their "add tests" work) — but this is not expected to be the norm here since these
five modules already shipped and were smoke-tested once, per Sprint I/J/K's own notes.

## Design

### 1. `HolidaysView.spec.ts` / `HolidaysPageView.spec.ts`
Mirror `AcademicSessionManagementView.spec.ts` (or whichever existing admin CRUD spec is most
current post-Sprint-D) as the template: mount → assert list renders from a mocked
`api.listHolidays` → create via the `EntityTable`/`FormField`/`ConfirmDialog` flow already proven
on every other CRUD screen → delete goes through `useConfirm()` (not `window.confirm`, per Sprint
D's regression ban) → error state on a rejected fetch.

### 2. `ComplaintsPageView.spec.ts` / `ComplaintsQueueView.spec.ts`
Queue-view shape (list + status-transition action, no delete, per the Complaints module's own
design) — assert `open → in_progress → resolved` transitions call `api.updateComplaint` with the
right status, and that the queue is `SCHOOL_ADMIN`/`SUPER_ADMIN`/`ACCOUNTS`-gated per whatever role
check the view already implements (confirm the exact guard in the source file — not re-derived
here — before writing the assertion).

### 3. `ReportCardsView.spec.ts` / `ReportCardsPageView.spec.ts`
Admin/staff upload flow: student picker + session picker + file input → `api.uploadReportCard`
called with the right `FormData` shape → the existing-list re-renders after a successful upload →
a duplicate-upload 409 (per `report-cards.service.ts:42-47`'s `ConflictException`) surfaces as a
visible error, not a silent failure.

### 4. `TeacherComplaintsPageView.spec.ts` / `TeacherReportCardsPageView.spec.ts`
Thin page-wrapper specs only (the underlying `TeacherComplaintsView`/`TeacherReportCardsView`
components are already covered) — assert the wrapper resolves the right section/student scope and
passes it down, matching whatever the already-tested inner component expects as props.

### 5. "Suggest draft" button (`DiaryView.spec.ts` / `CircularsView.spec.ts` additions)
Add cases to the existing spec files (not new files — the button lives inside these existing
compose forms): clicking "Suggest draft" calls `api.suggestDraft(...)` (confirm the exact method
name in `lib/api.ts` before writing the mock) and populates the compose textarea with the
response; the button never auto-publishes — asserting the publish action still requires an
explicit separate click, per the roadmap's own "never auto-publishing without staff review"
constraint from Sprint K's spec.

### 6. Attendance-risk dashboard panel (`AdminHomeView.spec.ts` additions + mock fix)
```ts
vi.mock('../lib/api', () => ({
  api: { dashboardSummary: vi.fn(), getFlaggedStudents: vi.fn() },
}));
```
Add `vi.mocked(api.getFlaggedStudents).mockResolvedValue([...])` (and `.mockReset()` in
`beforeEach`, matching the existing `dashboardSummary` pattern) to every existing test in the file
so none of them exercise an unmocked call anymore, then add:
- a case asserting `[data-testid="attendance-risk-panel"]` renders one row per flagged student
  when `getFlaggedStudents` resolves a non-empty array;
- a case asserting the panel is absent when it resolves `[]` (extends the existing "with
  at-risk/teachers-absent dropped" test's intent to the new panel specifically);
- a case asserting a rejected `getFlaggedStudents` call surfaces gracefully (does not blank the
  rest of the dashboard — confirm the view's actual error-isolation behavior before asserting a
  specific UI outcome, since this path has never been exercised before).

### 7. `complaints_screen_test.dart` / `report_cards_screen_test.dart` (parent-app)
New files under `test/`, following whatever existing screen-test template this project uses for a
comparable read-list screen (e.g. the Leave or Messages screen test, if one already covers a
similar "list scoped to the active child" shape — confirm the closest existing template before
writing rather than inventing a new widget-test pattern). Cover: loading → populated list for the
active child → empty state → `activeChildId` switch reloads the list for the newly-selected child
(the exact bug class Sprint G fixed on Leave/Messages — worth explicitly asserting here since these
two screens were never checked for it).

## Testing

This entire sprint *is* testing — no separate "Testing" section beyond Design §1-7 above. Definition
of done: every file named in Design §1-7 has a passing spec/test; the full existing suites
(backend, staff-console, parent-app) stay green; `AdminHomeView.spec.ts`'s three pre-existing tests
no longer run against an unmocked `getFlaggedStudents` call.

## Out of scope this sprint

- Any new feature behavior — this sprint adds tests, and fixes exactly one test-infrastructure gap
  (the unmocked `getFlaggedStudents` call), nothing else.
- RBAC/e2e backend coverage — already closed 2026-09-12 per the roadmap's own note ("Backend half of
  the test-coverage gap closed").
- Visual/snapshot regression testing — not this project's established pattern; not introduced here.
