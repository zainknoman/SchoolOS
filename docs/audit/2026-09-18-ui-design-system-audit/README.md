# UI / Design-System Audit — 2026-09-18

Read-only audit of the existing SchoolOS application, performed per `DESIGN.md` Section 15
(Existing Application Audit — REQUIRED) before any UI revamp work starts. No source files, routes,
APIs, or business logic were modified while producing this audit.

**Companion documents:**
- [`architecture.md`](./architecture.md) — repo structure, Vue frontend architecture, Flutter
  frontend architecture, routing, auth flow, role-based navigation.
- [`design-system-inventory.md`](./design-system-inventory.md) — every existing token file,
  reusable component, state pattern (loading/empty/error), and RTL/i18n mechanism, with file paths.
- [`findings.md`](./findings.md) — inconsistencies, duplication, hard-coded values, generic
  patterns, responsive/accessibility gaps, ranked by severity.
- [`implementation-plan.md`](./implementation-plan.md) — the route-by-route migration plan
  (Sections A–H), not yet executed.

These four files are the durable record of this audit. A future session (or a future Claude Code
run) should read these instead of re-auditing the repository from scratch — re-run the audit only
if a `git log` check shows meaningful UI/design-system changes since 2026-09-18.

---

## The one finding that changes everything else: DESIGN.md conflicts with an existing, shipping design system

`build/DESIGN.md` (dated 2026-09-18, the same day as this audit) specifies a **three-surface
system** — Management (IBM-inspired, flat/blue), Academic (Linear-inspired, lavender), Parent
(Intercom-inspired, cream/charcoal) — as if no design system exists yet.

One already does, and it is not a stub:

- **`staff-console/design-system/schoolos-staff-console/MASTER.md`** — "SchoolOS Staff Console — Design
  System (Master)". A single, deliberately-chosen, documented system (navy `#0F172A` / accent blue
  `#0369A1`, Plus Jakarta Sans, Swiss/minimalist register), actively maintained through
  2026-09-17 (an "addendum" section documents dark mode, status tokens, the component library, and
  a whole token-hardening pass shipped the day before DESIGN.md was written).
- **`docs/superpowers/specs/2026-09-17-ui-revamp-design-system.md`** — a spec written one day
  before DESIGN.md that explicitly considered and **rejected** introducing a second visual
  register, calling the navy/blue palette "already a considered, non-generic choice" and stating
  the goal as extending it, not replacing it.
- **The Flutter parent-app already shares the exact same token values** as the staff console
  (`AppColors.primary = 0xFF0F172A`, `AppColors.accent = 0xFF0369A1` — see
  `parent-app/lib/src/theme/app_theme.dart`), explicitly commented "Same tokens as the staff
  console... one brand across both clients." There is currently **no** Intercom-style cream/warm
  parent identity, and no Management-vs-Academic visual split on the staff-console side either —
  Teacher and Admin/Accounts/Super Admin share one `AppShell.vue`, one nav component, one token
  set, gated only by which links render (`AppShell.vue`: "Teacher and Admin/Accounts share this
  one console, gated by role — not two deployable apps").
- Both clients also ship a **complete, tested dark mode** (`data-theme` attribute + OS
  `prefers-color-scheme`), which DESIGN.md never mentions and which the three-surface spec doesn't
  account for (each of Management/Academic/Parent would need its own dark variant, tripling the
  token surface DESIGN.md currently defines only in light mode).

This is exactly the situation DESIGN.md's own Section 15 exists to catch. Proceeding straight into
implementation against DESIGN.md as written would mean discarding a working, tested, ~90-file
component/token system and replacing the single existing brand with three unrelated ones and no
migration story for dark mode — not a "migrate the existing UI into the SchoolOS design
system" (Section 15's own stated goal), but the parallel design system Section 15 says not to
build.

**This needs a decision from the user before Section 16's Complete Revamp proceeds** — see the
"Decision required" section in [`implementation-plan.md`](./implementation-plan.md#decision-required-before-any-implementation).
The options are laid out there (reconcile DESIGN.md down to a single-surface evolution of SchoolOS;
formally supersede SchoolOS with the three-surface system and accept the reset + dark-mode cost; or
scope the three-surface split to specific new/low-risk screens only). This audit does not pick one.
