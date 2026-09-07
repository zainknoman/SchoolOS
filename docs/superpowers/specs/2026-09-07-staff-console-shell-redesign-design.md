# Staff console shell redesign — navigation, theming, per-screen states

Status: draft, approved in chat by product owner 2026-09-07.
Source: `ui-ux-pro-max`-produced mockup artifact (competitive-research-informed), reviewed and
approved live. Design system baseline: `staff-console/design-system/seeds-staff-console/MASTER.md`
(navy `#0F172A` / accent `#0369A1`, Plus Jakarta Sans) — extended, not replaced.

## Context

The staff console (Vue) is functionally complete across all Sprint 1–10 features plus Org
Structure/People CRUD, but its chrome and per-screen states have not had a polish pass since the
2026-08-28 wireframe refresh. A follow-up competitive-analysis pass (`grow/outputs/
ui-design-checklist.md`, 2026-09-06) flagged eight categories of gap against professional B2B SaaS
conventions — this spec addresses the four that apply to the shared shell and per-screen states
(navigation/IA, micro-interactions/feedback, empty/loading/error states, notifications/badges);
accessibility and the Flutter-side items are out of scope here (parent app gets its own spec next).

**Decision:** build the real interactive pieces (command palette, persisted theme toggle,
grouped nav, two-tier notifications), not a visual-only reskin — confirmed with product owner.
No new brand, font, or icon library; everything extends `base.css` and `AppIcon.vue`.

**Sequencing** (each phase ships and is verified independently, same pattern as the 2026-08-28
UI refresh's two parallel plans):

| Phase | Scope | Depends on |
|---|---|---|
| 1. Tokens | `base.css` dark-mode variants, semantic status colors, tabular-numeral utility | — |
| 2. Shell | `AppShell.vue` rebuild: grouped nav, breadcrumb, `CommandPalette.vue`, two-tier notifications, theme toggle | Phase 1 |
| 3. Per-screen | State machine + status-pill component, one task per view (14 views) | Phase 1 (pills use tokens); independent of Phase 2's internals, but shares the shell |

## 1. Design tokens (`staff-console/src/assets/base.css`)

Additive only — every existing token keeps its current light-mode value.

- Wrap current `:root` values as the light theme (unchanged). Add a dark variant two ways, matching
  this project's own `docs/wireframe`-era convention of anticipating both an explicit toggle and the
  OS default:
  - `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ... } }`
  - `:root[data-theme="dark"] { ... }` (explicit toggle wins over OS default in both directions)
- Dark values (candidates, verify 4.5:1 contrast before use, same discipline as the 2026-08-28 pass):
  `--color-primary:#F1F5F9; --color-background:#0B1220; --color-surface:#111A2C;
  --color-surface-2:#0E1727; --color-text:#DCE4EE; --color-muted:#8C9AB3; --color-muted-bg:#1C2A42;
  --color-border:#233150; --color-accent:#4FC0F0; --color-accent-hover:#7CD1F5;
  --color-destructive:#F87171; --color-present:#4ADE80; --color-late:#FBBF24;`
- New semantic tokens (both themes), separate from `--color-accent` per the checklist's "semantic
  color is not your accent" guidance — used for status pills, not for buttons/links:
  `--status-success` (= `--color-present`), `--status-warning` (= `--color-late`),
  `--status-critical` (= `--color-destructive`), `--status-info` (= `--color-accent`), plus a
  `-tint` background pair for each (`--status-success-tint`, etc.) for pill fills.
- New `--font-family-mono` (`'IBM Plex Mono', ui-monospace, ...`, loaded via the existing Google
  Fonts `<link>` in `index.html`) and a `.tabular` utility class (`font-variant-numeric:
  tabular-nums; font-family: var(--font-family-mono)`) for GR numbers, PKR amounts, and dates in
  tables — matches the mockup's data-table treatment.
- Fix the shell's scroll containment while touching this file's neighbors: `AppShell.vue`'s
  `.shell` currently uses `min-height: 100vh` with no `overflow` boundary on `html body`, which
  double-scrolls (confirmed as a real bug against the mockup during its own browser check) and
  breaks `position: sticky` on the topbar. Change to `height: 100vh` + `html,body{overflow:hidden}`
  so only `.content` (and `.sidenav`, already `overflow-y:auto`) scroll internally.

## 2. Shell (`AppShell.vue`)

- **Nav becomes grouped**, static (not collapsible — see Non-goals), gated by the *real*
  `auth.role`/`auth.isPrincipal` (no demo role switcher — that was mockup-only):
  - Teacher: ungrouped, unchanged (Attendance/Diary/Timetable/Messages).
  - Admin/Accounts/Principal: **Overview** (Dashboard) / **People** (`canManagePeople`: Students,
    Parents, Teachers) / **Org Structure** (`canManageOrgStructure`: Schools, Campuses, Academic
    Sessions, Classes, Sections) / **Operations** (Timetable; Fees for admin/accounts/principal;
    Leave for `canManageLeave`) / **Communication** (Circulars for admin/principal; Messages for
    all admin-side roles). Group labels only render when they contain at least one visible item
    (Vue `v-if` on the group wrapper, not per-item `display:none`) — keeps the "full section
    hiding, never disabled-but-visible" rule from the checklist.
- **Breadcrumb**: new `<nav class="crumbs">` in the topbar, driven by `route.meta.title` (add a
  `meta: { title: '...' }` to every existing route in `router/index.ts` — currently none carry
  one). Renders `<b>{{ route.meta.title }}</b>` only for now (single-level); the markup accepts a
  future array so a drill-down page can extend it later without a rewrite.
- **Command palette**: new `CommandPalette.vue`, opened by a topbar trigger button and `Ctrl/Cmd+K`
  (global `keydown` listener, matching the mockup). Two groups:
  - **Go to** — one entry per currently-visible nav item (reuses the same role-gated list the
    sidebar renders, so it can never link somewhere the user's role can't enter); `router.push`.
  - **Actions** — a short, hand-picked list (Add student, Issue vouchers, Approve leave, Publish
    circular), each role-gated the same way. Navigates to the screen **and** focuses the relevant
    control (a `ref` on the target input, focused via a small `focusTarget` query param the
    destination view reads on mount — same low-tech pattern as the existing
    `?conversationId=` deep-link into Messages) — not a fake-submit.
- **Notifications**: two-tier badge derived client-side from the existing `NotificationSummary.type`
  (no backend change): `type === 'message'` → numeric badge (needs a reply); `diary`/`circular` →
  dot only. The dropdown itself is visually restyled (icon chip per row, tinted by the same
  derived tier) but keeps its existing data flow (`api.listNotifications`,
  `markNotificationRead`, `markAllNotificationsRead`).
- **Theme toggle**: icon button, `data-theme` attribute on `<html>`, persisted to `localStorage`
  (wrapped in `try/catch`, consistent with this codebase's existing defensive-storage patterns
  e.g. `flutter_secure_storage` usage on the parent-app side). Defaults to unset (follows OS via
  the CSS media query) until the user picks explicitly.
- **Avatar**: unchanged data source (`roleInitials(auth.role)`), restyled per the mockup (initials
  chip, name + role line instead of just initials).

## 3. Per-screen pass (14 views)

Every admin/teacher view (`SchoolManagementView`, `CampusManagementView`,
`AcademicSessionManagementView`, `ClassManagementView`, `SectionManagementView`,
`StudentManagementView`, `ParentManagementView`, `TeacherManagementView`, `TimetableView`,
`CircularsView`, `FeeManagementView`, `LeaveManagementView`, `MessagesView`, `AdminHomeView`) gets:

- **An explicit state machine.** Today every `load()` only sets `errorMessage`; "loading" and
  "empty" are visually indistinguishable from each other and from a slow network. Add a single
  `status: 'loading' | 'error' | 'ready'` ref per view (`'loading'` until the first `load()`
  resolves or rejects), and derive "empty" in the template as `status === 'ready' && !list.length`
  rather than a fourth status value — keeps the state machine exclusive per the checklist
  (spinner and error can never render together) without over-modeling.
- **Skeleton rows** while `status === 'loading'` (a small shared `SkeletonRow.vue`, column-count
  prop, shimmer via CSS `background-position` animation, `prefers-reduced-motion` respected)
  instead of the current pattern of just rendering nothing / a bare "Loading…" string.
- **A shared `StatusPill.vue`** (`tone: 'success' | 'warning' | 'critical' | 'info' | 'neutral'`
  prop) replacing the ad hoc `.badge-pending/.badge-approved/.badge-rejected` classes in
  `LeaveManagementView` and the plain status text in `FeeManagementView`'s ledger table
  (`unpaid→neutral, partial→warning, paid→success, overdue→critical`) and `AcademicSessionManagementView`'s
  active/closed column. One component, reused everywhere a status shows, instead of per-view CSS.
- **Empty-state copy** distinguishes cause where the view already has the data to know it (e.g.
  Students: "no students in this section" vs. true zero-students-in-school), per the checklist;
  where a view has no filter concept (e.g. Schools, a single-row table), a generic "Nothing here
  yet — add your first X" is enough and does not need cause-differentiation logic that has nothing
  to differentiate.
- Table/form spacing and the `.tabular` class applied per the mockup (GR numbers, PKR amounts,
  dates).

`AdminHomeView` additionally gets the mockup's stat-card delta lines (e.g. "+2 pts vs. yesterday")
— **only** where `DashboardSummary` already carries the comparison data; it does not today for
week-over-week deltas beyond the existing 7-day trend, so this is flagged as an **open question for
the implementation plan**: either add the small amount of backend aggregation, or ship the cards
without deltas for values the API doesn't support yet (recommend the latter — no backend change in
this pass, matches "no unnecessary features").

## Non-goals

- No collapsible sidebar groups — added complexity (expand state, persistence, animation) for a
  ~14-item nav; static grouping alone satisfies the checklist's IA gap.
- No backend changes — two-tier notifications, dashboard deltas, and everything else in this pass
  derive from data the API already returns.
- No parent-app (Flutter) changes — separate spec, next.
- No multi-level breadcrumbs yet — no drill-down detail pages exist in the app today; the markup
  is built to extend, not to be populated, until one does.
- No new charting/icon library — `TrendsSparkline.vue` and `AppIcon.vue` are extended in place.
- No accessibility-specific pass beyond what naturally falls out of this work (focus rings,
  `aria-live` on the command palette and toasts) — a dedicated a11y pass is tracked separately per
  the 2026-08-28 refresh's own follow-up note.

## Testing expectations

Matches this project's established rigor: component tests per touched view (state-machine
transitions, `StatusPill` tone mapping, `SkeletonRow` rendering), a `CommandPalette.spec.ts`
covering role-gated results and the focus-target deep link, an `AppShell.spec.ts` extension
covering grouped-nav visibility per role and the two-tier badge derivation, and a manual browser
smoke pass across at least one screen per phase before merge (the 2026-08-28 and Sprint 5-6/9-10
passes each caught a real defect — an `AppShell`-wrapper omission, a `var()`-in-SVG bug — only via
manual smoke test, not automated tests). `npm run build` (type-check) and `npm run lint` clean, as
every prior pass.
