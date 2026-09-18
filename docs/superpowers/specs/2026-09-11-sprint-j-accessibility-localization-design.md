# Sprint J — Accessibility & Localization Scope Decision + Build-Out (Phase 6)

Status: approved (design), ready for implementation planning.
As of commit `32d6e26` on `main`.
Spec source: `docs/Plan-Ideas/SchoolOS-PostMVP-Roadmap-2026-09-08.md`, §4 "Sprint J —
Accessibility & Localization Scope Decision + Build-Out (Phase 6)".

**Scope decisions made by the user (not silently by engineering), per the roadmap's own explicit
instruction that these two questions require a product call before engineering starts:**
- **Localization: both clients.** Staff console and parent app both get translated app-chrome
  (English + Urdu) in this phase — not a content-only or single-client scope.
- **Responsive shell: build a real collapsible/overlay sidebar for the staff console**, not a
  documented desktop-only decision.

Both decisions materially increase this sprint's scope past the roadmap's original 3-week estimate —
noted here transparently rather than silently absorbed, matching this project's practice of
surfacing scope deltas found during planning (e.g. Sprint E/H's "found during prep, not originally
listed" notes).

## Reconciliation with the roadmap doc before scoping work

Verified against `build/staff-console` and `build/parent-app` at commit `32d6e26`:

1. **Command palette** (`staff-console/src/components/CommandPalette.vue`) — CONFIRMED no focus trap
   (keydown handling at lines 70-92 is bound only to the `<input>`; no `Tab`/`Shift+Tab` interception,
   no focus-sentinel elements, no `inert`/`<dialog>` use) and CONFIRMED partial ARIA only: the panel
   has `role="dialog" aria-modal="true" aria-label="Command palette"` but **no** `role="listbox"`,
   `role="option"`, `aria-selected`, or `aria-activedescendant` — the highlighted item is only a CSS
   `.selected` class, invisible to assistive tech.
2. **Skip-to-content** — CONFIRMED absent. `AppShell.vue`'s scrollable region is
   `<main class="content">` (line 382) with no `id`; no skip-link anchor exists anywhere in
   `staff-console/src`.
3. **Disclosure buttons** — CONFIRMED inconsistent, not uniformly missing. The per-student overflow
   menu (`AttendanceView.vue:163-172`) has `aria-haspopup="true"` but no `aria-expanded`; the
   notifications bell dropdown (`AppShell.vue:273-286`) has `aria-label` only, neither
   `aria-haspopup` nor `aria-expanded`.
4. **`TrendsSparkline.vue`** — CONFIRMED zero accessible name: a bare `<svg>` with `<polyline>`/
   `<circle>` children, no `role="img"`, no `aria-label`, no `<title>`.
5. **RTL/Urdu** — CONFIRMED `dir` is set dynamically (`textDirection.ts`'s `detectDirection()`) in
   `DirectionalText.vue`, `DiaryView.vue`, `CircularsView.vue` and others, but **`lang` is never set
   anywhere in the codebase** — grep for `lang="ur"`/`:lang=` returns zero hits outside
   `<script lang="ts">` blocks. This is a real, quick, independent fix — content is marked RTL but
   never marked as Urdu-language content, which is a screen-reader pronunciation/voice-selection bug,
   not just a cosmetic gap.
6. **Flutter `Semantics`** — CONFIRMED `Semantics(` is unused anywhere in `parent-app/lib`. The three
   icon-only actions named by the roadmap are confirmed unlabeled: send-reply
   (`messages_tab.dart:471-475`), receipt download (`fees_tab.dart:126-132`), attachment download
   (`circulars_tab.dart:119-127`) — all bare `IconButton(icon: ..., onPressed: ...)` with no
   `tooltip`. **A working convention already exists to copy**: `home_shell.dart:203-216`'s
   notifications/logout `IconButton`s already set `tooltip: '...'` — the fix is applying the
   project's own existing pattern to three buttons that were missed, not inventing one.
7. **i18n infra** — CONFIRMED zero on both clients: no `vue-i18n` in `staff-console/package.json`, no
   `flutter_localizations` in `parent-app/pubspec.yaml`, zero `.arb` files anywhere. This is
   genuinely greenfield on both sides, exactly as scoped by the "both clients" decision above.
8. **Staff-console responsive shell** — CONFIRMED zero mobile handling: `AppShell.vue`'s
   `<style scoped>` block has no `@media` query at all; `.sidenav` has a fixed `var(--sidebar-width)`
   with no breakpoint override; no `isMobile`/`sidebarCollapsed` state exists in `<script setup>`.
   Only non-layout `@media` queries in the whole app are `prefers-color-scheme`/
   `prefers-reduced-motion` in `base.css`.
9. **a11y test infra** — CONFIRMED absent on both clients (no `jest-axe`/`axe-core` anywhere).
10. **Test frameworks, confirmed for planning**: staff-console uses Vitest (`vitest.config.ts`,
    co-located `*.spec.ts` files); parent-app's Flutter tests live under `parent-app/test/`, mirroring
    `lib/src/`'s structure.

## Decisions this spec makes

**a11y test tooling**: staff-console uses `axe-core` directly (call `axe.run()` against the rendered
DOM inside a Vitest test, assert zero violations) rather than adding a `jest-axe`/`vitest-axe` wrapper
dependency of uncertain maintenance status — one fewer dependency, same underlying engine.
Parent-app uses `flutter_test`'s **already-bundled** accessibility guideline matchers
(`meetsGuideline(textContrastGuideline)`, `meetsGuideline(labeledTapTargetGuideline)`,
`meetsGuideline(androidTapTargetGuideline)`) — these ship with the Flutter SDK's `flutter_test`
package already in `parent-app/test/`, so this needs zero new dependency, not a new library.

**Localization library choice**: `vue-i18n` (Composition API mode, matching this codebase's existing
`<script setup>` convention throughout) for staff-console; `flutter_localizations` +
`.arb`-file-based `AppLocalizations` (the standard Flutter toolchain path, code-generated via
`flutter gen-l10n`) for parent-app. Both are the de facto standard choice for their framework — no
alternative was seriously considered.

**Locale preference is stored client-side only (`localStorage` / `shared_preferences`), not synced
through the backend.** No `User.locale` field exists today and this sprint's scope is already large
across two independent decisions; a per-device language preference is a reasonable v1 (a user who
switches devices re-picks their language once — a minor inconvenience, not a functional gap) and
avoids a schema change and a new `/me` endpoint this sprint doesn't otherwise need. Documented as a
deliberate v1 boundary, not an oversight.

**Localization scope this sprint is app-chrome text, not a full RTL layout mirror.** Setting the
active locale to Urdu applies `dir="rtl"` at the shell root (browser-default bidi + flex behavior
does most of the visual flip for free) and translates all chrome strings — but this sprint does not
refactor every component's CSS from physical (`left`/`margin-left`) to logical
(`inset-inline-start`/`margin-inline-start`) properties. Some fixed-layout elements may not mirror
pixel-perfectly under `dir="rtl"` chrome. This is flagged as a known, explicit follow-up polish item,
not silently absorbed into this sprint's Definition of Done (which is about **translation coverage**,
not full bidi layout fidelity).

**"First-phase translation coverage"** (both clients) means: navigation labels, the command palette,
buttons/labels on the shared components Sprint D already extracted (`Button.vue`, `ConfirmDialog.vue`,
`EntityTable.vue`'s built-in strings like "No results", `FormField.vue`'s required-indicator), and the
Login/Forgot-Password chrome. It explicitly does **not** yet cover every field label on every one of
the 8+ CRUD screens or every parent-app content string — those are a natural, larger follow-on
translation pass once the i18n plumbing exists, not part of this sprint's committed scope. This
boundary is deliberate scoping, not a silently narrowed deliverable — call it out in the closing
`PROJECT-STATUS.md`/roadmap entries exactly as stated here.

## Design

### 1. Command palette focus trap + ARIA listbox

`CommandPalette.vue`:
- Add a focus trap: on `Tab`/`Shift+Tab` at the panel's keydown handler (currently only bound to the
  `<input>` — move/duplicate the listener to the panel root or add a `document`-level listener while
  `open`), cycle focus between the input and the last focusable item instead of letting it escape to
  the page behind. Restore focus to the element that had it before the palette opened, on close
  (`emit('close')`).
- Add `role="listbox"` to the results container, `role="option"` + `aria-selected="true/false"` to
  each result `<button>` (replacing the CSS-only `.selected` class as the *sole* indicator — keep the
  class for visual styling, add the ARIA attribute alongside it), and `aria-activedescendant` on the
  `<input>` pointing at the currently-selected option's `id`.

### 2. Skip-to-content link

Add `id="main-content"` to `AppShell.vue`'s `<main class="content">` (line 382). Add a visually-hidden
skip link as the first focusable child of `.shell` (line 246) that becomes visible on focus and jumps
to `#main-content` — standard pattern, no new dependency.

### 3. Disclosure ARIA + sparkline accessible name

- `AttendanceView.vue`'s overflow trigger (lines 163-172): add `:aria-expanded="openOverflowFor ===
  student.id"` alongside its existing `aria-haspopup="true"`.
- `AppShell.vue`'s notifications bell (lines 273-286): add `aria-haspopup="true"` and
  `:aria-expanded="isNotifOpen"` alongside its existing `aria-label`.
- `TrendsSparkline.vue`: add `role="img"` and a computed `aria-label` built from `props.series`/
  `props.labels` (e.g. "Attendance trend: 92%, 88%, 90%, 95%, 91%") on the `<svg>` — a real
  description, not a placeholder string.

### 4. `lang="ur"` alongside `dir="rtl"`

Everywhere `detectDirection()`'s result is bound to `:dir`, bind a matching `:lang` computed from the
same detection (`direction === 'rtl' ? 'ur' : 'en'`). Update `DirectionalText.vue` (the shared
component, fixes every consumer at once) and the two direct call sites found
(`DiaryView.vue:131`/`156`, `CircularsView.vue:155`) if they don't route through
`DirectionalText.vue`.

### 5. Flutter `Semantics`/tooltip sweep

Add `tooltip:` (the existing project convention, per `home_shell.dart:203-216`) to the three
confirmed-missing icon buttons: `messages_tab.dart:471-475` ("Send reply"), `fees_tab.dart:126-132`
("Download receipt"), `circulars_tab.dart:119-127` ("Download attachment"). `IconButton`'s `tooltip`
already produces a `Semantics(label:)` under the hood via Flutter's own implementation — no need for
an explicit wrapping `Semantics()` widget when `tooltip:` covers it, consistent with the existing
`home_shell.dart` precedent (which also uses `tooltip:`, not explicit `Semantics()`).

### 6. a11y test harness (both clients)

- staff-console: a new shared test helper (`staff-console/src/test-utils/axe.ts`) wrapping
  `axe-core`'s `run()` against a mounted component's DOM, returning violations for a Vitest
  `expect(violations).toHaveLength(0)` assertion. Applied to `CommandPalette.vue` (post-Task-1 fix)
  and `AppShell.vue` as the first two coverage points — not a full-suite retrofit this sprint.
- parent-app: one new test file (`parent-app/test/a11y_guidelines_test.dart`) applying
  `meetsGuideline(textContrastGuideline)` and `meetsGuideline(labeledTapTargetGuideline)` to
  `HomeShell` and the three fixed screens from Design §5.

### 7. Localization — staff-console (`vue-i18n`)

- Add `vue-i18n`, register it in `main.ts` (Composition API `useI18n()` mode, matching
  `<script setup>` usage throughout this codebase), with `en.json`/`ur.json` message files under
  `staff-console/src/locales/`.
- Translate the "first-phase coverage" set defined in Decisions above: `AppShell.vue`'s nav labels,
  header, command-palette label/placeholder, notifications, theme toggle; `Button.vue`/
  `ConfirmDialog.vue`/`EntityTable.vue`/`FormField.vue`'s built-in strings; `LoginView.vue`/
  `ForgotPasswordView.vue`/`ResetPasswordView.vue`'s chrome (the latter two ship in Sprint I — if
  Sprint J ships first, translate `LoginView.vue` only and leave a follow-up note; if Sprint I has
  already landed, cover all three).
- Add a language switcher (a `<select>` next to the existing theme toggle in `AppShell.vue`),
  persisting the choice to `localStorage` (`schoolportal.locale`) and setting `<html lang>` +
  `<html dir>` (coarse RTL flip per the Decisions section) on change and on boot.

### 8. Localization — parent-app (`flutter_localizations`)

- Add `flutter_localizations` (SDK) + `intl` to `pubspec.yaml`; create `lib/l10n/app_en.arb` and
  `lib/l10n/app_ur.arb`; enable `flutter gen-l10n` (add `l10n.yaml`), wire
  `MaterialApp.localizationsDelegates`/`supportedLocales` in the app root.
- Translate the same "first-phase coverage" equivalent: bottom-nav tab labels, `HomeShell`'s app bar/
  drawer chrome, the login screen, and the More-section card labels (Appearance, Notifications from
  Sprint H, Complaints/Report Cards from Sprint I if already shipped).
- Add a language selector to `more_tab.dart` (alongside the existing Appearance dropdown), persisted
  via `shared_preferences` (already a project dependency), rebuilding `MaterialApp`'s `locale` on
  change.

### 9. Staff-console responsive/collapsible sidebar

- Add a CSS breakpoint (a project-appropriate value, e.g. `768px`) to `AppShell.vue`'s
  `<style scoped>` block: below it, `.sidenav` becomes an overlay (fixed position, off-canvas by
  default, `transform: translateX(-100%)` when collapsed) instead of a static flex child.
- Add `sidebarOpen` state (`ref(false)` below the breakpoint, always-visible above it) and a hamburger
  toggle button in the header, visible only below the breakpoint.
- Opening the overlay sidebar traps focus similarly to the command palette (Design §1) and closes on
  `Escape` or clicking the backdrop.
- No change to the sidebar's above-breakpoint (desktop) behavior — this is purely additive below the
  new breakpoint.

## Testing

- Component: `CommandPalette.spec.ts` — Tab from the last item wraps to the input (not out of the
  dialog); Escape closes and restores prior focus; `role="option"`/`aria-selected` present on items.
- Component: the new axe-core helper reports zero violations for `CommandPalette.vue` and
  `AppShell.vue` post-fix.
- Component: `AttendanceView.spec.ts`/`AppShell.spec.ts` — `aria-expanded` toggles correctly on the
  two disclosure buttons.
- Component: `TrendsSparkline.spec.ts` — `aria-label` reflects the given `series`/`labels`.
- Component: a `DirectionalText.spec.ts` case — Urdu-script input produces both `dir="rtl"` and
  `lang="ur"`; Latin-script input produces `dir="ltr"` and `lang="en"`.
- Widget: `a11y_guidelines_test.dart` passes `meetsGuideline` checks on `HomeShell` and the three
  fixed screens; a targeted widget test per fixed `IconButton` confirms its `tooltip` text.
- Component: staff-console language switcher — selecting Urdu updates `<html lang>`/`<html dir>` and
  persists to `localStorage`; reloading restores the persisted choice.
- Widget: parent-app language selector persists via `shared_preferences` and rebuilds with the new
  locale's strings.
- Component: `AppShell.spec.ts` — below the breakpoint, the sidebar starts collapsed, the hamburger
  toggle opens it, Escape/backdrop-click closes it, and it never collapses above the breakpoint
  (regression case for existing desktop behavior).

## Out of scope this sprint

- A full CSS logical-properties refactor for pixel-perfect RTL layout mirroring — chrome
  *translation* ships; full bidi layout fidelity is a documented follow-up.
- Translating every field label on every CRUD screen / every parent-app content string — "first-phase
  coverage" as scoped in Decisions above; the remaining strings are a natural larger follow-on pass.
- Server-synced locale preference (`User.locale` field / a `/me` endpoint) — client-local persistence
  only, this sprint.
- A full a11y-test retrofit of every existing component — the harness lands and covers the
  newly-fixed surfaces; broad retrofit is a follow-up once the pattern is proven.
