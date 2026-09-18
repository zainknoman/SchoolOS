# SchoolOS Staff Console — Design System Rollout Plan

Status: **Chunks 0–6 implemented, committed, and pushed to `origin/main`. Only the queued
management-view feature request (end of Section 12) remains.**
Date: 2026-09-18 (updated same day after new reference designs were added; progress
log added 2026-09-19)
Scope: primarily `staff-console` (Vue). A Flutter `parent-app` chunk is now included
(Section 7, Chunk 6) since reference mockups for it were added — but it's a different
tech stack (Dart/Flutter theming, not CSS) and should be treated as its own effort,
not folded into the CSS work below.

Edit this file directly (or tell me what to change) before any implementation starts.
Everything below is a proposal, not a decision.

**Changelog:** this revision incorporates a second batch of reference designs you
added to `docs/UI-Screenshots/sample4/` — a `listview` reusable-pattern mockup, 6
dashboard mockups (Principal ×2, School Admin, SuperAdmin, Teacher ×2), and 2 Flutter
parent-app home mockups. All of them changed something material below — not just
cosmetic detail. Read Sections 4.4, 6, 7, and 11 even if you already read the first draft.

---

## 1. Goal

Student Profile and Staff Profile are done and use a consistent visual language
(`ProfileIdentityCard`, `ProfileSectionCard`, pill-style `AppTabs`, card grids,
`EmptyState`/`ErrorRetry`). Right now that language is **hardcoded twice** — once in
each view's own `<style scoped>` block (~250 lines of near-identical CSS per file).

The ask: stop re-writing that CSS per page, and roll the same visual language out to
the rest of the app in a way that's actually less work per page, not the same amount
of work repeated 65+ times.

## 2. The key insight: most list pages are already one component away

Per the existing audit (`docs/audit/2026-09-18-ui-design-system-audit/findings.md`):

> `EntityTable.vue` already gives ~20+ CRUD screens loading/empty/error/search/pagination
> for free... the highest-leverage single fix, since ~20+ screens... are built on
> `EntityTable`.

**Every "list page" in the app already renders through one shared component.**
Restyle `EntityTable.vue` once, and every page that already uses it picks up the new
look with zero per-page changes to the table itself. `EntityTable.spec.ts` (checked)
asserts only behavior/testids, no CSS/class assertions — restyling it is low-risk.

**Update from the new `listview` reference (Section 4.4): a restyle isn't the whole
story.** The reference list page does more than `EntityTable` does today — row
selection with checkboxes, a bulk-action bar, and a persistent detail rail. That's new
*behavior*, not just new CSS. See 4.4 for what this means for scope.

## 3. Non-goals

- Not touching backend/API contracts, validation, auth, or routes anywhere.
- Not modifying `DESIGN.md` itself (a separate addendum can follow once this settles).
- Not doing a big-bang, all-views-at-once change. Everything is chunked so each piece
  stays reviewable and testable, same as Student → Staff.
- Backend/API work needed for Chunk 3 (Dashboards) per decision 11.6 is real but
  separate scoping work — this doc chunks the frontend/CSS rollout, not the backend
  endpoint audit that Chunk 3 will need before it starts.

## 4. Architecture: three layers

### 4.1 Global CSS layer — new `patterns.css` (shipped, Chunk 0)

**Decision 11.1: A — new file.** `src/assets/patterns.css`, imported in `main.css`
right after `base.css` — because `base.css` is pure **design tokens + resets**, while
what's extracted here is **reusable structural classes**, a different concern.

Classes extracted from `StudentProfileView.vue` / `StaffProfileView.vue`'s former
`<style scoped>` blocks (verbatim behavior, de-duplicated):

- `.field-group`, `.field-group.two-col`, `.group-title` (+ `::after` rule)
- `.field-grid`, `.field`, `.field-label`, `.field-value`, `.field-value.address-block`,
  `.field-hint`, `.mono`
- `.edit-form`, `.field-grid-edit`, `.form-actions`, `.add-form`, `.form-grid`, `.sr-only`
- `.contact-grid`/`.contact-card` and `.document-grid`/`.document-card` — likely
  mergeable into one generic `.entity-card-grid`/`.entity-card` pattern with modifiers
- `.priority-row`, `.priority-pills`, `.priority-pill`
- `.identity-skeleton`, `.skeleton-avatar`, `.skeleton-line` (+ `@keyframes skeleton-shimmer`)
- The shared responsive breakpoints (1024/768/480) that repeat across both files today

This chunk is a **pure refactor** — no visual change — so it's the safest first step.

### 4.2 Reusable component layer

Already shipped, reusable as-is:

| Component | Purpose |
|---|---|
| `ProfileIdentityCard.vue` | Identity header: photo, name, status, quick facts |
| `ProfileSectionCard.vue` | Titled panel with icon badge + actions slot |
| `AppTabs.vue` (`variant="pill"`) | Segmented-pill navigation |
| `AppModal.vue` (`icon`/`subtitle` props) | Modal with an icon + subtitle header |
| `FormField.vue` (`hint`/`mono` props) | Bordered-hint checkboxes, monospace fields |
| `EmptyState.vue`, `ErrorRetry.vue` | Already existed — just used consistently now |

**New, proposed:**

- **`ListPageCard.vue`** — page-level shell for list/CRUD pages: icon+title header,
  actions slot ("+ Add New"), a toolbar slot (search/filter chips), and a body slot.
  Shipped in Chunk 0 (decision 11.2: A). Not yet wired into any page — Chunk 2.
- **`EntityCardGrid.vue`** (maybe) — if the card-grid pattern needs real shared logic
  beyond CSS. Decide after Chunk 0.

### 4.3 `EntityTable.vue` visual restyle

Warm/premium surface, refined header row typography, row hover state, tabular-numeric
columns, and a responsive card-collapse below ~768px (audit-flagged as still-needed).
Free for every existing consumer once done. This part is purely visual/CSS — no
behavior change, so it's still safe to do project-wide in one pass.

### 4.4 What the `listview` reference reveals — this is not just a restyle

You added `listview/List View — reusable pattern-html/ListViewPattern.dc.html`,
explicitly labeled "Reusable list pattern — same shell for Staff, Parents, Fees,
Admissions." I read it. It's meaningfully richer than what `EntityTable.vue` does
today:

1. **Header row**: title + subtitle ("342 students · Reusable list pattern..."),
   Import/Export secondary buttons, primary "Add Student" button.
2. **Search + filter bar** (its own card): a search input plus filter *chips*
   (Grade 9 ✓, Section, Status, "More filters") — not a single search box.
3. **Bulk-action bar**: appears only when rows are checkbox-selected ("3 students
   selected"), dark background, with context actions (Assign section, Export
   selected, Archive). **This requires row selection state that doesn't exist in
   `EntityTable` today** — a new prop/emit, not CSS.
4. **Table**: avatar + two-line cell (name + mono GR-number), inline progress-bar
   cell (attendance %, color-coded by band), status pills, row actions revealed on
   hover (`opacity:0` → `1`).
5. **A persistent 280px "detail rail"** to the right of the table showing the
   selected row's summary (avatar, key facts, "Message parent" / "View full profile"
   buttons) — this is new UI, not present in any current list page.
6. Pagination footer — matches what `EntityTable` already has.

**This changes the shape of Chunk 2 (Section 8's table).** Two ways to proceed, and I'd treat
this as a real decision rather than assume:

- **Option A — restyle only.** Give `EntityTable` the visual treatment (4.3) and wrap
  existing list pages in `ListPageCard` for consistent chrome, but skip selection/
  bulk-actions/detail-rail. Lower effort, matches what today's pages actually do
  functionally. The "reusable pattern" mockup becomes aspirational reference, not a
  literal target yet.
- **Option B — build the richer pattern for real.** Add selection state + a bulk-action
  slot to `EntityTable` (or a new wrapper), and a generic detail-rail slot to
  `ListPageCard`. Higher effort, and **bulk actions need real backend support** —
  e.g. "Archive" 3 students at once implies a bulk-archive endpoint that may not exist
  yet. Each list page would need checking individually for what bulk operations
  actually make sense/exist.

I'd lean toward **A now, B later per-page as a follow-up** once a page's bulk-action
needs are concretely justified — but this is genuinely your call (11.8).

## 5. Timetable, Attendance, Messages — Chunk detail (reference designs provided)

Re-read from the cleaner per-screen exports in
`docs/UI-Screenshots/sample4/timetable-attendance-message/` (more precise than the
bundled bulk mockup I originally screenshotted from):

| Reference screen | Current file(s) | What it shows |
|---|---|---|
| **Attendance — Mark** | `AttendanceView.vue` (427 lines) | Title+date, section picker (top-right), progress bar ("18 of 28 marked · 64%") + "Mark all present" ghost button, per-student rows (avatar, name) with segmented P/A/L buttons (active state = filled color) plus a "⋯" overflow opening a small Leave/Holiday menu, sticky footer with Present/Absent/Late/Total counts + "Submit Attendance (18/28)" primary button |
| **Timetable — Teacher view** | `TeacherTimetableView.vue` (150 lines) | Read-only weekly grid (day rows × period columns), today's column/row highlighted |
| **Timetable — Admin view** | `TimetableView.vue` (1076 lines — see note) | Section picker, weekly grid overview + a "Manage periods" list below with inline row editing (day/period/time/subject/teacher/room, edit-in-place) |
| **Timetable — Bulk edit** | same `TimetableView.vue` | Full weekly grid as one big form: periods-per-day stepper, default room, working-days toggle row, per-cell subject+teacher dropdowns, per-day custom-times checkbox, "Save Timetable (24 periods)" |
| **Messages — Console** | `MessagesView.vue` (212 lines) | Two-pane: conversation list (avatar, name, preview, unread dot, timestamp) + thread view (bubbles, sender+time captions, confirmed correct RTL rendering for an Urdu message) |

**Note carried over:** `TimetableView.vue` at 1076 lines likely already contains both
the "admin view" grid and the "bulk edit" grid (matching the mockup showing them as
two states of one page). Worth a quick read-and-confirm at the start of this chunk.

## 6. Dashboards — Chunk detail (reference designs now provided, but they don't match today's IA)

You added 6 dashboard mockups: `Dashboard — Principal · School Overview`,
`Dashboard — Principal · Academics & Staff`, `Dashboard — School Admin · Operations`,
`Dashboard — SuperAdmin · Network Overview`, `Dashboard — Teacher · My Day`,
`Dashboard — Teacher · Gradebook`. I read all 6. **This is the one area where the
reference design implies a bigger change than a reskin**, and I want to flag that
clearly before it becomes an implementation surprise.

**What each mockup shows:**

- **Principal · School Overview**: 4 KPI cards with sparkline trend lines
  (Enrollment, Attendance today, Fee collection MTD, Outstanding fees) + "Today at a
  glance" (timed event list) + "Needs attention" (at-risk students, absences,
  pending admissions as colored-dot counts).
- **Principal · Academics & Staff**: a staff-attendance strip (segmented bar,
  Present/Absent/Leave counts) + a "Class health" table (attendance % + a marks-trend
  sparkline per class + teacher) + "Exam schedule status" (Ready/Pending/Draft pills).
- **School Admin · Operations**: 4 queue tiles (Admissions pending, Fee defaulters,
  Leave requests, Documents to verify — each icon+count+"Review →") + a Quick Actions
  grid (Add Student/Staff, Record Payment, New Circular, Bulk Import, Timetable) +
  Recent activity feed.
- **SuperAdmin · Network Overview**: 4 KPI cards (Schools, Total students, Total
  staff, System uptime) + a Schools table (campuses/students/fee collection/status
  per school) + a side rail (Quick actions: Manage Users/Audit Logs/Billing + Recent
  activity).
- **Teacher · My Day**: 3 compact stat cards (Classes today, Attendance marked, Unread
  messages) + a class timeline (time, class, room, status pill or a "Mark now"/"Mark
  attendance" action button, current class highlighted) + "Diary due today" list.
- **Teacher · Gradebook**: a "My classes — marks entry" list (class, term, progress
  bar + "X of Y entered", status pill, Review/Enter-marks button) + "Upcoming exams"
  countdown list.

**What actually exists today (checked):**

- One combined dashboard, `AdminHomeView.vue`, serves `SCHOOL_ADMIN`, `ACCOUNTS`, and
  `SUPER_ADMIN` alike (4 stat cards: Students, Present, Fees Collected, Outstanding +
  a secondary row) — there is no separate SuperAdmin or Principal dashboard.
- `PRINCIPAL` exists as an enum value in `backend/prisma/schema.prisma` but is **not**
  in the frontend's role list (`STAFF_ROLES = ['TEACHER','SCHOOL_ADMIN','ACCOUNTS',
  'SUPER_ADMIN']` in `router/index.ts`) — Principal has no frontend presence at all
  today.
- The `teacher-home` route renders `AttendanceView.vue` **directly** — there is no
  "My Day" landing page today; a teacher's home screen *is* the attendance-marking
  screen.
- The `/teacher/gradebook` route already exists and points at `MarksEntryPageView.vue`
  — today it's the marks-entry screen itself, not a gradebook *overview* in front of it.

**This means the mockups aren't just a reskin target — they describe new pages, a
new role in the frontend, and (for sparklines/trend deltas/staff-attendance-strip/
exam-status) possibly new backend aggregation endpoints that may not exist yet.**
I have not audited backend endpoint coverage for these. **Decision 11.6: build it for
real (Option B)** — see 11.6 for the reasoning and what that implies for scope. A
backend endpoint audit is the first step of this chunk, before any view work starts.

## 7. Flutter Parent App — new chunk (reference designs provided)

**Home** — 2 mockups: `Parent App — Home (Father accent)` and `(Mother accent)`. Same
layout, two different accent colors (blue `#0369a1` for "Father", magenta `#B0336B`
for "Mother"). Composition: header (school badge, name, greeting, notification bell)
→ horizontally-scrolling child-selector pills → a **"three-question hierarchy"** of
cards (Is my child at school today? / Any fees due? / How did the last test go?) →
Announcements → today's timetable preview → bottom nav
**(Home/Attendance/Fees/Results/More — 5 items)**.

**Calendar** — 3 more mockups added afterward: `Parent App — Calendar · Timetable`,
`· Attendance`, `· Diary`. These share one header ("Calendar" + selected child) and a
3-way segmented sub-tab (Timetable/Attendance/Diary) — not three separate bottom-nav
destinations. Per-tab content:
- *Timetable*: a horizontal day-chip strip (Mon–Sun, Sunday dimmed/disabled) + a
  period list for the selected day (badge, subject, time range, a distinct "Break" row).
- *Attendance*: a month selector, a hero card (this month's % + today's status +
  a Present/Absent/Late/Leave/Holiday legend with counts), a declared-holiday card,
  and a daily-record list of pill-per-day status.
- *Diary*: a reverse-chronological card feed (subject, date, note text, a due/test/
  submitted pill, and an attachment chip with a paperclip icon for the one entry with
  a file). Bottom nav on all three: **(Home/Calendar/Circulars/Messages/Fees/More — 6 items)**.

This maps to a screen that **already exists**: `parent-app/lib/src/screens/
calendar_tab.dart` (603 lines) — this is a redesign of a real, already-unified
Calendar tab, not new IA, which is a meaningfully lower-risk chunk than the dashboards
in Section 6. `home_tab.dart` (239 lines) and `home_shell.dart` (391 lines, likely the
bottom-nav shell) are the other two touched files.

Three things worth flagging rather than assuming:

- **This is Flutter/Dart, not Vue/CSS** — none of the `patterns.css`/component work
  above applies. It needs its own implementation pass in `parent-app/lib/`.
- **The bottom nav is inconsistent between the two mockup batches** — Home shows
  *Home/Attendance/Fees/Results/More* (5 items, no Calendar/Circulars/Messages);
  Calendar shows *Home/Calendar/Circulars/Messages/Fees/More* (6 items, no Results).
  These can't both be the real nav. The Calendar version matches `DESIGN.md`'s
  existing default option for Open Decision #3 ("keep 6 destinations: Home, Calendar,
  Circulars, Messages, Fees, More") — so my read is the Home mockup's nav is either
  stale or was drawn before the Calendar batch settled on the 6-item version, but
  that's a guess, not a fact. Needs a direct answer, not an assumption (11.9).
- **The father/mother accent-color idea is new** — it directly touches `DESIGN.md`
  Open Decisions #3/#4 (how much the Parent app should visually differentiate, and
  whether a warmer accent is enough). Two per-guardian accent colors is a bigger idea
  than what DESIGN.md currently scopes. See decision 11.7.

## 8. Rollout order (proposed chunks — each is its own prompt/session)

Reference-design coverage is now high for almost everything. Updated order, with
coverage noted so you can reorder on actual priority rather than "what has a mockup":

| Chunk | Views | Reference design? | Status |
|---|---|---|---|
| **0 — Foundation** | `patterns.css` extraction, `EntityTable` restyle, `ListPageCard` | N/A (infra) | ✅ DONE — committed & pushed |
| **1 — Timetable/Attendance/Messages** | `AttendanceView`, `TimetableView`, `TeacherTimetableView`, `MessagesView` | ✅ Yes (Section 5) | ✅ DONE — committed & pushed |
| **2 — Core management/list pages** | Student/Staff/Parent/Class/Section/Campus/School/Terms/AcademicSession Management | ✅ Yes (`listview` pattern, Section 4.4 — decision 11.8: A, restyle only) | ✅ DONE — committed & pushed |
| **3 — Dashboards** | New: `PrincipalOverviewView`, `PrincipalAcademicsStaffView`, `SuperAdminDashboardView`, `TeacherMyDayView`, `TeacherGradebookOverviewView`; retires the shared `AdminHomeView` split across roles | ✅ Yes — decision 11.6 resolved (build full role IA); backend endpoint audit is this chunk's first step | ✅ DONE — committed & pushed (`isPrincipal` reused as existing boolean flag, no migration needed) |
| **4 — Admissions & Hiring workflows** | `AdmissionsQueueView`, `ApplicantIntakeView`, `ApplicationDetailView`, `HiringQueueView`, `HiringCandidateIntakeView`, `HiringApplicationDetailView`, `BulkImportView`, `PromotionView` | ❌ None yet | ✅ DONE — committed & pushed |
| **5 — Academic records & operations** | `AssessmentCategoriesView`, `MarksEntryView`, `ReportCardsView`+`TeacherReportCardsView`, `DiaryView`, `CircularsView`, `ComplaintsQueueView`+`TeacherComplaintsView`, `HolidaysView`, `LeaveManagementView`, `FeeManagementView` | ❌ None yet | ✅ DONE — committed & pushed (commit `956c9b3`) |
| **6 — Flutter parent-app** | `home_tab.dart`, `home_shell.dart`, `calendar_tab.dart` | ✅ Yes (Section 7) — different stack, own effort, bottom-nav conflict to resolve first (11.9) | ✅ DONE — committed & pushed |

**Not chunked (auth screens):** `LoginView`, `ForgotPasswordView`, `ResetPasswordView`
— low-traffic, already simple; include only if you want them touched.

Decision 11.3: keep this order as-is.

## 9. Per-chunk process (unchanged, same as Student/Staff Profile)

1. Read the current view file(s) and their `.spec.ts` — know every existing
   `data-testid` and behavior before touching markup.
2. Read/render the reference design if one exists for that chunk.
3. If anything is genuinely ambiguous (not just "apply the established pattern"),
   ask before implementing — same bar as before.
4. Implement, preserving all API calls/validation/routes/testids.
5. Run type-check + full `vitest` suite + lint before reporting done.
6. Report what changed; commit/push only when you ask, same as this session.

## 10. Risks & mitigations

- **`EntityTable.vue` restyle touches 20+ screens at once.** Mitigated by: behavior/
  testid-only spec assertions (checked), running the *entire* suite after Chunk 0,
  doing this before any page-level changes so a regression is caught against a small diff.
- **`TimetableView.vue` is 1076 lines** — confirm structure before restyling (Section 5).
- **Card-collapse responsive behavior in `EntityTable`** is new behavior, not just
  CSS — needs its own test coverage, not just visual review.
- **Row-selection/bulk-actions (4.4) and richer dashboards (Section 6) both risk
  scope creep from "redesign" into "new features."** Both have explicit go/no-go
  decisions below (11.6, 11.8) specifically to avoid quietly doing more than asked.

## 11. Open decisions — edit this section directly

### 11.1 (resolved) Where does the extracted CSS live?
**Decision: A — new `patterns.css`.** Shipped in Chunk 0 as `src/assets/patterns.css`,
imported in `main.css` right after `base.css`.

### 11.2 (resolved) Is `ListPageCard` a new component, or does `ProfileSectionCard` grow a toolbar slot?
**Decision: A — new `ListPageCard.vue`.** Shipped in Chunk 0: icon+title header,
actions slot, optional toolbar slot, body slot. Not yet wired into any page — that's
Chunk 2, once the row-selection/bulk-action scope from 11.8 is settled (it's now A:
restyle only, so `ListPageCard` doesn't need a detail-rail slot for that first pass).

### 11.3 (resolved) Chunk order
**Decision: keep Section 8's order as-is — 0 → 1 → 2 → 3 → 4 → 5 → 6.** Dashboards
stay at Chunk 3 despite the Section 6 IA mismatch; the backend-endpoint audit called
out in 11.6 is that chunk's own first step, not a reason to reorder around it.

### 11.4 (resolved) Reference designs for Timetable/Attendance/Messages
Provided — see Section 5.

### 11.5 (resolved, superseded mid-rollout) Commit/push cadence
**Standing instruction as of Chunk 3 onward:** do NOT start dev/backend servers for
visual verification. After type-check + full test suite + lint all pass, commit and
push directly to `origin/main` (no PR, no waiting for per-chunk go-ahead) — the user
tests changes locally themselves.

### 11.6 (resolved) Dashboards: reskin-only vs. build the role-differentiated IA
**Decision: B — build it for real.** Wire `PRINCIPAL` into the frontend role list,
split `AdminHomeView` into role-specific dashboards (Principal ×2, School Admin,
SuperAdmin), build a "My Day" teacher landing page and a Gradebook overview in front
of `MarksEntryPageView`.

**Why (your reasoning, recorded so it survives to implementation):** a Principal
shouldn't have to go hunting for information — they need more depth than the current
generic admin dashboard gives. But the fix for that isn't one denser dashboard; a
single Principal view trying to hold school-overview KPIs *and* academics/staff detail
at once would overload them with too many items at once. That's specifically *why* the
mockups split Principal into two dashboards (School Overview / Academics & Staff)
rather than one bigger one — the split is the answer to the overload concern, not an
extra feature.

**What this means for scope:** this is no longer "restyle an existing page." It needs,
in order:
1. `PRINCIPAL` added to the frontend `StaffRole` type (`stores/auth.ts`) and to
   `STAFF_ROLES`/route `meta.requiresRole` guards (`router/index.ts`) — currently it
   only exists as a Prisma enum value with no frontend role support at all.
2. New routes + views: two Principal dashboards, a SuperAdmin-specific dashboard split
   out from the shared `AdminHomeView`, a Teacher "My Day" landing page (replacing
   `AttendanceView` as `/teacher`'s direct render), and a Gradebook *overview* page in
   front of the existing `/teacher/gradebook` (`MarksEntryPageView.vue`) marks-entry
   screen.
3. A backend audit for what each dashboard needs that doesn't exist yet — at minimum:
   network-wide school stats (SuperAdmin), staff-attendance aggregation + exam-schedule
   status + class-health/marks-trend sparklines (Principal · Academics & Staff),
   enrollment/attendance/fee sparkline trend data (Principal · School Overview). This
   is real backend-endpoint work, which is why Chunk 3 should get its own scoping pass
   (confirm exact endpoints/shapes needed) before implementation starts, not be sized
   as "a chunk" the same way Chunk 1's pure restyle was.

### 11.7 (resolved) Flutter parent-app accent color: per-guardian, or one accent?
**Decision: B (for now) — adopt per-guardian accent colors**, as shown in the mockups
(blue `#0369a1` for "Father", magenta `#B0336B` for "Mother"). Still open before Chunk
6 implementation: how "which guardian is logged in" is determined — per-account at
login, or a toggle within the app. This touches `DESIGN.md` Open Decisions #3/#4 —
flag there too when Chunk 6 starts.

### 11.8 (resolved) Row selection / bulk actions / detail rail (Section 4.4): how far to go now?
**Decision: A (for now) — restyle only.** `EntityTable`/`ListPageCard` get the visual
language and page chrome; selection state, the bulk-action bar, and the detail rail
are deferred. Revisit as **B** per-page later, once a specific page's bulk-action need
is concretely justified and its backend endpoint exists — not as a blanket redo.

### 11.9 (resolved) Parent app bottom navigation: which item count is real?
**Decision: A — 6 items** (Home/Calendar/Circulars/Messages/Fees/More), matching the
Calendar mockups and `DESIGN.md`'s existing default for its own Open Decision #3. The
5-item Home mockup nav (Attendance/Results as top-level, no Calendar/Circulars/
Messages) is stale — Chunk 6 builds against the 6-item nav only.

---

**Next step, once you're happy with this document:** tell me to proceed with Chunk 0,
or reorder/edit/resolve open decisions above first.

---

## 12. Progress Log (updated 2026-09-19)

**Chunks 0–6 are done and pushed to `origin/main`** (Chunks 0–5 verified with
`vue-tsc --build`, full `vitest`, lint; Chunk 6 with `flutter test` (98 pass), `flutter analyze`,
and the backend `me` jest suite + `tsc`). There is also a queued feature request from the user,
given mid-rollout during Chunk 3, that comes **after** Chunk 6.

### To resume in a new session, say:
> "Continue from the SchoolOS design system rollout spec, Section 12 (Progress Log) — start
> the queued management-view feature request."

### What's done
- **Chunk 0** — `patterns.css`, `EntityTable.vue` restyle, `ListPageCard.vue`.
- **Chunk 1** — Timetable/Attendance/Messages restyle.
- **Chunk 2** — 9 management views wired to `ListPageCard`.
- **Chunk 3** — Role-differentiated dashboards (Principal ×2, SuperAdmin, School Admin,
  Teacher My Day + Gradebook overview). `isPrincipal` already existed as a `User`
  boolean — no DB migration was needed, contrary to the original 11.6 scoping guess.
- **Chunk 4** — Admissions & Hiring workflows (8 views).
- **Chunk 5** — Academic records & operations (11 views, commit `956c9b3`).
  `FeeManagementView.vue`'s "anti-card" section-separator layout was deliberately kept
  (verified against the reference mockup's own CSS) rather than converted to per-section
  cards — don't "fix" that in a future pass without re-checking this reasoning.

### Standing behavioral instructions for the rest of this rollout (do not re-ask)
- **Never start a dev/backend server for visual verification.** Verify with
  type-check + full test suite + lint only, then commit and push straight to
  `origin/main` (`git push origin HEAD:main`) — the user tests locally themselves.
  See resolved 11.5.
- Work directly on `main` in the shared checkout (`D:\Zain\Projects\SchoolApp\build`),
  not in a worktree — established after Chunk 0.
- Use engineering judgment for ambiguous per-view styling calls (same
  `ListPageCard`/`StatusPill`/`.field-grid`/`EmptyState` conventions used in Chunks
  2–5); only stop to ask when something is genuinely unknowable without the user
  (e.g. a new DB schema's field list), not for restyle judgment calls.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

### Chunk 6 — Flutter parent-app (DONE)
**What shipped:** Home (header w/ campus badge + bell, child pills, three-question cards,
announcements, today's timetable) and Calendar (segmented sub-tabs; Timetable day-chips + period
list w/ auto Break rows; Attendance month nav + hero meter + legend + daily record; Diary cards
w/ due pills + attachment chips) redesigned; `cardTheme` (14px radius/1px border) applied app-wide.
**Guardian accent (11.7 resolved):** `/me/children` now returns `relationship`
(`StudentParent.relationship`, no migration); `"mother"` → magenta `#B0336B`, anything else → blue
`#0369A1`, applied per active child via `AccentController` → `buildAppTheme(accent:)`.
**Deviations from the mockups (deliberate):** no "Mr./Mrs." in the greeting and the school badge/name
uses the child's campus (no guardian-name or school-name field on the parent API); the Results
card stays a muted "Coming soon" (no per-test summary endpoint); the shell AppBar (dropdown, bell,
logout) now only shows on Circulars/Messages/Fees/More — Home and Calendar draw their own headers,
so logout is reached via More; dark-mode magenta `#F08AB4` is my pick (mockups are light-only).
`DESIGN.md` Open Decisions #3/#4 not edited (non-goal) — worth a follow-up addendum.

**Original plan notes (kept for reference):**
Different stack (Dart/Flutter, not Vue/CSS) — its own implementation pass under
`parent-app/lib/`. Files: `home_tab.dart`, `home_shell.dart` (239/391 lines), and
`calendar_tab.dart` (603 lines, already-unified Calendar tab being redesigned, not new
IA). Apply resolved decisions 11.7 (per-guardian accent colors: blue `#0369a1` father /
magenta `#B0336B` mother — how the active guardian is determined is still open, flag it
when this chunk starts) and 11.9 (6-item bottom nav: Home/Calendar/Circulars/Messages/
Fees/More — the 5-item Home-mockup nav is stale, ignore it). See Section 7 for full
mockup detail.

### Queued for after Chunk 6: management-view feature request
Given mid-Chunk-3, scoped and confirmed by the user, not yet started:
- **School & Campus**: new dedicated Profile pages matching the Student/Staff Profile
  pattern (currently they only have list + inline edit, no profile view). Add a "View"
  button to `SchoolManagementView`/`CampusManagementView` (currently Edit/Delete only).
- **Staff**: `StaffManagementView`'s list is missing Edit/Delete buttons entirely — add
  them (Student's list already has separate View vs Edit/Delete buttons — use that as
  the pattern reference).
- **Parent**: add a "View" button to `ParentManagementView`'s list, plus a Parent
  Profile page. Requires a scoped Prisma schema extension (user-confirmed, rejecting a
  larger AI-proposed Student-model restructure) on `ParentProfile`: `cnic`, `gender`,
  `dateOfBirth`, `alternatePhone`, `whatsappNumber`, `email`, `occupation`,
  `employerName`, `designation`, plus `current`/`permanent` `Address` relations (reusing
  the existing Address relation pattern already used by Student/Staff). On
  `StudentParent`: add `isPrimary` and `isEmergencyContact` booleans. This needs a
  migration, DTO updates, seed-data updates, and a new Parent Profile view — size it as
  its own chunk rather than folding it into Chunk 6.
