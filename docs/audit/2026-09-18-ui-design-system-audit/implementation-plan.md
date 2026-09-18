# UI Migration Plan

Grouped per the requested structure (A–H). **Not yet executed** — this is the plan the user asked
for before implementation starts, per DESIGN.md Section 15/16 and the explicit "do not start
implementation until this audit is complete" instruction.

## Decision required before any implementation

Section F1/F2 in `findings.md` cannot be resolved by an implementation plan — they're a product
decision. Three real options, not a recommendation:

1. **Reconcile DESIGN.md down**: keep the single SchoolOS brand (navy/blue, one token set, one visual
   register across Teacher/Admin), treat DESIGN.md's IBM/Linear references as *inspiration for
   refinement* (tighter density rules, better elevation discipline, Carbon-style flat corners on
   dense admin tables) rather than a literal second palette, and give Parent app its own warm
   accent (extending, not replacing, per the already-written 2026-09-17 spec) instead of a full
   Intercom cream-canvas reskin. Lowest risk, smallest diff, no dark-mode redesign needed.
2. **Formally supersede SchoolOS with the three-surface system**: accept that this is a full reset —
   `MASTER.md` gets retired/rewritten, every one of the ~90 test-backed components and views gets
   re-themed, and a full dark-mode variant gets designed for all three surfaces (Management,
   Academic, Parent) where DESIGN.md currently only specifies light. Highest cost, matches
   DESIGN.md literally.
3. **Scope the three-surface split narrowly**: apply IBM/Linear/Intercom treatments only to
   *new* screens or a small pilot area (e.g. one Management list page + one Academic page), leave
   the rest of SchoolOS as-is, and revisit after seeing it in practice. Lowest risk, but produces a
   visibly inconsistent app in the interim and doesn't satisfy DESIGN.md Section 16's "complete,
   product-wide" requirement.

Everything below assumes **option 2** (DESIGN.md as literally written) purely so the route-by-route
order has content — swap in option 1's scope (a single-surface refinement) or option 3's pilot list
if the user picks differently. Re-confirm with the user before starting Phase 0.

---

## A. Global design system

- Resolve the decision above first; this determines whether `base.css` gets a `[data-surface]`
  split or stays single-token.
- If proceeding with the three-surface system: add `[data-surface="management"]` /
  `[data-surface="academic"]` blocks to `base.css` per DESIGN.md Sections 5/6, driven by
  `auth.role` (new: a computed `data-surface` attribute set on `AppShell.vue`'s root or on
  `<html>`, mirroring how `data-theme` already works for dark mode).
  - **Every new token needs a dark-mode pair.** DESIGN.md doesn't specify these — they must be
    derived and reviewed before merging, not left as a follow-up (see `findings.md`, "what's
    already good").
- Decide Lucide vs. keep `AppIcon.vue`'s hand-rolled set (F7) — this is a dependency decision
  (`lucide-vue-next` for web; a Flutter Lucide package or continued Material `Icons.*` for parent)
  and should be made once, not per-screen.
- Fix F8 (undefined `--color-warning`/`--color-surface-muted` references) as part of this phase
  regardless of which option is chosen — it's a pre-existing bug, not new scope.
- Add a `--radius` constant equivalent on the Flutter side (F9) if Parent radius changes.

## B. Staff application shell

- `AppShell.vue`: add surface-branching (role → `data-surface`), re-skin topbar/sidenav per
  Management vs Academic token sets, keep every existing behavior intact — command palette, theme
  toggle, locale switcher, notifications dropdown, mobile off-canvas sidebar, skip-link,
  breadcrumb. This file has the highest blast radius (every routed screen renders inside it) and
  the most existing interactive behavior to preserve — treat as its own task with its own full test
  run (`AppShell.spec.ts`) before touching any individual view.
- `CommandPalette.vue`: re-skin to match, no logic change (it mirrors `AppShell.vue`'s role gates —
  verify both stay in sync after the nav visual change).
- Add responsive strategy to `EntityTable.vue` (F5) here, once, rather than per-screen — this is
  the single highest-leverage item in the whole plan since ~20+ screens inherit it automatically.

## C. Management console (SUPER_ADMIN / SCHOOL_ADMIN / PRINCIPAL / ACCOUNTS)

Screens: `AdminHomeView` (dashboard), `SchoolManagementView`, `CampusManagementView`,
`AcademicSessionManagementView`, `ClassManagementView`, `SectionManagementView`,
`ParentManagementView`, `StudentManagementView` + `StudentProfileView`, `StaffManagementView` +
`StaffProfileView`, `HiringQueueView` + `HiringCandidateIntakeView` +
`HiringApplicationDetailView`, `FeeManagementView`, `CircularsView`, `TimetableView`,
`MessagesView`, `LeaveManagementView`, `PromotionView`, `HolidaysView`, `ComplaintsQueueView`,
`ReportCardsView`, `TermsManagementView`, `AssessmentCategoriesView`, `AdmissionsQueueView` +
`ApplicantIntakeView` + `ApplicationDetailView`, `BulkImportView`.

Apply `[data-surface="management"]` treatment (flat 0–4px radius, hairline borders, IBM Plex
Sans/Inter). Re-skin, don't restructure — every one of these is `EntityTable`/`FormField`/
`AppModal`/`StatusPill`-based already; the component re-skin in Phase A/B cascades here for free.
Screen-specific work is limited to layout details these components don't own (dashboard stat-card
grid, profile-header blocks — see the pending 2026-09-17 plan, which should be folded into this
phase rather than done twice).

## D. Academic console (TEACHER, and STUDENT if/when that role has screens)

Screens: `TeacherHomeView` (attendance), `DiaryView`, `TeacherTimetableView`, `MessagesView`
(shared component, teacher route), `TeacherComplaintsView`, `TeacherReportCardsView`,
`MarksEntryView` (gradebook).

Apply `[data-surface="academic"]` treatment (Linear-inspired, 8–12px radius, lavender accent).
Note: `MessagesView.vue` is shared between Teacher and Admin routes (`/teacher/messages` and
`/admin/messages` both resolve to `MessagesPageView.vue` → `MessagesView.vue` per
`router/index.ts`) — this component must render correctly under **both** `data-surface` values,
which is a real testing requirement, not just a re-skin detail.

## E. Parent Flutter app

- Resolve F3/F4 first (visual identity + nav destination count are both open decisions).
- Fold in the already-written, not-yet-executed 2026-09-17 plan
  (`docs/superpowers/plans/2026-09-17-ui-revamp.md`) rather than re-deriving a profile-header /
  tinted-icon-chip design from scratch — it's compatible with (and a subset of) what a full
  Intercom-style reskin would also need.
- Re-theme `app_theme.dart`: cream canvas, charcoal text, blue primary (not orange), per DESIGN.md
  Section 7, if option 2 is chosen. Every screen in `screens/` reads from this theme, so this is
  the leverage point — same principle as `EntityTable.vue` on the web side.
- Resolve the bottom-nav destination count (F4) as a product decision, then update
  `home_shell.dart` and `app_router.dart` together.

## F. Shared components (cross-cutting, do once)

Order matters — do these before F5's per-screen items so the surface-aware versions exist before
they're consumed:

1. `AppIcon.vue` / icon system decision (F7)
2. `EntityTable.vue` responsive strategy (F5) + surface-aware styling
3. `Button.vue`, `FormField.vue`, `AppModal.vue`, `ConfirmDialog.vue`, `StatusPill.vue`,
   `EmptyState.vue`, `ErrorRetry.vue`, `AppSkeleton.vue`, `AppTabs.vue`, `ToastHost.vue`,
   `TrendsSparkline.vue` — each needs to render correctly under both `data-surface` values if
   option 2 is chosen (a shared component can't hardcode one surface's radius/color).
4. `DirectionalText.vue` stays as-is (F6 is a document-level CSS gap, not a component gap).

## G. Responsive / RTL / accessibility

- F5: `EntityTable.vue` responsive reflow (card-per-row below some breakpoint, or horizontal-scroll
  with a sticky first column — pick one pattern, apply everywhere via the shared component).
- F6: CSS logical-properties pass (`padding-inline-start` etc.) across `AppShell.vue`,
  `EntityTable.vue`, and any other file using physical left/right properties — this is the
  "explicit RTL handling" DESIGN.md Section 12 asks for, distinct from the per-string direction
  detection that already works well.
- F12: confirm Urdu font choice (Nastaliq vs. Noto Sans Arabic) with the user rather than silently
  changing it to match DESIGN.md.
- Re-run the existing accessibility checklist in `MASTER.md` (contrast, focus rings, label
  association, keyboard nav, `prefers-reduced-motion`) against any new/changed token values — a
  surface re-skin can silently break a contrast ratio that was previously verified.
- Test matrix per DESIGN.md Section 17: 1440 / 1024 / 768 / 390px, for every screen touched.

## H. Route-by-route migration order

Ordered by blast radius (shared infrastructure first) and role frequency (matches `AppShell.vue`'s
own nav-ordering rationale — Overview → People → Operations → Communication → Org Structure):

1. **Shared components** (Section F above) — must land before any screen re-skin, since every
   screen consumes them.
2. **`AppShell.vue` + `CommandPalette.vue`** (Section B) — every route renders inside these.
3. **Auth screens**: `LoginView`, `ForgotPasswordView`, `ResetPasswordView` — small, high-visibility,
   no role-gating complexity, good smoke test for the new tokens before touching gated routes.
4. **Management — Overview**: `/admin` (`AdminHomeView`) — dashboard, most-visited Management
   screen.
5. **Management — People**: `/admin/students`, `/admin/students/:id`, `/admin/staff`,
   `/admin/staff/:id`, `/admin/parents`.
6. **Management — Operations (high-frequency first, matching existing nav comment ordering)**:
   `/admin/admissions*`, `/admin/hiring*`, `/admin/bulk-import`, `/admin/fees`, `/admin/leave`,
   `/admin/timetable`, `/admin/report-cards`, `/admin/promotions`, `/admin/holidays`,
   `/admin/terms`, `/admin/assessment-categories`.
7. **Management — Communication**: `/admin/messages`, `/admin/circulars`, `/admin/complaints`.
8. **Management — Org Structure** (least-frequently visited per existing nav comment):
   `/admin/schools`, `/admin/campuses`, `/admin/academic-sessions`, `/admin/classes`,
   `/admin/sections`.
9. **Academic console**: `/teacher` (home/attendance), `/teacher/diary`, `/teacher/timetable`,
   `/teacher/gradebook`, `/teacher/report-cards`, `/teacher/complaints`, `/teacher/messages`
   (shared component — verify both surfaces per Section D note).
10. **Parent Flutter app**: theme file first, then Home tab (highest-traffic), then Calendar/Fees,
    then Messages/Circulars/More, matching the already-written 2026-09-17 plan's own phasing.

Each step should run its existing test suite (`npm run type-check && npm test` for staff-console;
`flutter analyze && flutter test` for parent-app) before moving to the next, per this repo's own
established verification standard (`PROJECT-STATUS.md`).
