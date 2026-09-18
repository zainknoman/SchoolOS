# SchoolOS — DESIGN.md

Version: 2.0.0 (SchoolOS-first reconciliation — IBM/Linear/Intercom are UX references, not brands)
Product: SchoolOS
Product Type: Multi-school Management / Student Information System
Platforms: Vue 3 + Vite Staff Console + Flutter Parent App
Design foundation: **SchoolOS** — the existing, shipping design system
(`staff-console/design-system/schoolos-staff-console/MASTER.md`), shared by both clients.

---

## Reconciliation note — why this version looks different from 1.x

Version 1.x of this file specified three independent visual brands (IBM/Carbon palette for
Management, Linear palette for Academic, Intercom palette for Parent), each with its own token
namespace (`--sp-*`), canvas color, corner-radius ceiling, and typeface. A full audit of the
existing application
(`docs/audit/2026-09-18-ui-design-system-audit/README.md`, `findings.md`, `implementation-plan.md`)
found that this would have discarded an already-shipping, actively-maintained, tested design
system — **SchoolOS** — used identically by the Vue staff-console and the Flutter parent-app,
including a complete light/dark theme, semantic status tokens, a real component library, RTL
infrastructure, and accessibility patterns backed by tests. A spec written one day before v1.0 of
this file (`docs/superpowers/specs/2026-09-17-ui-revamp-design-system.md`) had already explicitly
considered and rejected introducing a second visual register.

This version resolves that conflict in favor of the audit's recommended option: **SchoolOS remains
the one brand and the one token system for the whole product.** IBM/Carbon, Linear, and Intercom
are kept, but only as **UX-pattern references** — a vocabulary for how Management, Academic, and
Parent workflows should *behave and lay out* (density, table treatment, navigation depth,
conversational tone) — never as sources of a second palette, a second typeface, or a second
corner-radius system. Read `docs/audit/2026-09-18-ui-design-system-audit/` for the full history if
you need it; you should not need to re-derive any of this from the codebase again.

---

## 0. What already exists — read this before anything else

The canonical source of truth for every token value in this document is:
- **Web tokens**: `staff-console/src/assets/base.css` (imported once via `main.css`).
- **Web token rationale**: `staff-console/design-system/schoolos-staff-console/MASTER.md`.
- **Flutter tokens**: `parent-app/lib/src/theme/app_theme.dart` (`AppColors`/`AppColorsDark`,
  deliberately kept in exact hex parity with the web tokens — "one brand across both clients").

If a value in this file and a value in `base.css`/`app_theme.dart` ever disagree, **the code is
right and this file is stale** — update this file to match, don't assume the code needs to change.
This file describes how to *extend* those two source files, never how to replace them.

---

## 1. Design Mission

One product, one brand (SchoolOS), three workflow contexts that behave differently because the work
itself is different — not because they're different products:

1. **Management workflows** — SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, ACCOUNTS. Dense, operational,
   table-heavy. UX reference: **IBM Carbon** (behavior only — see Section 2).
2. **Academic workflows** — TEACHER, STUDENT. Focused, repetitive, one task at a time. UX
   reference: **Linear** (behavior only).
3. **Parent workflows (Flutter)** — PARENT. Mobile, child-centric, conversational. UX reference:
   **Intercom** (behavior only).

> Structured where administration is complex.
> Focused where academic work is repetitive.
> Warm where families consume information.

All three read SchoolOS colors, SchoolOS typography, and the SchoolOS component library. Only layout
density, information hierarchy, and interaction patterns differ per context — never the brand
itself. A user should never be confused about which product they're using when they move between
a Management screen and an Academic screen; they should notice the Parent app feels more relaxed
and mobile-native, not that it's a different company's product.

---

## 2. UX Reference Guide (behavior to borrow, not palettes to adopt)

| Context | UX reference | Borrow this behavior | Do NOT borrow |
|---|---|---|---|
| Management | IBM Carbon | Dense operational tables; precise information hierarchy via whitespace and font-weight rather than color; restrained, mostly-flat surfaces (hairline borders over drop shadows); one dominant primary action per view/section; efficient multi-step enterprise workflows (bulk actions, inline edit) | Carbon Blue `#0F62FE`, IBM Plex Sans, a 0px-corner mandate, a separate token namespace |
| Academic | Linear | Focused, single-task flows (already codified in this file's `OPEN → SEE → ACT → CONFIRM → RETURN` model); minimal chrome; contextual/inline actions over modal-heavy flows where reasonable; fast, keyboard-first navigation (the app's existing `Ctrl/Cmd+K` command palette already embodies this) | Linear's lavender `#5E6AD2` accent, near-black canvas, a separate token namespace |
| Parent | Intercom | Conversational, friendly copy (especially in empty/error states); card-first mobile layout; generous touch targets; child-centric information-first presentation (name/class/status before raw data tables) | Intercom's cream canvas, charcoal-as-primary, Fin Orange, a separate token namespace |

Every cell in the "borrow this behavior" column is achievable using **only** SchoolOS's existing
tokens and components (`--color-*`, `--space-*`, `--radius*`, `--shadow-*`, `EntityTable`,
`StatusPill`, `AppModal`, etc.) — density comes from *which* existing spacing/radius token a
screen chooses, not from a new one.

---

## 3. The One Brand (no second design system)

The whole product — both clients — shares:
- SchoolOS naming and logo.
- The SchoolOS color tokens (Section 4) — navy `#0F172A` / accent blue `#0369A1`, one light palette
  and one dark palette, identical meaning everywhere.
- Plus Jakarta Sans as the one typeface family on both clients (web and Flutter). No second
  display face is introduced for any context — this was already a deliberate choice per
  `MASTER.md` and the 2026-09-17 spec explicitly reaffirmed it.
- The existing 8px spacing rhythm (`--space-0` through `--space-6`).
- The existing semantic status vocabulary (Section 10) — identical meaning and identical colors on
  every screen, in every context, in both themes.
- The existing component library (`AppShell`, `EntityTable`, `Button`, `FormField`, `AppModal`,
  `ConfirmDialog`, `AppTabs`, `StatusPill`, `EmptyState`, `ErrorRetry`, `AppSkeleton`,
  `CommandPalette`, `ToastHost`, `DirectionalText`, `TrendsSparkline` on web; the Flutter
  equivalents in `parent-app/lib/src/`). **Reuse and improve these — do not fork or replace them.**
  A working, tested component does not get rebuilt just because its context calls for a denser or
  friendlier visual treatment; it gets a variant, a prop, or a style adjustment.
- The existing complete light/dark theme system on both clients. **Any new or changed visual value
  must ship with a tested dark-mode equivalent in the same change** — dark mode is not a follow-up
  task.
- The existing accessibility floor (Section 12) and RTL infrastructure (per-string detection via
  `DirectionalText`/`textDirection.ts` — unchanged, see Section 12).

Icons: the app currently uses a hand-rolled, line-based, single-family icon set
(`AppIcon.vue`, ~17 names, Phosphor-"regular" visual language) — this already satisfies "one
family, no emoji, line-based." Whether to migrate to Lucide is an **open decision**, not a
mandate — see "Open Decisions" at the end of this file. Do not begin an icon migration without
that decision being made first.

Only **layout density, information hierarchy, and interaction pattern** change per context
(Sections 5–7). Nothing in this file authorizes a second color palette, a second typeface, a
second corner-radius ceiling, or a second component library for any context.

---

## 4. Design Tokens — the one system (SchoolOS)

This is not a proposal — it is what `staff-console/src/assets/base.css` already defines, restated
here so this file stays a correct reference. **Do not add a parallel token namespace (no `--sp-*`
prefix, no per-surface palette).** New tokens, when genuinely needed, extend this same set with the
same naming convention and get both a light and a dark value.

```css
:root {
  /* Brand / neutral */
  --color-primary: #0f172a;
  --color-on-primary: #ffffff;
  --color-accent: #0369a1;
  --color-accent-hover: #025a8a;
  --color-background: #f8fafc;
  --color-surface: #ffffff;
  --color-text: #1e293b;
  --color-muted: #64748b;
  --color-muted-bg: #e8ecf1;
  --color-border: #e2e8f0;
  --color-destructive: #dc2626;
  --color-present: #15803d;
  --color-late: #b45309;
  --color-ring: #0369a1;
  --color-ring-glow: rgb(3 105 161 / 0.15);

  /* Semantic status (deliberately separate from --color-accent) */
  --color-status-success: var(--color-present);
  --color-status-success-tint: #e4f5ea;
  --color-status-warning: var(--color-late);
  --color-status-warning-tint: #fbf0de;
  --color-status-critical: var(--color-destructive);
  --color-status-critical-tint: #fce8e7;
  --color-status-info: var(--color-accent);
  --color-status-info-tint: #e4f1fa;
  --color-status-neutral: var(--color-muted);
  --color-status-neutral-tint: var(--color-muted-bg);

  /* Typography */
  --font-family-base: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-family-urdu: 'Noto Nastaliq Urdu', 'Plus Jakarta Sans', sans-serif;
  --font-family-mono: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --font-size-2xs: 0.68rem;
  --font-size-xs: 0.8rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.15rem;
  --font-size-xl: 1.5rem;
  --font-size-2xl: 1.9rem;

  /* Spacing — 8px rhythm; --space-0/-0-5 cover sub-8px micro-gaps */
  --space-0: 0.15rem;
  --space-0-5: 0.3rem;
  --space-1: 0.5rem;
  --space-2: 0.75rem;
  --space-3: 1rem;
  --space-4: 1.5rem;
  --space-5: 2rem;
  --space-6: 3rem;

  /* Structural */
  --sidebar-width: 240px;
  --topbar-height: 60px;
  --radius: 8px;
  --radius-sm: 6px;
  --radius-full: 9999px;

  /* Elevation — hue-tinted via --shadow-color, never pure black */
  --shadow-color: 15 23 42;
  --shadow-sm: 0 1px 2px rgb(var(--shadow-color) / 0.06), 0 1px 3px rgb(var(--shadow-color) / 0.1);
  --shadow-md: 0 4px 12px rgb(var(--shadow-color) / 0.12);
  --shadow-lg: 0 20px 60px -12px rgb(var(--shadow-color) / 0.35);

  /* Motion */
  --duration-fast: 150ms;
  --duration-base: 200ms;
  --duration-slow: 300ms;
  --ease-standard: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --transition-fast: var(--duration-fast) var(--ease-standard);
  --transition-base: var(--duration-base) var(--ease-standard);
}
```

A complete dark-mode override of every color token above already exists in `base.css`, applied via
`@media (prefers-color-scheme: dark)` and an explicit `:root[data-theme='dark']` override (the
explicit toggle wins in both directions). The Flutter theme mirrors this with `AppColors` /
`AppColorsDark`. Any new token added to this section must be added to `base.css` with both a light
and dark value, and to `app_theme.dart` if the Flutter side needs it too.

Use these tokens for all design-system values: colors, typography sizes, spacing, radii,
shadows/elevation, component dimensions. Do not introduce arbitrary visual values. Small
implementation primitives (a 1px border, `line-height: 1.5`, other CSS structural values that
aren't design-system decisions) may remain literal — don't waste effort tokenizing every CSS
primitive.

**Known token bugs to fix as part of any pass that touches these files** (from the audit,
`findings.md` F8): `views/AssessmentCategoriesView.vue` and `views/MessagesView.vue` reference
`var(--color-warning, ...)` and `var(--color-surface-muted, ...)` — neither token exists in
`base.css`. Either point these at the real existing token (`--color-status-warning` for the first
case) or, if a genuinely new semantic is needed (e.g. a muted-surface tint distinct from
`--color-muted-bg`), add it properly to `base.css` with a dark-mode pair — never leave a component
silently relying on its CSS fallback value.

---

## 5. Management workflows (IBM Carbon-inspired behavior, SchoolOS tokens)

No new palette, no new radius scale. Apply Carbon's *density and restraint*, expressed through
tokens that already exist:

- **Tables** (`EntityTable.vue`, used by 20+ Management screens): favor tighter row padding
  (`--space-1`/`--space-2` over `--space-3`/`--space-4`) for a denser, Carbon-like data grid feel.
  Hairline `--color-border` row dividers, no per-row shadow.
- **Cards**: prefer `--radius-sm` (6px) over `--radius` (8px) for a flatter, more restrained
  management surface; 1px `--color-border` hairline, `--shadow-sm` at most — reserve `--shadow-md`/
  `--shadow-lg` for genuinely floating elements (modals, dropdowns), not page-level cards. This
  mirrors Carbon's "hierarchy from whitespace and surface stepping, not drop shadow" principle
  using SchoolOS's own surface/border tokens instead of Carbon's.
- **Buttons**: one dominant primary action per view/section (already `Button.vue`'s `primary`
  variant) — never multiple equal-weight primaries on a Management screen.
- **Numeric/tabular data**: keep using the existing `.tabular` utility (`--font-family-mono`, IBM
  Plex Mono) wherever a Management table shows aligned numeric columns (fee amounts, counts,
  percentages) — this is already shipped and already the right pattern; apply it more
  consistently across Management tables that don't yet use it.
- **Typography**: stays Plus Jakarta Sans. No IBM Plex Sans, no new weight/tracking system.

**Responsiveness (audit finding F5, required):** `EntityTable.vue` currently has no responsive
reflow strategy — every Management list screen (Students, Staff, Parents, Fees, Admissions,
Hiring, Circulars, Complaints, and more) inherits this gap since they all render through this one
component. Any Management-workflow pass must give `EntityTable.vue` a responsive strategy (e.g.
card-per-row below a breakpoint, or horizontal scroll with a sticky first column — pick one pattern
and apply it once, in the shared component) and verify it at 1440/1024/768/390px. Fixing this once
in `EntityTable.vue` fixes it for every Management (and Academic) screen built on it.

---

## 6. Academic workflows (Linear-inspired behavior, SchoolOS tokens)

No new accent color. `--color-accent` (`#0369A1`) stays the one accent everywhere, including
Academic screens.

- **Interaction model** (unchanged, still correct):
  ```
  OPEN → SEE → ACT → CONFIRM → RETURN
  ```
  Never make a teacher re-select class/section/date they already picked in the same flow.
- **Chrome**: minimal — favor contextual, inline actions over opening `AppModal` where the action
  is small and reversible (e.g. inline status toggle vs. a full dialog); reserve `AppModal`/
  `ConfirmDialog` for genuinely destructive or multi-field actions, matching how they're already
  used.
- **Navigation speed**: the existing `Ctrl/Cmd+K` command palette (`CommandPalette.vue`) already
  delivers Linear's "fast, keyboard-first navigation" — extend its Academic-side coverage
  (attendance, diary, gradebook, timetable) rather than building a second navigation mechanism.
- **Cards**: `--radius` (8px, the existing default) is already a reasonable "focused, slightly
  softer than Management" register — no new radius token needed.
- **Typography**: stays Plus Jakarta Sans, same weights as everywhere else — no separate
  negative-tracking display treatment.

---

## 7. Parent App — Flutter (Intercom-inspired behavior, SchoolOS tokens + planned warm accent)

No cream canvas, no charcoal-as-primary, no orange. The Parent app keeps the same
`AppColors`/`AppColorsDark` base as the staff console (background, surface, text, accent) — per
the audit, this shared-brand choice was already deliberate ("one brand across both clients") and
is preserved here.

What *does* change for Parent, and is already scoped in
`docs/superpowers/specs/2026-09-17-ui-revamp-design-system.md` /
`docs/superpowers/plans/2026-09-17-ui-revamp.md` (confirmed by the audit as written but **not yet
executed** — fold this plan in rather than re-deriving a competing version):

- **One warm accent, used sparingly**: `accentWarm` (`#EA7317`) for quick-action icon chips (fees,
  events) — "the single bold hit per screen," never paired with a second saturated color. This is
  Intercom's "warmer where appropriate" borrowed as one accent extension, not a palette swap.
- **Subject-tint icon chips**: low-saturation tints derived from existing tokens (attendance →
  status-success tint, fees → accentWarm tint, timetable → accent tint, messages → primary tint)
  behind each stat/quick-action icon.
- **`ProfileHeader` widget**: child-centric information first — avatar, name, class/section, and
  (only where real data exists — never fabricated) a small stat strip, in a compact variant for
  Home and a fuller variant for detail contexts.
- **Tabular numerals** on numeric stat values (attendance %, fee amounts), mirroring the web
  client's existing `.tabular` treatment.
- **Explicit type scale** (`displaySmall`, `titleMedium`, `bodyMedium`, `labelSmall`) replacing the
  bare `GoogleFonts.plusJakartaSansTextTheme()` passthrough, so weight/size choices are deliberate.
- **Conversational tone in copy**: empty/error states on Parent screens should read warmer and more
  human than Management's (still no fabricated data, still recoverable language) — this is a copy
  guideline, not a token.
- **Card-first layout, generous touch targets**: minimum 44×44px touch target (already documented,
  keep it), card-based presentation over dense lists/tables (already the case — "Tables: Avoid" in
  Section 9 is unchanged).

**Bottom navigation — open decision, do not change destination count yet (audit finding F4):** the
app currently ships 6 bottom-nav destinations (Home, Calendar [bundling Timetable/Attendance/Diary
as sub-tabs], Circulars, Messages, Fees, More). A prior draft of this file asserted a 4–5
destination maximum without reconciling where Circulars would go. Do not reduce or restructure the
destination count as a side effect of visual work — that is an information-architecture decision
requiring its own review (see "Open Decisions" at the end of this file). Visual/token work on the
existing 6-destination shell may proceed independently.

**Dark mode**: `AppColorsDark` already exists and must gain a value for every new token in this
section (`accentWarm`, tint set) exactly as `AppColors` does — this was already the plan in the
2026-09-17 spec and remains required here.

---

## 8. Icons — open decision, not a mandate

The current icon system (`AppIcon.vue`) is a hand-rolled, closed-union (~17 names) inline-SVG set,
line-based, single-family, no emoji — this already satisfies the *intent* behind "one consistent
icon language." Whether to additionally adopt Lucide as a named library is an **open decision**
(see "Open Decisions"), not something to migrate automatically as part of any revamp pass. Do not
swap icon sets, add an icon-library dependency, or touch `AppIcon.vue`'s type union until that
decision is made.

---

## 9. Density Rules

Density is the primary way the three workflow contexts feel different, using the same token scale
(Section 4) rather than different tokens:

```
Management   Density: High    Tables: High     Cards: Low–Medium (favor --radius-sm, --shadow-sm max)
Academic     Density: Medium  Tables: Medium   Cards: Medium (--radius default)
Parent       Density: Low     Tables: Avoid    Cards: Medium, generous whitespace, warm accent chips
```

Never make the Parent App look like the Admin Console. Never make the Admin Console feel like a
consumer mobile app. The distinction comes from spacing choices, card usage, and navigation depth
— not from a different brand.

---

## 10. Status Badges (identical semantics and colors everywhere — already implemented)

This already matches `StatusPill.vue` and the SchoolOS status tokens; restated here so the mapping is
explicit and doesn't drift:

```
Active / Present / Completed → --color-status-success
Pending / Late                → --color-status-warning
Inactive / Draft / Holiday    → --color-status-neutral
Rejected / Absent             → --color-status-critical
Leave                         → --color-status-info
```

Same status = same color, on every surface, in both themes, no exceptions. No change needed here —
this is a "preserve as-is" section.

---

## 11. States (already largely implemented — reuse, don't rebuild)

Every new or touched screen needs loading, empty, and error states, and this app already has
reusable components for all three — use them instead of building screen-local versions:

- **Loading**: `AppSkeleton.vue` (shape-matched shimmer, not a spinner for known layouts);
  `EntityTable.vue` already renders skeleton rows built-in.
- **Empty**: `EmptyState.vue` (icon + title + optional message + optional CTA);
  `EntityTable.vue` already renders this built-in when `items` is empty.
- **Error**: `ErrorRetry.vue` (`role="alert"`, human-language message, Retry action) — never a raw
  stack trace or `AxiosError` string.
- **Success**: `ToastHost.vue`/`useToast.ts` for lightweight confirmations; nothing that must stay
  visible goes in a toast.
- **Destructive-action confirmation**: `ConfirmDialog.vue`/`useConfirm.ts` is the *only* confirm
  path app-wide — native `window.confirm()` is fully eliminated and guarded by a standing
  regression test (`noWindowConfirm.spec.ts`). Never reintroduce `window.confirm()`.

If a screen needs one of these states and isn't using the existing component, that's a bug to fix
by wiring the existing component in — not a reason to design a new one.

---

## 12. Accessibility & RTL

WCAG 2.2 AA floor (already largely verified per `MASTER.md`'s own checklist): contrast, keyboard
nav, visible focus (`--color-ring`, never removed), semantic HTML, 44px touch targets, no
color-only status signaling, `prefers-reduced-motion` respected. Re-verify contrast on any new
token value introduced under Sections 5–7 — a density or accent change can silently break a
previously-verified ratio.

**Urdu font — preserve unless the user says otherwise.** The shipped token is
`--font-family-urdu: 'Noto Nastaliq Urdu'` (the traditional Urdu calligraphic style), used by
`DirectionalText.vue` for RTL free-text content. A prior draft of this file specified Noto Sans
Arabic instead — a genuinely different typographic choice, not a naming variant. Per the
preservation principle (Section 13), keep Noto Nastaliq Urdu; flagged as an **open decision** only
if there's a documented reason to prefer a sans-serif Arabic face instead.

**Per-string RTL detection — preserve as-is.** `textDirection.ts` (`detectDirection`/
`detectLang`) and `DirectionalText.vue` correctly detect and render individual free-text fields
(diary entries, messages) with the right `dir`/`lang`/font regardless of the document's overall
locale. This mechanism is not the gap and must not be changed or replaced.

**Document/layout-level RTL — the real gap, improve using CSS logical properties.** The audit
found `lib/i18n.ts`'s own code comment: "a full CSS logical-properties refactor is a documented
follow-up," confirmed by physical-property usage (`padding-left`, `margin-left`, etc.) in
`AppShell.vue`, `EntityTable.vue`, and elsewhere. Where a component's layout depends on direction
(sidenav position, table cell alignment, breadcrumb separators, icon-then-label ordering), migrate
the relevant properties to logical equivalents (`padding-inline-start`, `margin-inline-end`,
`text-align: start`, etc.) so the existing `dir="rtl"` document attribute (already set by
`applyLocaleToDocument()`) mirrors these elements correctly instead of relying on incidental
flex-direction behavior. This is a CSS-property migration on existing components, not a new
subsystem.

---

## 13. Preservation Rules (non-negotiable)

Do **not** change, remove, or weaken any of the following as a side effect of visual work, unless
explicitly asked:
- Routes and route structure
- API contracts
- Authentication and authorization logic (including every existing role-gate condition in
  `router/index.ts` and `AppShell.vue`)
- Business logic
- Database models and behavior
- Validation rules
- Existing automated tests (`*.spec.ts`, `*_test.dart`) and their `data-testid`/`Key` hooks — a
  visual change that breaks a test's finder needs the test updated deliberately, not the assertion
  loosened to pass
- Real data — never substitute mock/fabricated data to make a screen "look better," and never
  invent a stat a screen doesn't actually have loaded (matches this repo's existing standard, see
  `PROJECT-STATUS.md`)

Do **not** preserve a bad UI just because it exists — refactor presentation freely; preserve
*behavior*, not visual mistakes. And do not remove a working component merely because its visual
implementation is being redesigned (Section 3) — redesign it in place.

---

## 14. Workflow Context Resolution (not a token-swap — a UX-pattern selector)

There is one token system (Section 4). Role determines which *UX-pattern guidance* (Sections 5–7)
applies to a screen — it does not select a different palette or component set:

```
SUPER_ADMIN / SCHOOL_ADMIN / PRINCIPAL / ACCOUNTS → Management workflow guidance (Section 5)
TEACHER / STUDENT                                  → Academic workflow guidance (Section 6)
PARENT (Flutter)                                   → Parent workflow guidance (Section 7)
```

If an implementation finds it useful to hang density/layout overrides off a `data-context`
attribute (e.g. `[data-context="management"] .entity-table { --row-padding: var(--space-1); }`,
still resolving to existing SchoolOS tokens), that is an acceptable implementation detail — but it is
optional and decided at implementation time, not a mandated architecture, and it must never
introduce a second color/typeface/radius palette under that attribute.

---

## 15. Existing Application Audit — REQUIRED

Before modifying any UI, inspect the existing application. A full audit already exists at
`docs/audit/2026-09-18-ui-design-system-audit/` — read it first; only re-run parts of this checklist
if `git log` shows meaningful changes since then that the existing audit wouldn't reflect.

The agent MUST identify (or confirm from the existing audit):
- all frontend applications
- routing structure
- authentication flow
- role-based navigation
- existing layouts
- existing reusable components
- existing design tokens
- existing CSS/theme files
- existing pages/routes
- existing API integrations
- existing loading states
- existing empty states
- existing error states
- existing responsive behavior

Do not assume that a page, component, route, or module exists or does not exist. Search the
repository (or the existing audit) before creating anything. Do not create duplicate components
when an existing reusable component can be upgraded. **Do not create a second design system beside
SchoolOS.** The goal is to migrate and refine the existing UI within the SchoolOS (SchoolOS) design
system, not to build a parallel one.

---

## 16. Complete Revamp Requirement

When the user requests a complete application UI revamp, treat it as a product-wide *refinement and
consistency* pass within SchoolOS — applying the density/UX-pattern guidance in Sections 5–7 and the
audit-driven fixes below — not a brand replacement.

Do not redesign only the dashboard. The revamp must cover, as applicable: authentication screens,
application shell, sidebar/navigation, topbar, dashboards, list pages, tables, detail pages,
profile pages, forms, dialogs, filters, search, pagination, attendance, admissions, students,
teachers, parents, academics, timetable, diary, homework, assessments, results, fees, accounts,
circulars, notifications, reports, settings, role-specific screens, loading states, empty states,
error states, responsive layouts, mobile navigation.

All existing functional routes must remain usable. The visual system (SchoolOS, refined per
Sections 5–7) must be applied consistently across the application.

**Audit findings that any Complete Revamp pass must incorporate:**
- Make `EntityTable.vue` responsive (Section 5) — it's shared by 20+ CRUD screens; fixing it once
  fixes all of them.
- Fix the undefined `--color-warning`/`--color-surface-muted` token references (Section 4).
- Improve document/layout-level RTL using CSS logical properties (Section 12), without touching
  the working per-string `DirectionalText`/`textDirection.ts` mechanism.
- Treat the icon-system choice (Lucide vs. existing `AppIcon.vue`) as a decision to make, not an
  automatic migration (Section 8).
- Treat the Parent bottom-navigation destination count as an information-architecture decision to
  make, not a side effect of visual work (Section 7).
- Ship a tested dark-mode equivalent for every new or changed visual value, on both clients
  (Section 3, Section 7).
- Reuse, don't rebuild, the existing loading/empty/error/confirmation/toast/accessibility patterns
  (Section 11).

---

## 17. Claude Code Instructions

1. Read this DESIGN.md before any UI change. If you haven't already, also read
   `docs/audit/2026-09-18-ui-design-system-audit/` — it answers most "does X already exist"
   questions this file would otherwise send you to search for.
2. Perform (or confirm from the existing audit) the Existing Application Audit (Section 15) before
   writing new code.
3. Identify the authenticated role → resolve the workflow-context guidance via Section 14. This
   selects which of Sections 5/6/7 applies — it does not select a different token set.
4. Reuse existing components; only add new ones when nothing fits. Never fork a component to give
   it a different visual treatment per context — extend it (prop, variant, or scoped style).
5. Use only the SchoolOS tokens in Section 4 for design-system values — no new token namespace, no
   arbitrary hex/px. Small structural CSS primitives may remain literal.
6. Preserve routes, API contracts, auth, validation, tests, and real data (Section 13).
7. Implement loading/empty/error states on every new or touched screen using the existing
   components (Section 11) — do not build screen-local versions.
8. Test at 1440 / 1024 / 768 / 390px, and in both light and dark theme.
9. No generic AI dashboard patterns: no gradient KPI cards, no decorative illustrations, no
   rainbow charts, no emoji icons, no marketing-style hero sections on internal app pages.
10. Do not introduce a second color palette, typeface, or corner-radius system under the guise of
    "matching IBM/Linear/Intercom" — Sections 2 and 5–7 define exactly what to borrow from each,
    and it is behavior, not palette.
11. When the task is a complete application revamp, apply the Complete Revamp Requirement
    (Section 16), including every audit-driven fix listed there — do not stop after one screen.
12. Do not resolve any item in "Open Decisions" below unilaterally — surface it to the user first.

---

## Open Decisions (do not resolve unilaterally — ask the user)

1. **Icon system**: keep `AppIcon.vue` (already line-based/single-family) or migrate to Lucide
   (new dependency, ~17+ call sites to update)? (Section 8, audit finding F7)
2. **Urdu font**: keep Noto Nastaliq Urdu (current, traditional calligraphic style) or switch to a
   sans-serif Arabic face? Default is to preserve the current choice absent a documented reason to
   change it. (Section 12, audit finding F12)
3. **Parent bottom-navigation IA**: keep 6 destinations (Home, Calendar, Circulars, Messages, Fees,
   More) or restructure — and if restructuring, where does Circulars go? (Section 7, audit finding
   F4)
4. **Extent of Parent visual differentiation**: is the warm-accent extension described in Section 7
   (and already scoped in the 2026-09-17 plan) sufficient, or does the user want a more pronounced
   Intercom-like visual shift within the SchoolOS palette (e.g. a warmer neutral background instead of
   the current cool `--color-background`)? Any such change still must not introduce a second
   palette or break dark-mode parity.
