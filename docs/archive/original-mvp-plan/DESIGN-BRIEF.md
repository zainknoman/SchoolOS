> **ARCHIVED 2026-09-20** — Original MVP plan (SQLite-era). Superseded by the canonical docs listed in docs/README.md. Do not treat as current documentation.

# DESIGN BRIEF — SchoolOS Digital Platform

Product type:   mobile app (parent-app) + internal tool (staff-console)
Industry:       education
Demographic:    Pakistani K-12 parents (bilingual EN/Urdu, mid/low-end Android) and school staff
                (teachers, admin, accounts)
Aesthetic:      Minimalist — clean, high-contrast, no training required
Dials:          variance LOW · density COZY · motion SUBTLE
Dark mode:      no (not requested; add later if asked)
Stack:          Flutter (parent-app), Vue 3 (staff-console)

Router query (assembled): "Design a mobile app + internal admin tool for an education product
targeting Pakistani parents and school staff. Aesthetic: minimalist, low variance, cozy density, subtle
motion. Bilingual EN/Urdu with correct RTL. No dark mode for MVP."

## Scope note for this run
This run's only UI surface is the login screen + empty role-gated shell on both clients (FEAT-004,
FEAT-005) — the feature screens that would justify a full design-system-generation pass (FEAT-006
onward) aren't built yet. Applying a lightweight, accessible, high-contrast style directly rather than
routing through a full design-skill pass for two login screens; the full DESIGN-SYSTEM.md treatment
happens when Sprint 2+ starts building real feature screens.

## Working style tokens (for this run's login/shell screens only)
- Palette: white/near-white surface, deep ink text (#1B2420-ish), one accent (forest green, echoing the
  school's own branding/uniform color) for primary actions — kept intentionally simple, not a full
  system yet.
- Typography: system font stack (Roboto/system-ui on Flutter, Vue's default) — no custom font import for
  two screens.
- Both screens must render correctly with an Urdu string swapped in for any label, RTL-safe layout from
  the start (flex/logical properties, not hardcoded left/right).
