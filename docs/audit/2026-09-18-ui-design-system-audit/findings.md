# Findings

Ranked by severity. "Severity" here means impact on the migration decision/effort, not visual
polish.

## Critical

### F1 — DESIGN.md's three-surface system conflicts with the shipping SchoolOS system
See `README.md` for the full writeup. Summary: DESIGN.md assumes a blank slate; a documented,
tested, actively-maintained single-brand system already exists on both clients, including a
complete dark mode DESIGN.md never accounts for. **Blocks starting Section 16 (Complete Revamp)
until resolved** — see `implementation-plan.md`'s "Decision required" section.

### F2 — "Three UX surfaces" is architecturally two apps, one of which is a single shell for two roles
DESIGN.md Section 1 describes Management/Academic/Parent as three surfaces implying three visual
treatments. In the actual codebase, Teacher (Academic) and Admin/Accounts/Super Admin/Principal
(Management) are **one Vue SPA, one `AppShell.vue`, one token set**, differentiated only by which
nav links render (`build/staff-console/src/App.vue`, `AppShell.vue`). Applying two different visual
languages (flat IBM blue vs. rounded Linear lavender) to one shell component means `AppShell.vue`
itself needs to branch its rendering by role (e.g. a `data-surface` attribute driven by
`auth.role`), which is a structural change to the shell, not just a token swap — every child screen
inherits it for free, but the shell work itself is nontrivial and untested today.

## High

### F3 — Parent-app has no distinct visual identity from the staff console
`parent-app/lib/src/theme/app_theme.dart`'s `AppColors` are byte-for-byte the same hex values as
`staff-console/src/assets/base.css`, by explicit design ("one brand across both clients"). DESIGN.md
Section 7 wants a cream-canvas, Intercom-inspired, warm register for Parent specifically. This is a
full re-theme of the Flutter app, not an adjustment — every screen, not just Home, currently reads
from the shared navy/blue palette.

### F4 — Bottom nav destination count exceeds DESIGN.md's own limit
`parent-app/lib/src/screens/home_shell.dart` ships 6 `NavigationDestination`s (Home, Calendar,
Circulars, Messages, Fees, More); DESIGN.md Section 7 specifies "max 4–5 destinations (Home, Diary,
Attendance, Fees, More)." Calendar today bundles Timetable/Attendance/Diary as sub-tabs, which is a
reasonable resolution already in place — but Circulars is a 6th top-level destination DESIGN.md's
proposed nav doesn't have room for. This is an information-architecture decision (fold Circulars
into Home or More?), not a pure re-skin, and needs a product call before implementation.

### F5 — No responsive handling on table-heavy CRUD screens
Only `AppShell.vue` and `AdminHomeView.vue` contain `@media` queries (grep-confirmed across all of
`views/` and `components/`). Every CRUD screen built on `EntityTable.vue` renders a plain
`<table>` with no reflow strategy below the point it starts overflowing — DESIGN.md Section 17's
"Test at 1440 / 1024 / 768 / 390px" instruction and Section 16's "responsive layouts" requirement
will fail on essentially every People/Operations/Communication list screen (Students, Staff,
Parents, Fees, Admissions, Hiring, Circulars, Complaints, etc. — all built on `EntityTable`) unless
`EntityTable.vue` itself gets a responsive treatment (the highest-leverage single fix, since ~20+
screens share this one component).

### F6 — RTL is a coarse document-level flip, not a full logical-properties implementation
`lib/i18n.ts`'s own code comment: "a full CSS logical-properties refactor is a documented
follow-up." Confirmed by spot-check: `AppShell.vue`, `EntityTable.vue`, and others use physical
properties (`padding-left`, `text-align: left`-style defaults via `justify-content: flex-end`,
etc.) rather than logical ones (`padding-inline-start`, etc.). DESIGN.md Section 12 explicitly
requires "explicit RTL handling" for "navigation, tables, breadcrumbs, numbers, and dates... not
mirrored blindly" — the current implementation is close to the "mirrored blindly" state it warns
against, at the CSS layer specifically (per-string content direction via `DirectionalText.vue` is
handled well; document/layout-level direction is the gap).

## Medium

### F7 — Icon system is not Lucide
DESIGN.md Section 8 mandates "Lucide, line-based, one family everywhere." The actual icon system
(`AppIcon.vue`) is a hand-rolled, closed-union (~17 names) inline-SVG set styled after "Phosphor
'regular' weight" per `MASTER.md`. It is already line-based and already one consistent family — the
gap is purely "which named library," not visual quality. Migrating to Lucide means either (a)
adding `lucide-vue-next` as a new dependency and replacing every `<Icon name="...">` call site and
the type union, or (b) updating DESIGN.md to accept the existing hand-rolled set (already
line-based, single-family, no emoji — satisfies the *spirit* of Section 8 if not the letter). This
is a real decision, not just an implementation task.

### F8 — Undefined CSS custom-property references silently fall back to literal hex
`views/AssessmentCategoriesView.vue`, `views/MessagesView.vue` reference `var(--color-warning, ...)`
and `var(--color-surface-muted, ...)` — neither token exists in `base.css` (only
`--color-status-warning` exists; there is no `--color-surface-muted` at all). These currently
render via their hardcoded fallback value in every theme, meaning they **silently do not respond to
dark mode** the way every other status-colored element does. This is the one real "hard-coded
color" bug found in the codebase (as opposed to the many `var(--token, #hex)` patterns elsewhere,
which are legitimate defensive fallbacks referencing tokens that *do* exist).

### F9 — Parent-app card/input radius is a literal, not a shared constant
`parent-app/lib/src/theme/app_theme.dart` hardcodes `BorderRadius.circular(8)` in three separate
places (`inputDecorationTheme`, `elevatedButtonTheme` light and dark). It happens to match the
web's `--radius: 8px` today, but there is no single source of truth on the Flutter side the way
`base.css` is for web — a future radius change requires editing 3+ call sites correctly by hand.
Minor given DESIGN.md's own relaxed stance on small structural primitives, but worth a `static
const radius = 8.0` constant if the Parent surface's radius changes as part of a Section 7
migration (12–16px target).

## Low

### F10 — `FormField.vue` uses literal spacing instead of space tokens
`padding: 0.5rem 0.6rem;` and `gap: 0.2rem;` in `FormField.vue`'s `.form-field input/select/textarea`
and `.checkbox-row` rules don't map cleanly onto the existing `--space-*` scale (`--space-1` is
0.5rem, so the horizontal padding could token to `--space-1`, but 0.6rem and 0.2rem don't have a
matching token today). Low severity as one-off structural values under the relaxed Section 4 rule,
but worth normalizing to `--space-1`/a new micro-token if `FormField.vue` gets touched anyway during
the revamp.

### F11 — Dead/unused CSS class
`AdminHomeView.vue`'s `.secondary-icon.warning` style rule has no corresponding `warning` class
applied anywhere in the template (`secondary-icon` is used undecorated). Harmless, but dead code a
migration pass should either use or remove rather than carry forward unexamined.

### F12 — Urdu font choice differs between DESIGN.md and shipped code
DESIGN.md's `--sp-font-ur` is Noto Sans Arabic; the shipped `--font-family-urdu` is Noto Nastaliq
Urdu. These are genuinely different type styles (Nastaliq is the traditional calligraphic Urdu
style; Noto Sans Arabic is a plain sans-serif Arabic-script face) — not a naming inconsistency to
silently "fix" by picking one. Flagging as a decision point: Nastaliq is generally considered more
appropriate/legible for long-form Urdu prose (diary entries, messages) than a sans-serif Arabic
face, so the existing choice may be the better one — worth a product call, not an automatic
DESIGN.md-wins resolution.

## What's already good (do not regress these while migrating)

- No generic AI dashboard patterns anywhere sampled: `AdminHomeView.vue`'s stat cards are flat,
  bordered, single-color — no gradients, no rainbow charts, no decorative illustrations. Already
  compliant with DESIGN.md Section 17, item 9.
- `LoginView.vue` is a plain centered card, no marketing hero. Already compliant.
- `window.confirm()` is fully eliminated and guarded by a standing regression test
  (`noWindowConfirm.spec.ts`) — any revamp must not reintroduce it.
- Every reusable component in `components/` is token-driven with no baked-in hex as its primary
  value (see F8 for the two token-reference bugs, which are the exception, not the rule).
- `EntityTable.vue` already gives ~20+ CRUD screens loading/empty/error/search/pagination for free
  from one component — the single highest-leverage file in the whole codebase for both good news
  (states are already solved) and bad news (F5, no responsive story yet).
- Dark mode is complete and tested on both clients today. Any token restructuring (surface split or
  otherwise) must ship a dark variant alongside every light one from day one, not as a follow-up —
  the bar this codebase has already set for itself.
