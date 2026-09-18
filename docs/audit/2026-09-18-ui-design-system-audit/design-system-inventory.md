# Design-System Inventory

What exists today, with exact file paths and token names, so a future pass can act on this instead
of re-discovering it.

## 1. The existing design system: "SchoolOS Staff Console"

**Source of truth:** `staff-console/design-system/schoolos-staff-console/MASTER.md`.

Deliberately chosen (not a default): "Productivity Tool" × "Minimalism & Swiss Style", explicitly
anti-playful, anti-gradient, anti-emoji, anti-mascot. Documented through a 2026-09-17 addendum
covering dark mode, status tokens, shell features, component library, and a token-hardening pass —
i.e. actively maintained one day before DESIGN.md was written.

**Token file:** `staff-console/src/assets/base.css` (imported once via `main.css`). All tokens are
CSS custom properties on `:root`, with a full second value set under
`@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { ... } }` and
`:root[data-theme='dark'] { ... }` (explicit toggle wins over OS default in both directions).

| Category | Tokens |
|---|---|
| Brand/neutral color | `--color-primary`, `--color-on-primary`, `--color-accent`, `--color-accent-hover`, `--color-background`, `--color-surface`, `--color-text`, `--color-muted`, `--color-muted-bg`, `--color-border`, `--color-destructive`, `--color-present`, `--color-late`, `--color-ring`, `--color-ring-glow` |
| Status/semantic color | `--color-status-{success,warning,critical,info,neutral}` + `-tint` variants (deliberately separate from `--color-accent`; used only by `StatusPill.vue` and status-coded UI) |
| Typography | `--font-family-base` (Plus Jakarta Sans), `--font-family-urdu` (Noto Nastaliq Urdu), `--font-family-mono` (IBM Plex Mono, for tabular/numeric data via `.tabular` utility class), `--font-size-{2xs,xs,sm,base,lg,xl,2xl}` |
| Spacing | `--space-{0,0-5,1,2,3,4,5,6}` (8px base rhythm; `0`/`0-5` cover sub-8px micro-gaps) |
| Structural | `--sidebar-width` (240px), `--topbar-height` (60px) |
| Radius | `--radius` (8px), `--radius-sm` (6px), `--radius-full` (9999px) |
| Elevation | `--shadow-{sm,md,lg}`, hue-tinted via `--shadow-color` (RGB triple that itself flips per theme, so shadows re-tint automatically in dark mode) |
| Motion | `--duration-{fast,base,slow}`, `--ease-{standard,spring}`, `--transition-{fast,base}` |

No `[data-surface="..."]` scoping exists anywhere in the codebase — one token set serves both the
Teacher (Academic) and Admin/Accounts/Super Admin (Management) role families.

## 2. Flutter parent-app theme

**Source of truth:** `parent-app/lib/src/theme/app_theme.dart`.

`AppColors` (light) / `AppColorsDark` (dark) mirror the Vue tokens **by exact hex value** (code
comment: "Same tokens as the staff console... one brand across both clients", and "exact hex
parity, not a re-derived palette" for the dark set). `ColorScheme.fromSeed` (Material 3) derives
the rest of the Material palette from `accent`. Font: `GoogleFonts.plusJakartaSansTextTheme()` —
same family as web. Card/input/button radius: hardcoded `BorderRadius.circular(8)` in three places
(`inputDecorationTheme`, `elevatedButtonTheme`, implied card defaults) — matches web's `--radius`
value but as a literal, not a shared constant.

A newer spec (`docs/superpowers/specs/2026-09-17-ui-revamp-design-system.md`) already planned an
*extension* of this palette — `accentWarm` (`#EA7317`) plus subject-tint chips for the Home tab —
without introducing a second brand. Check whether `docs/superpowers/plans/2026-09-17-ui-revamp.md`
has been executed before assuming `app_theme.dart` is still exactly as read during this audit.

## 3. Reusable component library (`staff-console/src/components/`)

All co-located with a `*.spec.ts`. All token-driven (no component reads a hardcoded hex as its
primary value — see `findings.md` for the two components with `var(--token, #fallback)` fallbacks
referencing tokens that don't actually exist in `base.css`).

| Component | Purpose | States handled |
|---|---|---|
| `AppShell.vue` | Topbar + sidenav + content slot; owns theme toggle, locale switcher, notifications dropdown, command-palette trigger, mobile off-canvas sidebar (hamburger, backdrop, Escape/Tab-cycle containment) | responsive (≤768px off-canvas) |
| `AppIcon.vue` | Hand-rolled outline SVG icon set (Phosphor-"regular" visual language), fixed closed union of ~17 names | — |
| `Button.vue` | `primary`/`secondary` variants only | disabled |
| `EntityTable.vue` | Generic typed table: built-in search, pagination, per-column cell slots, actions slot | loading (skeleton rows), empty (delegates to `EmptyState`), no-results-from-search row |
| `FormField.vue` | Single control wrapper: text/password/date/email/select/checkbox/textarea | error message slot |
| `AppModal.vue` | Generic dialog: overlay, Escape-to-close, click-outside-to-close | — |
| `ConfirmDialog.vue` | The **only** destructive-action confirm path app-wide (backed by `useConfirm.ts` queue); replaces native `window.confirm()` entirely, enforced by `noWindowConfirm.spec.ts` | focus-trap-on-open, focus-restore-on-close |
| `AppTabs.vue` | Tab list + panels, roving-tabindex arrow-key navigation | — |
| `StatusPill.vue` | Semantic status badge: `success`/`warning`/`critical`/`info`/`neutral` tones | — |
| `EmptyState.vue` | Icon + title + optional message + optional CTA | (is itself the empty state) |
| `ErrorRetry.vue` | Icon + message + Retry button, `role="alert"` | (is itself the error state) |
| `AppSkeleton.vue` | Shimmer placeholder (rect or circle) | (is itself the loading state) |
| `CommandPalette.vue` | `Ctrl/Cmd+K` palette, indexes routes + role-gated quick actions | — |
| `ToastHost.vue` | Toast notifications (backed by `useToast.ts`) | — |
| `DirectionalText.vue` | Per-string RTL/LTR detection + rendering (see Section 5) | — |
| `TrendsSparkline.vue` | Multi-series inline SVG line chart with accessible label, y/x axis, legend | — |

This already satisfies most of DESIGN.md Section 11's "States (required on every screen)" rule at
the component level — `EntityTable` alone gives any CRUD screen built on it loading/empty/error
handling for free, and `ErrorRetry`/`EmptyState`/`AppSkeleton` are reused, not reimplemented, per
screen (confirmed: `AdminHomeView.vue` composes `ErrorRetry` + `AppSkeleton` directly rather than
rolling its own).

## 4. Route-wrapper pattern

`*PageView.vue` files (33 of them) are not duplicate components — see `architecture.md` Section 3.
Every one follows the identical two-line pattern: `<AppShell><XxxView /></AppShell>`.

## 5. RTL / i18n implementation

- **Library-level i18n**: `vue-i18n`, locale files `locales/en.json` / `locales/ur.json`,
  persisted via `localStorage` (`schoolportal.locale`), applied via `lib/i18n.ts`.
- **Document-level direction**: `applyLocaleToDocument()` sets `document.documentElement.lang` and
  `.dir` — a coarse flip. Code comment explicitly flags this as interim: "browser-default bidi +
  flex behavior does most of the visual mirroring; a full CSS logical-properties refactor is a
  documented follow-up." I.e. CSS in this codebase largely uses physical properties
  (`margin-left`, `padding-left`, `text-align: left`, etc.), not logical ones
  (`margin-inline-start`, etc.) — confirmed by spot-checking `AppShell.vue`, `EntityTable.vue`.
- **Per-string script detection**: `lib/textDirection.ts` (`detectDirection`/`detectLang`) —
  Unicode-range-based, no language-model guessing. Used by `DirectionalText.vue` to render
  individual free-text fields (e.g. diary entries, messages) with correct `dir`/`lang`/font
  regardless of the app's overall locale setting. Font for RTL content:
  `--font-family-urdu: 'Noto Nastaliq Urdu'` — note this differs from DESIGN.md Section 4's
  `--sp-font-ur: "Noto Sans Arabic"` (Nastaliq is the traditional Urdu calligraphic style; Noto
  Sans Arabic is a sans-serif Arabic-script face — a real typographic difference, not a naming
  variant; flagged as a decision point, not an inconsistency, in `findings.md`).
- **Flutter side**: `l10n/app_en.arb` / `app_ur.arb` (standard Flutter ARB localization) +
  `theme/text_direction.dart`, `theme/locale_controller.dart`. Not cross-checked line-by-line
  against the web side's string coverage in this pass.

## 6. Loading / empty / error state inventory

| Pattern | Where implemented | Reused by |
|---|---|---|
| Skeleton loading | `AppSkeleton.vue` | `EntityTable.vue` (built-in), `AdminHomeView.vue` (custom skeleton layout matching its own grid) |
| Empty state | `EmptyState.vue` | `EntityTable.vue` (built-in, via `empty*` props) |
| Error + retry | `ErrorRetry.vue` | `AdminHomeView.vue` (dashboard load failure) — not yet confirmed on every CRUD view; each `*View.vue` was not individually opened in this pass beyond the samples in `findings.md` |
| Toasts | `ToastHost.vue` + `useToast.ts` | app-wide, for lightweight confirmations (matches DESIGN.md Section 11's toast guidance already) |
| Confirm-before-destroy | `ConfirmDialog.vue` + `useConfirm.ts` | app-wide, enforced by regression test |

## 7. Responsive implementation

Only **two** files contain `@media` queries directly: `AppShell.vue` (sidenav → off-canvas overlay
below 768px, hamburger toggle) and `AdminHomeView.vue` (stat-grid/lower-grid column collapse at
1024px/640px/768px). No other sampled view was found to have its own breakpoint handling — most
rely on `EntityTable`'s table markup, which has no responsive reflow (a `<table>` at 390px will
horizontally scroll or overflow, not collapse to cards). See `findings.md` for severity.

## 8. Where the Parent Flutter app's own design intent lives

Two documents describe intended (not necessarily fully shipped — verify against current code
before reusing) visual direction for the parent-app specifically:
- `docs/superpowers/specs/2026-09-17-ui-revamp-design-system.md` — profile-header component,
  subject-tint icon chips, tabular numerals, explicit type scale.
- `docs/superpowers/plans/2026-09-17-ui-revamp.md` — the task-by-task plan for the above.

**Confirmed as of this audit: not yet executed.** `parent-app/lib/src/widgets/profile_header.dart`
does not exist, and neither `StudentProfileView.vue` nor `StaffProfileView.vue` contains a
profile-header block. Treat both plans as still-pending work, not shipped state — a revamp that
touches these same screens should either fold this plan in or explicitly supersede it, not ignore
it and risk producing a conflicting second attempt at the same profile-header idea.
