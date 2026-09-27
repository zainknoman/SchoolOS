# Staff Console Accessibility Audit (WCAG 2.1 AA)

> **Status:** CURRENT · **Audited:** 2026-09-27 against `wave-0/foundations` (BL-55) · **Scope:** staff console (`staff-console/`) only; the parent app follows Android accessibility guidelines and is out of scope (NFR-A11Y-02) · **Sources:** `staff-console/src/a11y/`, `staff-console/src/test-setup.ts`, `staff-console/src/assets/base.css` · **Owner:** Engineering Lead (Technical Owner)

Target: **WCAG 2.1 AA** (Q43, NFR-A11Y-02). This report records what the automated checks cover, what the manual keyboard pass found and fixed, and what still needs a human screen-reader pass.

## 1. Result

| Area | Result |
|---|---|
| Automated axe checks in CI (every component/view spec) | ✅ 0 violations, blocking |
| Design-token colour contrast, light + dark | ✅ 46 pairs pass, blocking |
| Real-browser axe with colour contrast, 29 screens × 2 themes | ✅ 0 violations |
| Manual keyboard pass | ✅ after fixes (§4) |
| Screen-reader pass (NVDA / VoiceOver) | ⏳ **not done**: needs a person with a screen reader (§5) |

Conformance can be claimed only after the screen-reader pass in §5 is signed off. Until then the console is **AA on automated and keyboard criteria, screen-reader behaviour unverified**.

## 2. Automated checks (run on every CI build)

- **axe on every spec.** `src/test-setup.ts` records each wrapper a test mounts. After the test, it re-renders the wrapper's final state (data loaded, forms and modals open) into the document and runs axe-core with the `wcag2a`, `wcag2aa`, `wcag21a` and `wcag21aa` tags (`src/a11y/axe.ts`). Any violation fails the test. This covers all 82 spec files and about 580 UI states. It is part of `npm test`, which the `staff-console` CI job already runs.
- **Rules that jsdom cannot evaluate** are turned off in that hook: `color-contrast`, which needs real rendering and is covered by the next two checks, and `region`, which flags any fragment mounted outside the AppShell landmarks.
- **Token contrast.** `src/a11y/tokenContrast.spec.ts` parses `base.css` and checks every foreground/background token pair the console uses, in light and dark: 4.5:1 for text (1.4.3) and 3:1 for control borders and focus rings (1.4.11).
- **Gate self-test.** `src/a11y/axe.spec.ts` fails if the runner stops detecting a known violation, so the gate cannot go blind without anyone noticing.
- Report mode: `A11Y_REPORT=<file> npx vitest run` writes findings to a JSONL file instead of failing, which is useful for triage.
- Cost: about +100 s of test time for the console suite.

## 3. Findings fixed

| # | WCAG | Finding | Fix |
|---|---|---|---|
| A1 | 4.1.2 | Command palette: combobox had no `aria-controls` or name; listbox had no name and owned non-option children (group headings, empty state) | Combobox gets `aria-controls`, `aria-autocomplete` and a name; listbox gets a name; items are grouped under `role="group"` with labelled headings; the empty state moves outside the listbox as `role="status"` |
| A2 | 4.1.2 | Profile photo button (student/staff profile) had no name when a photo was shown (`alt=""` image) | `aria-label` = the photo action label |
| A3 | 1.3.1 / 4.1.2 | Unlabelled controls: Timetable add/edit/bulk grid (day, period, times, subject, teacher, room), Marks entry per-student inputs, Section edit row, Teacher complaints status select, Messages search and reply | `aria-label` naming each control, including row context (for example "Monday period 3 subject", "Marks for <student>") |
| A4 | 1.3.1 / 4.1.2 | EntityTable inline-edit cells in 10 views (Sessions, Assessment categories, Classes, Holidays, Parents, Staff, Students, Subjects, Terms) had unlabelled inputs | `aria-label` = the column heading; parent row password field labelled |
| A5 | 1.4.3 | Status pills below 4.5:1 in light theme: success 4.43, warning 4.45, critical 4.10, neutral 4.01; muted text on muted chips 4.01 | `--color-status-success-tint` `#e4f5ea`→`#ecf8f0`, `--color-status-warning-tint` `#fbf0de`→`#fcf4e6`, `--color-destructive` `#dc2626`→`#c81e1e`, `--color-muted` `#64748b`→`#5b6b80` (same hues) |
| A6 | 1.4.11 | Input/select/textarea borders used `--color-border` (`#e2e8f0`, 1.2:1 on white) | New token `--color-control-border` (light `#8391a5` 3.2:1, dark `#566991` 3.2:1) on every control outline; `--color-border` stays for decorative dividers |
| A7 | 2.4.3 | **AppModal had no focus management**: focus stayed on the trigger behind the dialog, Tab could leave it, and closing dropped focus to `<body>` | Focus moves to the first field when the dialog opens, Tab and Shift+Tab cycle inside it, and focus returns to the trigger when it closes (covered by a unit test) |
| A8 | 2.4.7 | Login inputs replaced the focus outline with a 15%-alpha glow; Messages search input had `outline: none` | Login keeps the global `:focus-visible` outline; the Messages search wrapper shows a `:focus-within` outline |
| A9 | 2.4.3 | ConfirmDialog set initial focus and returned it, but Tab could leave the dialog | Tab and Shift+Tab cycle between Cancel and Confirm (unit test) |

`DESIGN.md` and `design-system/schoolos-staff-console/MASTER.md` carry the new token values.

## 4. Manual keyboard pass (2026-09-27)

This was run in Chromium (Playwright) against a scratch database seeded with the demo data, as SCHOOL_ADMIN (`admin@dsn…`) and TEACHER (`dsn.c1.g1a@…`). The same run also used axe with colour contrast on: 21 admin screens and 8 teacher screens, each in light and dark, all with 0 violations.

| Check | Result |
|---|---|
| First Tab reaches "Skip to content", which becomes visible and moves focus to `<main>` | ✅ |
| Topbar → sidebar → content order is logical; every stop shows a focus outline | ✅ |
| Ctrl+K opens the palette with focus in the input; arrows move `aria-activedescendant`; Esc closes it and focus returns | ✅ |
| Add/edit modals (Holidays, Subjects): focus starts on the first field, Tab stays trapped, Esc closes and focus returns to "+ Add New" | ✅ after A7 |
| ConfirmDialog: focus on Cancel, Esc, focus return (existing unit tests); Tab trap | ✅ after A9 |
| Mobile sidebar (below the breakpoint): Esc closes it, Tab is trapped, focus returns | ✅ by code review (`AppShell.vue` `onSidebarKeydown`); no unit test and not exercised in the browser pass |
| 390 px width: no horizontal page scroll (Students) | ✅ |
| Reduced motion: animations and transitions collapse under `prefers-reduced-motion` | ✅ (`base.css`) |

Not a finding: the dev-only Vue DevTools overlay button (`.panel-entry-btn`) raises `aria-prohibited-attr`. It is not in production builds.

## 5. Open: screen-reader pass (needs a person)

Automated tools check names, roles and states, but not how a screen reader actually announces them. Before claiming AA, someone should do this with **NVDA + Firefox or Chrome** (Windows) and, if available, **VoiceOver + Safari** (macOS), then record the result here.

- [ ] Login, forgot password, reset password: fields announced with their labels; errors announced (`role="alert"`)
- [ ] Shell: landmarks (banner, navigation, main) listed; breadcrumb announced; current page in the sidebar announced
- [ ] Command palette: announced as a combobox; the active option is read while arrowing
- [ ] Add/edit modal: dialog name read on open; Esc returns to the trigger
- [ ] EntityTable: headers read with cells; sort and paging controls named; inline edit fields read with their column name
- [ ] Attendance marking and marks entry: every row's control announces the student name
- [ ] Toasts and save confirmations announced (live region)
- [ ] Urdu locale: `lang`/`dir` switch read correctly; the RTL layout keeps a logical reading order

Tester: `[A11Y_TESTER]` · Date: `[DATE]` · Result: `[PASS / FINDINGS]`

## 6. Follow-ups (not blocking)

- The parent app (`parent-app/lib/src/theme/app_theme.dart`) still uses the old `muted` `#64748B` and `destructive` `#DC2626`. Mobile contrast is part of the BL-54 device pass. Align the tokens there if the same pairs fail.
- The empty-API mount sweep was tried and dropped: most views render only a loading or empty state without data, so the per-spec hook gives far better coverage.
