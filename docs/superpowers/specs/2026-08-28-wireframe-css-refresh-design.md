# Wireframe-driven UI refresh — staff-console + parent-app

Status: draft, pending user review.
Source wireframes: `docs/wireframe/wireframe_{OwnerDashboard,FeeReconciliation,TeacherMarkAttendance,ParentHome}/code.html`
(repo root `docs/wireframe/`, outside this git checkout — reference only, not shipped).

## Context

Four AI-generated wireframes exist for screens that are currently either placeholder stubs or
functionally bare in the real app. The four wireframes are **not** a unified design system —
each was generated independently and disagrees with the others on color palette, font, and icon
set (OwnerDashboard: green brand + Inter; FeeReconciliation: default Tailwind blue/gray +
FontAwesome; TeacherMarkAttendance: default Tailwind indigo/gray; ParentHome: system font stack).
None of them match the project's actual design system
(`build/staff-console/design-system/schoolos-staff-console/MASTER.md`: navy `#0F172A` / blue accent
`#0369A1`, Plus Jakarta Sans, outline SVG icons — already implemented in both clients' token
files, `staff-console/src/assets/base.css` and `parent-app/lib/src/theme/app_theme.dart`).

**Decision:** wireframes are used for layout, component structure, and UX flow only. All four
screens are restyled using the existing token system — no new brand, no new font, no new icon
library. This keeps the app visually consistent (one brand across both clients, per
`PROJECT-STATUS.md` Sprint 2).

**Sequencing:** three of the four wireframes map to screens that already exist as functional
stubs and can be restyled today against real data:

| Wireframe | Maps to | Backend |
|---|---|---|
| OwnerDashboard | `staff-console/src/views/AdminHomeView.vue` | Existing endpoints (students, attendance, fees summary — see Open Questions) |
| TeacherMarkAttendance | `staff-console/src/views/AttendanceView.vue` | Existing (FEAT-007) |
| ParentHome + Timetable/Attendance/Diary sub-tabs | `parent-app/lib/src/screens/home_shell.dart`, `calendar_tab.dart` | Existing (FEAT-006/007/008) |
| FeeReconciliation | New `staff-console/src/views/FeesView.vue` | **Does not exist yet** (FEAT-012, Sprint 9-10) |

FeeReconciliation is included as a live view per explicit request, built against a local mock
dataset (see §6) rather than deferred. It must be structured so wiring it to the real FEAT-012
API later is a data-layer swap, not a rewrite — same pattern `AttendanceView.vue` already uses
(`api.listSections(...)` calls isolated from the template).

## 1. Design tokens (additions only)

Both `staff-console/src/assets/base.css` and `parent-app/lib/src/theme/app_theme.dart` get the
same two additions, keeping the two clients in sync as they already are:

- `--color-present` / `AppColors.present` — green, for the Present state in attendance UI and the
  Auto-Matched fee state. Exact value picked at implementation time from a green that passes
  4.5:1 on `--color-surface` (candidate: `#16A34A`, matches Tailwind `green-600`, verify before
  use).
- `--color-late` / `AppColors.late` — amber, for the Late attendance state. Candidate `#D97706`
  (Tailwind `amber-600`), verify contrast before use.

`--color-destructive` (`#DC2626`) already covers Absent/Exception — no new red needed.

Two new icons in `staff-console/src/components/AppIcon.vue` (same Phosphor-regular outline
style, 20px, `currentColor` stroke, as every existing icon in that file):
- `bell` — topbar notifications.
- `warning` — the at-risk-students stat card (triangle-exclamation glyph).

No new icons needed on the Flutter side — Material's built-in outlined icon set already covers
everything (`home_outlined`, `notifications_none`, etc., as `home_shell.dart` already uses).

## 2. staff-console — AppShell chrome

`AppShell.vue`'s current topbar is a brand label + logout button; the sidenav has no "Dashboard"
entry and no active-route styling. Additive changes, no restructuring of the shell's flex layout:

- Sidebar gets a small logo mark (reuse the layered-diamond glyph style from the wireframes,
  redrawn as one more `AppIcon` entry or inline SVG) next to the "SchoolOS Staff Console" brand text,
  and — for Admin/Accounts roles — a "Dashboard" `RouterLink` as the first nav item (currently
  missing entirely; admin nav starts at Students).
- Topbar gains: a notification bell button (`Icon name="bell"`, with a small unread-dot badge —
  static/hidden until Sprint 7-8's Notifications feature lands, but built into the markup now) and
  an avatar-initials circle (derived from the logged-in user's name via `auth` store) to the left
  of the existing logout button.
- Active nav item: apply `router-link-active` (Vue Router's built-in class) styling using
  `--color-muted-bg` background, matching the existing `:hover`/`:focus-visible` treatment in
  `.sidenav a` — currently no active-state rule exists at all.
- School name / campus selector shown in the wireframes is **not** added — this is a single-school,
  single-campus MVP per `PROJECT-STATUS.md` ("this project is a single-school platform"); building
  a campus switcher UI with nothing behind it would be scope creep. Skip.

## 3. staff-console — Dashboard (`AdminHomeView.vue`)

Replace the placeholder `<h1>`/`<p>` with:

- **Primary stat grid** (4-up, collapsing to 2-up/1-up responsively): Students (total headcount),
  Present (today's %), Fees Collected (month-to-date), Outstanding (total). Each a card:
  `--color-surface` background, `--color-border` border, `--radius`, label in
  `--font-size-xs`/uppercase/`--color-muted`, value in `--font-size-2xl`/700 weight.
- **Secondary stat row** (3-up): At-risk students, Absent today, Teachers absent — icon chip
  (colored background circle/square, `warning`/`users`/`user-circle` icons) + label + count,
  single-row card, matching the wireframe's compact horizontal layout.
- **Trends panel**: a hand-rolled inline SVG `<polyline>` sparkline (two series — attendance %,
  fees collected — exactly as the wireframe constructs it with raw SVG, no charting library
  dependency added), Mon–Sun x-axis labels, a 2-line legend. This is the one genuinely new piece
  of visual complexity; keep it a single focused component (`TrendsSparkline.vue`) so it's
  testable in isolation.
- **Recent Alerts panel**: simple list, divider rules between rows, "View all alerts" link — no
  new component needed, plain markup in the view.

Data source: needs a dashboard summary read. Existing endpoints
(`GET /students/:id/attendance`, sections/students listing) don't provide school-wide aggregates.
**Open question for the implementation plan**, not this design doc: whether a small new
`GET /dashboard/summary` endpoint is added, or whether the view composes several existing calls
client-side. Flag this explicitly when handing off to `writing-plans`.

## 4. staff-console — Attendance roster (`AttendanceView.vue`)

Currently: a plain `<table>` with a native `<select>` per student row. Replace with a card list,
applied at all breakpoints (not just mobile — it's a strict upgrade over the current dropdown):

- Numbered row, initials-avatar circle (`--color-muted-bg` background, 2-letter initials derived
  from the student's name — the data model has no photo field, so the wireframe's stock photos
  are not reproduced), student name.
- 3-way segmented control (P/A/L) per row: bordered pill group, selected segment filled
  (`--color-present`/`--color-destructive`/`--color-late` per state), matching the wireframe's
  interaction exactly.
- The real `AttendanceStatus` enum has 5 values (`PRESENT/ABSENT/LATE/LEAVE/HOLIDAY`); the
  wireframe only shows 3. P/A/L stays the primary segmented control for the common case; a small
  per-row overflow affordance (icon button opening a 2-item menu: Leave / Holiday) covers the
  remaining two — avoids bloating every row into a 5-way control for a rare case.
  **Open question for the implementation plan**: exact overflow control (dropdown vs. popover) —
  not a visual-design decision, defer to implementation.
- "Default all present" quick action stays at the top (already conceptually present via bulk-set,
  just not built — the current view requires setting each dropdown individually).
- Sticky footer bar: Present/Absent/Total counts + "Submit Attendance (N/M)" button, replacing the
  current plain "Save attendance" button. Reuses the existing `onSave` submit flow.

## 5. parent-app — Home tab (`home_shell.dart`, tab index 0)

Currently a placeholder `Text` widget. Build:

- Greeting header ("Assalam-o-Alaikum, {parent name}") + notification bell icon button (visual
  only until Sprint 7-8, same as the staff-console bell).
- Active-child summary card — name, class/section, tappable to open the existing child-switcher
  dropdown (already implemented in the `AppBar`; the Home-tab card becomes a second, more visible
  entry point to the same picker, not a duplicate implementation).
- 2×2 card grid: Attendance % (this month, from the existing `/students/:id/attendance` call),
  Fees outstanding (static "—" placeholder until FEAT-012 exists — do not fabricate a number),
  Results (static "View latest results" label, Release-2 feature per `PROJECT-STATUS.md`
  Deferred section — placeholder only, non-interactive), Timetable (deep-links to the Calendar
  tab's Timetable sub-tab).
- Recent Announcements list: reuse the circulars data `home_shell.dart` already fetches for the
  unread badge (`_loadUnreadCirculars`) — show the most recent 1-2 entries as cards, "See All"
  link switching to the Notifications tab.

## 6. parent-app — Calendar tab restyle (`calendar_tab.dart`)

- **`_TimetableTab`**: currently one flat `ListView.separated` of every `TimetableEntry` in
  arrival order. Rework to group entries by `dayOfWeek` into 7 rows (Sun–Sat, using the existing
  `_dayNames` list), each row a `Card` containing that day's periods as a horizontal (wrapping)
  row of compact chips — period number, subject, time range. A day with no entries shows an empty
  state within its card ("No periods") rather than being omitted, so the weekly structure stays
  visually consistent.
- **`_AttendanceTab`**: the existing top summary `Card` is unchanged. The daily `ListTile` rows
  become `Card`-wrapped entries (date + status), same data, just card-shelled instead of bare
  list tiles — consistent with the Timetable and Diary tabs after this change.
- **`_DiaryTab`**: entries move from `Padding`/`Column` rows into `Card`-wrapped entries. Content
  unchanged (subject, date/due-date via `DirectionalText` for Urdu RTL support, entry text,
  attachment chips) — only the container changes from a divided list to individual cards.

## 7. staff-console — Fee Reconciliation (`FeesView.vue`, new)

New view, routed from the existing "Fees" nav item in `AppShell.vue` (currently a non-routed
`<a href="#">` placeholder for the admin role). Built against a **local mock dataset** matching
the wireframe's exact sample rows (timestamps, rails, transaction IDs, amounts, exception
reasons) — no backend call, since FEAT-012 doesn't exist. The mock data lives in one function
(`getMockReconciliationQueue()`), isolated the same way `AttendanceView.vue` isolates its `api.*`
calls, so swapping in a real `GET /fees/reconciliation` endpoint later is a one-function change,
not a template rewrite.

Layout:
- Filter/search bar: transaction ID search input, rail filter select, date picker, status filter
  select, Export button (visual only — no real export wired against mock data).
- 3-up stat row: Total Transactions (today), Auto-Matched (green-tinted card), Exceptions
  (red-tinted card) — same card treatment as the Dashboard's secondary stat row, reusing
  `--color-present`/`--color-destructive` as background tints at low opacity.
- Table: Timestamp / Rail / Transaction ID / Amount / Status (pill badge, green=Auto-Matched,
  red=Exception) / Exception Reason / Action (Resolve link, or "View" for matched rows). Selected
  row highlighted with `--color-muted-bg`.
- Resolve side panel (opens on row click, exception rows only): transaction details block (read-
  only key/value pairs including the flagged issue), a manual-resolution search input (student
  name or challan number, filtered against the same mock dataset), and a suggested-match card.
  Confirming a resolution updates the row's status in local component state only (no persistence
  — there's nothing to persist to yet).

This view is explicitly UI/UX scaffolding ahead of FEAT-012, not a finished feature — the
implementation plan should note it as "mock-data view, needs a backend-wiring follow-up pass" the
same way other sprints have flagged forward-looking gaps in `PROJECT-STATUS.md`.

## Non-goals

- No new charting library, icon library, or font — everything above builds on what's already in
  both clients.
- No campus/multi-school UI (see §2) — out of scope for a single-school MVP.
- No FEAT-012 backend work — this is UI-only for Fee Reconciliation; a real reconciliation engine
  (bank-rail ingestion, auto-matching logic) is separate, larger, and not part of a CSS/UI plan.
- No offline caching, no push notifications wiring — those are Sprint 7-8/11-12 concerns per
  `PROJECT-STATUS.md`, unrelated to this visual-refresh pass.

## Testing expectations

Consistent with the project's existing rigor (`PROJECT-STATUS.md` notes test counts for every
prior sprint): each reworked/new view gets component-level tests matching the existing pattern
(`AttendanceView.spec.ts`, `DiaryView.spec.ts`, parent-app's `test/` suite) — rendering, the
present/absent/total footer math, the mock reconciliation queue's filter/resolve interactions,
and the Timetable tab's day-grouping logic. Exact test list belongs in the implementation plan,
not here.
