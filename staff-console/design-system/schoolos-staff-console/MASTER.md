# SchoolOS Staff Console — Design System (Master)

Generated via ui-ux-pro-max, curated by hand across three targeted queries (the combined
`--design-system` pass on "education"-flavored keywords misrouted to a kids-app pattern —
Comic Neue, playful landing-page gateway — which is wrong for an internal staff tool; the
values below come from re-querying `product`/`style`/`typography`/`color`/`ux`/`icons`
domains directly with business/admin-tool keywords instead).

## Product framing
Internal admin/staff tool (not consumer-facing). Audience: school teachers and office/admin
staff — calm, trustworthy, no training required. Closest catalog matches: **Productivity
Tool** (product domain) crossed with **Minimalism & Swiss Style** (style domain — "Enterprise
apps, dashboards, documentation sites, professional tools", WCAG AAA, Complexity: Low).

## Colors
| Token | Value | Use |
|---|---|---|
| `--color-primary` | `#0F172A` | Headings, primary text, sidebar active state |
| `--color-on-primary` | `#FFFFFF` | Text on primary-colored surfaces |
| `--color-accent` | `#0369A1` | Links, focus ring, primary button background |
| `--color-background` | `#F8FAFC` | Page background |
| `--color-surface` | `#FFFFFF` | Cards, topbar, sidebar, form panels |
| `--color-text` | `#1E293B` | Body text (softer than pure `--color-primary`) |
| `--color-muted` | `#64748B` | Secondary/help text |
| `--color-muted-bg` | `#E8ECF1` | Hover backgrounds, subtle fills |
| `--color-border` | `#E2E8F0` | Dividers, input borders |
| `--color-destructive` | `#DC2626` | Error text, destructive actions |
| `--color-ring` | `#0369A1` | Focus outline (matches accent, not primary — reads more clearly as "focus") |

Source: "Professional navy + blue CTA" palette (color domain, enterprise/b2b query). Avoid:
playful palettes, AI purple/pink gradients, dark mode (not requested for MVP).

## Typography
**Plus Jakarta Sans** — single family, weights 400/600/700/800.
Catalog notes: "enterprise, saas, b2b, professional, modern, approachable, legible... admin
dashboards, enterprise onboarding."
```
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,600;0,700;0,800;1,400&display=swap');
```
Scale: `--font-size-xs:0.8rem --font-size-sm:0.875rem --font-size-base:1rem --font-size-lg:1.15rem
--font-size-xl:1.5rem --font-size-2xl:1.9rem`. Line-height 1.5 body, 1.2 headings.

## Spacing & layout
Density dial: standard (mid, not dense — this is a small staff tool, not a data-dense BI
dashboard). Base unit 8px: `--space-1:0.5rem --space-2:0.75rem --space-3:1rem --space-4:1.5rem
--space-5:2rem --space-6:3rem`.
Structural: `--sidebar-width:240px --topbar-height:60px --radius:8px --radius-sm:6px`.
Breakpoints: 375 / 768 / 1024 / 1440.

## Motion
Motion dial: subtle (3/10). Transitions 150–250ms, `ease-out`. No decorative animation —
motion only for state changes (hover, focus, loading, route transition fade). Respect
`prefers-reduced-motion: reduce` everywhere.

## Icons
Outline-style SVG (Phosphor "regular" weight visual language), 20px, `currentColor` stroke.
No emoji anywhere. Per-nav-item icons (inlined as a small local Icon component, no new
dependency since this project doesn't have an icon package yet):
`home, calendar (attendance), notebook (diary), clock (timetable), chat (messages),
users (students), user-circle (parents), chalkboard (teachers), grid (classes),
megaphone (circulars), receipt (fees), logout`.

## Anti-patterns (avoid)
- Oversized/"exaggerated minimalism" display type — this is a work tool, not a landing page.
- Playful/rounded mascot-style type (Comic Neue/Baloo) — wrong register entirely for staff.
- Emoji as icons.
- Dark-mode-only or purple/pink AI gradients.
- Fixed `max-width` centering the whole app shell (the bug that prompted this pass) — the
  shell fills the viewport; only reading-width content (forms, text blocks) gets a max-width.

## Accessibility checklist
- [ ] Text contrast ≥ 4.5:1 (verified: `#1E293B` on `#FFFFFF`/`#F8FAFC` ≈ 12:1; `#0369A1` on
      white ≈ 5.9:1)
- [ ] Visible focus ring on every interactive element (`--color-ring`, never removed)
- [ ] Labels associated with every input (already true — `<label>` wraps each field)
- [ ] Keyboard nav: tab order matches visual order, no traps
- [ ] `prefers-reduced-motion` respected
- [ ] Nav items conditionally rendered (not CSS-hidden) per role — already true (AppShell)

## Component guidance
- **Topbar**: 60px, surface background, bottom border, brand left, logout button right.
- **Sidebar**: 240px, surface background, right border, icon+label rows, active/hover state
  uses `--color-muted-bg`, 8px radius.
- **Content**: background `--color-background`, generous padding (`--space-5`/`--space-6`),
  no fixed max-width on the shell itself — only prose/forms cap at ~640px for readability.
- **Forms** (login): card on `--color-surface`, labeled inputs, inline error via `role="alert"`,
  submit button shows a loading state, never just disables silently.
- **Buttons**: primary = accent background + white text; radius `--radius`; hover darkens
  ~8%; disabled = 60% opacity, `cursor:not-allowed`.

## 2026-09-17 addendum

This doc hadn't been updated since the Sprint 2 baseline above; a lot has shipped since. Folding
it in now rather than letting doc/code drift continue.

**Dark mode** (shipped, not reflected above): a complete second token set, applied either by OS
`prefers-color-scheme: dark` or an explicit toggle (`data-theme` attribute on `<html>`, persisted).
Every color token gets a dark-mode value in `base.css` — never assume the light-mode hex above is
the only value a token resolves to.

**Status tint tokens** (shipped, not listed above): `--color-status-{success,warning,critical,
info,neutral}` + `-tint` variants, deliberately separate from `--color-accent` — used only by
`StatusPill.vue` and anywhere a status (not a brand action) needs color-coding. Each has a
dark-mode value.

**Typography addition**: `IBM Plex Mono` (`--font-family-mono`) for tabular/numeric data (`.tabular`
utility class) — not in the original single-family spec above.

**Shell additions**: breadcrumb-style page title, a command palette (`Ctrl/Cmd+K`, indexes routes +
4 deep-linked actions), two-tier notification badges (numeric for actionable / dot for ambient), a
responsive off-canvas sidebar below 768px (hamburger toggle, backdrop, `Escape` + Tab-cycle
containment), and a role-frequency-ordered nav (Overview → People → Operations → Communication →
Org Structure; Operations leads with Admissions/Hiring/Bulk Import — see `AppShell.vue`).

**Component library** (shipped, not in the original single-file-per-screen assumption above):
`components/` now has `EntityTable`, `Button`, `FormField`, `AppModal`, `AppTabs`, `StatusPill`,
`ConfirmDialog`, `AppIcon`, `TrendsSparkline` — each with its own spec. Native `window.confirm()`
is fully eliminated app-wide and enforced by a standing regression test
(`src/noWindowConfirm.spec.ts`); `ConfirmDialog.vue` is the only destructive-action confirm path.

**Token hardening (2026-09-17, UI Sprint 1)**:
- `--shadow-sm/-md/-lg`: hue-tinted (never pure black) via a `--shadow-color` RGB-triple token that
  itself changes per theme, so every shadow using them re-tints in dark mode automatically instead
  of reading as a flat seam.
- `--radius-full` (9999px) replaces the hand-rolled `999px` pill radius.
- `--space-0` (0.15rem) / `--space-0-5` (0.3rem): the sub-`--space-1` micro-gaps that recur across
  the shell (badge padding, nav-group spacing) now have names instead of being scattered literals.
- `--font-size-2xs` (0.68rem): the smallest recurring label size (nav-group labels, notif badge)
  unified under one token.
- `--color-ring-glow`: the login input's focus-ring glow is now theme-aware (previously hardcoded
  to the light-mode accent color and unreadable against the dark surface).
- `--duration-fast/-base/-slow` + `--ease-standard`/`--ease-spring`: a named motion-token layer.
  `--transition-fast`/`--transition-base` (already used app-wide) are now built from these rather
  than being their own literals, so every existing `var(--transition-fast)` call site picked up the
  new `--ease-standard` curve (`cubic-bezier(0.16, 1, 0.3, 1)`, matching the design-taste baseline's
  MOTION 4–7 guidance) with no call-site changes required. `--ease-spring` is reserved for the
  upcoming toast/skeleton/staggered-reveal work (UI Sprints 3–4).
