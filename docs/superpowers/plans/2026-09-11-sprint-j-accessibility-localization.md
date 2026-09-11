# Sprint J — Accessibility & Localization Scope Decision + Build-Out (Phase 6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the accessibility gaps that are missing rather than deliberately deferred (focus trap,
ARIA, `Semantics`), and build out a full localization + responsive-shell story on **both clients** —
scope decisions the user made explicitly (both clients localized; a real collapsible sidebar, not a
documented desktop-only call), which push this sprint meaningfully past the roadmap's original 3-week
estimate. Re-estimate duration once Tasks 1-6 (accessibility) are scoped against the team's actual
velocity — Tasks 7-9 (localization ×2 clients + responsive shell) are the larger, newly-added scope.

**Architecture:** Six independent accessibility fixes (no shared infrastructure beyond the new
axe-core test helper), followed by two parallel greenfield i18n installs (`vue-i18n` on
staff-console, `flutter_localizations`/`.arb` on parent-app) and one CSS/state addition
(collapsible sidebar) to `AppShell.vue`. Nothing here touches the backend.

**Tech Stack:** `vue-i18n` (new), `axe-core` (new, dev-only), `flutter_localizations` + `intl` (new,
parent-app), Flutter SDK's built-in `flutter_test` guideline matchers (no new Flutter dependency).

**Spec:** `docs/superpowers/specs/2026-09-11-sprint-j-accessibility-localization-design.md`

## Global Constraints

- **Locale preference is client-local only** (`localStorage` on staff-console, `shared_preferences`
  on parent-app) — no backend schema change, no `/me` endpoint this sprint.
- **"First-phase translation coverage" is chrome only** — nav/buttons/shared-component strings, not
  every field label on every CRUD screen. See spec Decisions for the exact boundary.
- **RTL is a coarse `dir="rtl"` flip on the shell root, not a logical-properties CSS refactor.** Some
  fixed-layout elements may not mirror perfectly — a documented follow-up, not a blocker for this
  sprint's Definition of Done.
- **Do not add `jest-axe`/`vitest-axe` as a dependency** — use `axe-core` directly (staff-console) and
  Flutter's already-bundled `flutter_test` guideline matchers (parent-app). No new Flutter test
  dependency is needed.
- The responsive sidebar's breakpoint change must not alter existing desktop (above-breakpoint)
  behavior — every existing `AppShell.spec.ts` case must still pass unmodified above the breakpoint.

---

## File Structure

- `staff-console/src/components/CommandPalette.vue` (modify) — focus trap, `role="listbox"`/
  `role="option"`/`aria-selected`/`aria-activedescendant`.
- `staff-console/src/components/AppShell.vue` (modify) — skip link target, notifications
  `aria-expanded`/`aria-haspopup`, language switcher, hamburger + collapsible sidebar.
- `staff-console/src/views/AttendanceView.vue` (modify) — `aria-expanded` on overflow trigger.
- `staff-console/src/components/TrendsSparkline.vue` (modify) — `role="img"` + `aria-label`.
- `staff-console/src/components/DirectionalText.vue` (modify) — `:lang` alongside `:dir`.
- `staff-console/src/views/DiaryView.vue`, `CircularsView.vue` (modify, if not routed through
  `DirectionalText.vue`) — same `:lang` fix.
- `staff-console/src/test-utils/axe.ts` (new).
- `staff-console/package.json` (modify) — add `vue-i18n`, `axe-core` (dev).
- `staff-console/src/locales/en.json`, `ur.json` (new).
- `staff-console/src/main.ts` (modify) — register `vue-i18n`.
- `parent-app/lib/src/screens/messages_tab.dart`, `fees_tab.dart`, `circulars_tab.dart` (modify) —
  `tooltip:` on the three icon buttons.
- `parent-app/test/a11y_guidelines_test.dart` (new).
- `parent-app/pubspec.yaml` (modify) — add `flutter_localizations`, `intl`; add `l10n.yaml`.
- `parent-app/lib/l10n/app_en.arb`, `app_ur.arb` (new).
- `parent-app/lib/src/screens/more_tab.dart` (modify) — language selector.
- Test files: one spec/widget-test file per modified component, following each area's existing
  co-location convention.

---

### Task 1: Command palette focus trap + ARIA listbox

**Files:**
- Modify: `staff-console/src/components/CommandPalette.vue`
- Test: `CommandPalette.spec.ts` (extend)

- [ ] **Step 1:** Write failing tests: `Tab` on the last visible result wraps focus back to the
  `<input>` (not out of the panel); `Shift+Tab` on the input wraps to the last result; `Escape`
  restores focus to whatever element had it before the palette opened; each result has
  `role="option"` and `aria-selected` reflecting the current `selectedIndex`; the results container
  has `role="listbox"`; the input has `aria-activedescendant` pointing at the selected option's `id`.
- [ ] **Step 2:** Implement the focus trap (a `Tab`/`Shift+Tab` handler at the panel level cycling
  between the input and the last focusable result) and focus restoration (capture
  `document.activeElement` on open, `.focus()` it on close). Implement the ARIA attributes.
- [ ] **Step 3:** Run `CommandPalette.spec.ts`, confirm pass. Run `npm run type-check`, `lint`.
- [ ] **Step 4: Commit**
  ```bash
  git add staff-console/src/components/CommandPalette.vue staff-console/src/components/CommandPalette.spec.ts
  git commit -m "fix(staff-console): trap focus and add ARIA listbox semantics to CommandPalette"
  ```

---

### Task 2: Skip-to-content link

**Files:**
- Modify: `staff-console/src/components/AppShell.vue`
- Test: `AppShell.spec.ts` (extend)

- [ ] **Step 1:** Write a failing test: a visually-hidden skip link is the first focusable element
  inside `.shell`, becomes visible on focus, and its `href` targets `#main-content`.
- [ ] **Step 2:** Add `id="main-content"` to `<main class="content">` and the skip-link element +
  its visually-hidden-until-focused CSS.
- [ ] **Step 3:** Run the test, confirm pass. Run `type-check`, `lint`.
- [ ] **Step 4: Commit**
  ```bash
  git add staff-console/src/components/AppShell.vue staff-console/src/components/AppShell.spec.ts
  git commit -m "feat(staff-console): add skip-to-content link"
  ```

---

### Task 3: Disclosure ARIA + `TrendsSparkline` accessible name

**Files:**
- Modify: `staff-console/src/views/AttendanceView.vue`, `staff-console/src/components/AppShell.vue`,
  `staff-console/src/components/TrendsSparkline.vue`
- Test: `AttendanceView.spec.ts`, `AppShell.spec.ts`, `TrendsSparkline.spec.ts` (all extend)

- [ ] **Step 1:** Write failing tests: `AttendanceView`'s overflow trigger's `aria-expanded` toggles
  with `openOverflowFor`; `AppShell`'s notifications bell gains `aria-haspopup="true"` and
  `aria-expanded` toggling with `isNotifOpen`; `TrendsSparkline`'s root `<svg>` has `role="img"` and
  an `aria-label` matching a given `series`/`labels` fixture.
- [ ] **Step 2:** Implement all three. For `TrendsSparkline`, build the `aria-label` as a computed
  property joining each series' label and its values into one readable sentence.
- [ ] **Step 3:** Run all three spec files, confirm pass. Run `type-check`, `lint`.
- [ ] **Step 4: Commit**
  ```bash
  git add staff-console/src/views/AttendanceView.vue staff-console/src/components/AppShell.vue staff-console/src/components/TrendsSparkline.vue staff-console/src/views/AttendanceView.spec.ts staff-console/src/components/AppShell.spec.ts staff-console/src/components/TrendsSparkline.spec.ts
  git commit -m "fix(staff-console): add missing aria-expanded/aria-haspopup and a TrendsSparkline accessible name"
  ```

---

### Task 4: `lang="ur"` alongside `dir="rtl"`

**Files:**
- Modify: `staff-console/src/components/DirectionalText.vue`, and `DiaryView.vue`/
  `CircularsView.vue` if either binds `:dir` outside `DirectionalText.vue`
- Test: `DirectionalText.spec.ts` (extend)

- [ ] **Step 1:** Grep `staff-console/src` for every `:dir="detectDirection(` call site to confirm
  the full list (the spec names `DirectionalText.vue`, `DiaryView.vue:131`, `DiaryView.vue:156`,
  `CircularsView.vue:155` — confirm no others exist).
- [ ] **Step 2:** Write a failing test: Urdu-script input to `detectDirection` produces both
  `dir="rtl"` and `lang="ur"` on the rendered element; Latin-script input produces `dir="ltr"` and
  `lang="en"`.
- [ ] **Step 3:** Add a matching `:lang` binding at every confirmed call site
  (`direction === 'rtl' ? 'ur' : 'en'`).
- [ ] **Step 4:** Run the test, confirm pass. Run `type-check`, `lint`.
- [ ] **Step 5: Commit**
  ```bash
  git add staff-console/src/components/DirectionalText.vue staff-console/src/components/DirectionalText.spec.ts
  git commit -m "fix(staff-console): pair lang=ur with dir=rtl on directional content"
  ```

---

### Task 5: Flutter `Semantics`/tooltip sweep + a11y guideline test

**Files:**
- Modify: `parent-app/lib/src/screens/messages_tab.dart`, `fees_tab.dart`, `circulars_tab.dart`
- New: `parent-app/test/a11y_guidelines_test.dart`

- [ ] **Step 1:** Write a failing widget test per fixed button: `find.byTooltip('Send reply')` (or
  equivalent) resolves to the send-reply `IconButton`; same for "Download receipt" and "Download
  attachment" (confirm the exact tooltip text choice against the existing `home_shell.dart`
  convention's phrasing style).
- [ ] **Step 2:** Add `tooltip:` to all three `IconButton`s. Run the three tests, confirm pass.
- [ ] **Step 3:** Write `a11y_guidelines_test.dart` using `flutter_test`'s built-in
  `meetsGuideline(textContrastGuideline)` and `meetsGuideline(labeledTapTargetGuideline)` against
  `HomeShell` and the three fixed screens.
- [ ] **Step 4:** Run `a11y_guidelines_test.dart`; fix any guideline violation it surfaces (tap-target
  sizing, contrast) as part of this task, not deferred. Run `flutter analyze` and the full
  `flutter test` suite to confirm no regression.
- [ ] **Step 5: Commit**
  ```bash
  git add parent-app/lib/src/screens/messages_tab.dart parent-app/lib/src/screens/fees_tab.dart parent-app/lib/src/screens/circulars_tab.dart parent-app/test/a11y_guidelines_test.dart
  git commit -m "fix(parent-app): add tooltips to icon-only buttons, add a11y guideline test coverage"
  ```

---

### Task 6: axe-core test helper for staff-console

**Files:**
- New: `staff-console/src/test-utils/axe.ts`
- Modify: `staff-console/package.json` (add `axe-core` as a dev dependency)
- Test: `CommandPalette.spec.ts`, `AppShell.spec.ts` (extend with an axe assertion each)

- [ ] **Step 1:** Add `axe-core` as a dev dependency.
- [ ] **Step 2:** Write `test-utils/axe.ts`: a function `getViolations(container: HTMLElement):
  Promise<Result[]>` wrapping `axe.run(container)`.
- [ ] **Step 3:** Write a failing test in `CommandPalette.spec.ts` and `AppShell.spec.ts`: mount the
  component, call `getViolations`, assert an empty array.
- [ ] **Step 4:** Run both tests. If either surfaces a real violation beyond what Tasks 1-3 already
  fixed, fix it now rather than suppressing the assertion. Confirm both pass. Run `type-check`,
  `lint`.
- [ ] **Step 5: Commit**
  ```bash
  git add staff-console/package.json staff-console/src/test-utils/axe.ts staff-console/src/components/CommandPalette.spec.ts staff-console/src/components/AppShell.spec.ts
  git commit -m "test(staff-console): add an axe-core zero-violations check for CommandPalette and AppShell"
  ```

---

### Task 7: Staff-console localization (`vue-i18n`)

**Files:**
- New: `staff-console/src/locales/en.json`, `ur.json`
- Modify: `staff-console/package.json`, `staff-console/src/main.ts`,
  `staff-console/src/components/AppShell.vue`, `Button.vue`, `ConfirmDialog.vue`, `EntityTable.vue`,
  `FormField.vue`, `staff-console/src/views/LoginView.vue`
- Test: `AppShell.spec.ts`, plus one spec per modified shared component (extend each)

**Interfaces:**
- Produces: a `t(key)` translation function available via `useI18n()` in every `<script setup>`
  component; `en.json`/`ur.json` message keys consumed by the components listed above.

- [ ] **Step 1:** Add `vue-i18n` to `package.json`. Register it in `main.ts` (Composition API mode).
  Create `locales/en.json` with an initial key set for `AppShell` (nav labels, header, command
  palette label/placeholder, notifications, theme toggle) and the shared components' built-in
  strings (e.g. `EntityTable.noResults`, `FormField.required`) plus `LoginView`'s chrome.
- [ ] **Step 2:** Write a failing test per touched component: mounting with the i18n plugin installed
  and the locale set to `ur` renders the Urdu string for a representative key (e.g. the "Save" button
  label); setting locale to `en` renders the English string.
- [ ] **Step 3:** Replace each hardcoded string identified in Step 1's key set with `t('key')` calls
  across `AppShell.vue`, `Button.vue`, `ConfirmDialog.vue`, `EntityTable.vue`, `FormField.vue`,
  `LoginView.vue`. Write `locales/ur.json` with the matching Urdu translations for every key added.
- [ ] **Step 4:** Run all the tests from Step 2, confirm pass. Run the full `npm run test` suite
  (these are widely-shared components — confirm nothing else broke), `type-check`, `lint`.
- [ ] **Step 5: Commit**
  ```bash
  git add staff-console/package.json staff-console/src/main.ts staff-console/src/locales staff-console/src/components staff-console/src/views/LoginView.vue
  git commit -m "feat(staff-console): add vue-i18n and translate app-chrome to English/Urdu"
  ```

---

### Task 8: Staff-console language switcher

**Files:**
- Modify: `staff-console/src/components/AppShell.vue`
- Test: `AppShell.spec.ts` (extend)

**Interfaces:**
- Consumes: Task 7's i18n instance.

- [ ] **Step 1:** Write a failing test: selecting "اردو" (Urdu) in the new switcher sets
  `<html lang="ur">` and `<html dir="rtl">`, persists `'ur'` to `localStorage` under
  `schoolportal.locale`, and switches `useI18n().locale.value`; reloading with that key already set
  restores Urdu on boot.
- [ ] **Step 2:** Add the `<select>` switcher next to the existing theme toggle in `AppShell.vue`,
  wire it to `localStorage` read-on-mount / write-on-change, and set `document.documentElement.lang`/
  `.dir` accordingly.
- [ ] **Step 3:** Run the test, confirm pass. Run `type-check`, `lint`.
- [ ] **Step 4: Commit**
  ```bash
  git add staff-console/src/components/AppShell.vue staff-console/src/components/AppShell.spec.ts
  git commit -m "feat(staff-console): add a language switcher persisted to localStorage"
  ```

---

### Task 9: Parent-app localization (`flutter_localizations`)

**Files:**
- Modify: `parent-app/pubspec.yaml`
- New: `parent-app/l10n.yaml`, `parent-app/lib/l10n/app_en.arb`, `app_ur.arb`
- Modify: parent-app's root widget (wherever `MaterialApp` is constructed),
  `parent-app/lib/src/screens/home_shell.dart`, the login screen
- Test: widget tests for each modified screen (extend existing files)

**Interfaces:**
- Produces: generated `AppLocalizations` class (via `flutter gen-l10n`), accessed as
  `AppLocalizations.of(context)!.someKey` throughout.

- [ ] **Step 1:** Add `flutter_localizations` (SDK) and `intl` to `pubspec.yaml`. Add `l10n.yaml`
  pointing at `lib/l10n/`. Create `app_en.arb` with an initial key set covering bottom-nav tab labels,
  `HomeShell`'s app bar/drawer chrome, and the login screen. Run `flutter gen-l10n`.
- [ ] **Step 2:** Wire `MaterialApp.localizationsDelegates`
  (`AppLocalizations.localizationsDelegates`) and `supportedLocales` (`en`, `ur`) at the app root.
- [ ] **Step 3:** Write a failing widget test: pumping the app with `locale: Locale('ur')` renders the
  Urdu bottom-nav label for a representative tab; `Locale('en')` renders the English label.
- [ ] **Step 4:** Replace the hardcoded strings identified in Step 1 with `AppLocalizations.of(
  context)!.key` calls; write `app_ur.arb` with the matching Urdu translations. Run
  `flutter gen-l10n` again.
- [ ] **Step 5:** Run the widget test from Step 3, confirm pass. Run `flutter analyze` and the full
  `flutter test` suite.
- [ ] **Step 6: Commit**
  ```bash
  git add parent-app/pubspec.yaml parent-app/l10n.yaml parent-app/lib
  git commit -m "feat(parent-app): add flutter_localizations and translate app-chrome to English/Urdu"
  ```

---

### Task 10: Parent-app language selector

**Files:**
- Modify: `parent-app/lib/src/screens/more_tab.dart`, parent-app's root widget
- Test: `parent-app/test/screens/more_tab_test.dart` (extend)

**Interfaces:**
- Consumes: Task 9's `AppLocalizations`/`supportedLocales`.

- [ ] **Step 1:** Write a failing widget test: a language dropdown in `more_tab.dart` (alongside the
  existing Appearance dropdown) persists the chosen locale via `shared_preferences` and triggers the
  app root to rebuild with the new `locale`.
- [ ] **Step 2:** Add the dropdown, read the persisted locale on app start (default to the device
  locale if supported, else `en`), and thread a locale-change callback up to wherever `MaterialApp`
  is constructed (mirroring however the existing dark-mode toggle already threads its state up, per
  Sprint G's dark-theme work).
- [ ] **Step 3:** Run the test, confirm pass. Run `flutter analyze`, full `flutter test`.
- [ ] **Step 4: Commit**
  ```bash
  git add parent-app/lib/src/screens/more_tab.dart parent-app/test/screens/more_tab_test.dart
  git commit -m "feat(parent-app): add a language selector persisted via shared_preferences"
  ```

---

### Task 11: Staff-console collapsible/overlay sidebar

**Files:**
- Modify: `staff-console/src/components/AppShell.vue`
- Test: `AppShell.spec.ts` (extend)

- [ ] **Step 1:** Write failing tests: above the chosen breakpoint (e.g. mock
  `window.innerWidth = 1024`), the sidebar renders exactly as it does today (regression — no
  hamburger button visible, sidebar always shown); below it (`window.innerWidth = 480`), the sidebar
  starts collapsed (off-canvas), a hamburger toggle is visible and opens it, `Escape` and a backdrop
  click close it, and focus is trapped inside the open overlay sidebar (mirroring Task 1's trap
  pattern).
- [ ] **Step 2:** Add the breakpoint `@media` query, `sidebarOpen` ref, hamburger toggle button, and
  overlay/backdrop markup + focus trap to `AppShell.vue`. Ensure the existing above-breakpoint markup
  and behavior are unchanged (no new classes/attributes applied there).
- [ ] **Step 3:** Run the new tests and the **full existing** `AppShell.spec.ts` suite, confirm every
  prior case still passes unmodified. Run `npm run test` (full suite — `AppShell` is used everywhere),
  `type-check`, `lint`.
- [ ] **Step 4: Commit**
  ```bash
  git add staff-console/src/components/AppShell.vue staff-console/src/components/AppShell.spec.ts
  git commit -m "feat(staff-console): add a collapsible/overlay sidebar below a mobile breakpoint"
  ```

---

## Definition of Done (from the roadmap, refined by the user's scope decisions)

- Tab-only navigation cannot escape an open command palette or an open mobile sidebar overlay.
- Every icon-only button named in this plan announces its purpose to a screen reader.
- Both clients' app-chrome (per the "first-phase coverage" boundary in the spec) render correctly in
  English and Urdu, with a persisted per-device language choice on each client.
- The staff console has a real collapsible/overlay sidebar below the chosen breakpoint, with zero
  regression to its above-breakpoint behavior.
- Verify at the end: full staff-console `npm run test`/`type-check`/`lint` green (including the new
  axe-core checks); parent-app `flutter analyze` clean and full `flutter test` suite green (including
  the new a11y guideline test).
- Document explicitly, per this repo's established pattern: the exact "first-phase coverage" string
  set translated (vs. deferred), the coarse (non-logical-properties) nature of the RTL flip, and the
  client-local (not server-synced) locale persistence — in `PROJECT-STATUS.md` and the roadmap's
  Implementation Checklist.
