# UI Revamp — Design System Extension (Spec)

Source references analyzed (local screenshots, since Dribbble is JS/image-only and unreachable via
the fetch tools available this session): `docs/UI-Screenshots/message-chat.png` ("Scholarly" —
messaging/schedule), `sample1/*.png` (a studio/gym management console — bold roster + live-attendance
status-pill patterns), `sample2/*.png` ("EduNova AI ERP" — student + admin dashboards, the closest
visual cousin to this product). The five Dribbble URLs given in chat (Omoskillo Student profile,
College Student Profile, School app #7084100, School Management App Design #27577221, TapIn
Attendance) could not be rendered — this spec extrapolates from their titles/genre plus the reference
screenshots plus this repo's own existing, already-deliberate design system (`staff-console/design-
system/schoolos-staff-console/MASTER.md`, `parent-app/lib/src/theme/app_theme.dart`).

## Judgment call: two different registers, on purpose

`staff-console/design-system/.../MASTER.md` already documents a considered choice: "Minimalism &
Swiss Style... Productivity Tool... audience: teachers and office/admin staff — calm, trustworthy, no
training required," with explicit anti-patterns against "exaggerated minimalism display type" and
playful/mascot styling. `StudentProfileView.vue`/`StaffProfileView.vue` are ~1,000-line data-entry
forms with dozens of `data-testid` hooks under test — not a portfolio page.

Cloning a consumer Dribbble profile card (huge avatar hero, colorful stat rings, playful icon set)
onto that surface would contradict the system's own stated audience and put ~40 tests at risk for a
purely cosmetic goal. Instead:

- **staff-console** (Teacher/Admin/Accounts/Principal, web): keep the Swiss/minimal register. Add
  *one* new pattern — a compact profile-header band at the top of `StudentProfileView`/
  `StaffProfileView` (avatar + name + a handful of key facts as inline stats) — because that specific
  idea (a proper header instead of jumping straight into a `dl` grid) is a genuine, non-generic
  improvement over the current "h1 + definition list" layout, done in the existing token language.
  The rest of the page (every section below the header) is untouched structurally.
- **parent-app** (parents, Flutter mobile): this is the one the user explicitly asked to reskin
  ("For flutter mobile app update css like this"), and it's genuinely under-designed today (default
  `CircleAvatar`, default Material icons, generic `Card` + `ListTile` everywhere). This is where the
  fuller "premium school app" mobile visual language goes.

## Color

Keep the existing brand base — navy `#0F172A` / accent blue `#0369A1` is already a considered,
non-generic choice (explicitly *not* purple-blue AI gradient, not cream/terracotta). Extend, don't
replace:

| Token | Value | Use | Client |
|---|---|---|---|
| `--color-primary` / `AppColors.primary` | `#0F172A` | existing — headings, profile-header background | both |
| `--color-accent` / `AppColors.accent` | `#0369A1` | existing — links, primary actions | both |
| `accentWarm` (new, parent-app only) | `#EA7317` | one warm accent for the parent-app's quick-action icon chips (fees, events) — the single "bold" hit per screen, never paired with a second saturated color | parent-app |
| `--color-status-*` | existing (`success #15803D`, `warning #B45309`, `critical #DC2626`, `info #0369A1`) | attendance/fee/status chips — already exist, just apply them to more surfaces (parent-app stat cards currently render everything in the same neutral ink) | both |
| Subject/quick-action tint set (new, parent-app only) | 4 low-saturation tints derived from existing tokens: attendance → status-success tint, fees → accentWarm tint, timetable → accent tint, messages → primary tint | icon-chip backgrounds on Home | parent-app |

No new dark-mode work needed — both clients already have a complete dark palette; new components must
read both `AppColors`/`AppColorsDark` (Flutter) or `:root`/`[data-theme='dark']` (Vue), never a
hardcoded hex.

## Typography

No new typeface. Plus Jakarta Sans stays the single family on both clients — it was a deliberate,
already-distinctive choice (not Inter/system default); introducing a second display face now would be
change for its own sake. One addition: parent-app adopts the **same tabular-numeral treatment**
staff-console already uses (`--font-family-mono` / `.tabular` for `IBM Plex Mono` on numeric data) for
its stat numbers (attendance %, fee amounts, GPA-style figures) — a small but real cross-client
consistency win, and it reads as more "data-considered" than proportional digits jumping around as
they update.

Scale (parent-app, currently undifferentiated Material defaults): introduce explicit `displaySmall`
(profile-header name, 22/700), `titleMedium` (section headers, 16/700 — already close to current),
`bodyMedium` (14/500 default body), `labelSmall` (11/600, uppercase-free — chip labels) in
`buildAppTheme`/`buildDarkAppTheme`'s `textTheme`, replacing the bare `GoogleFonts.plusJakartaSansTextTheme()`
passthrough so weight/size choices are explicit rather than inherited Material defaults.

## Layout

### Parent-app profile header (new component, `lib/src/widgets/profile_header.dart`)

```
┌──────────────────────────────────────┐
│  ░░░░ navy panel, rounded-bottom ░░░░ │   <- AppColors.primary, borderRadius
│   (●)  Ayesha Khan                    │      only on bottom-left/-right (24px)
│        Grade 5 · Section A            │      one deliberate curve, not a card
│  ┌────────┬────────┬────────┐         │
│  │ 96%    │ PKR 0  │  #3    │         │   <- tabular-numeral stat strip,
│  │Attend. │ Fees   │ Rank*  │         │      translucent white chips on navy
│  └────────┴────────┴────────┘         │      (*only where the data exists —
└──────────────────────────────────────┘       no fabricated numbers)
```

Used, in a compact single-row variant (avatar + name + class, no stat strip), at the top of
`HomeTab` in place of the current plain `Card(CircleAvatar + Column)`. This is the one "bold" element
per the Chanel restraint principle — everything below it (stat grid, announcements) stays on the
existing light `background`/`surface` cards, just retoned per the token updates below. It directly
answers the "student profile" brief without becoming a second, competing hero.

### Parent-app stat/quick-action cards (`HomeTab._StatCard`, existing)

Same grid, same `mainAxisExtent`, same `Key`s (tests untouched). Visual change only: each card gets a
leading icon inside a tinted rounded-square chip (36×36, `borderRadius: 10`, tint = the subject-tint
set above) instead of no icon at all; the value uses the new tabular numeral style.

### staff-console profile header (`StudentProfileView.vue` / `StaffProfileView.vue`)

```
┌───────────────────────────────────────────────────┐
│  (●)  Eshaal Sample                    [ Edit ]     │  <- existing h1 + Edit button,
│       GR-1001 · Grade 3 · Section 3A · ACTIVE        │     now inside a bordered
└───────────────────────────────────────────────────┘     --color-surface panel with
                                                            avatar, replacing the bare <h1>
[ existing "Profile" dl-grid section, unchanged ]
[ existing "Current Enrollment" section, unchanged ]
[ ...every other existing section, unchanged ]
```

One new header block per view, built from data the view already loads (`profile.name`, `grNumber`,
`status`, `enrollments[0]`/employment fields) — no new API calls. Uses existing tokens only
(`--color-surface`, `--radius`, `--space-*`, `--color-muted`) — no new colors introduced on this
client. `StatusPill` (existing component) renders the ACTIVE/status badge instead of plain text,
since that component already exists for exactly this purpose elsewhere in the app.

## Principles

1. **One hero per surface.** The parent-app profile-header is the one bold move; list/detail screens
   stay quiet. The staff-console header is a quiet win too (structure, not spectacle) — matching its
   own system's restraint.
2. **No fabricated data.** Any stat not currently available from a loaded endpoint (e.g., class rank)
   is omitted, not invented — matching this repo's existing, explicit "don't fabricate verification/
   numbers" standard (see `PROJECT-STATUS.md`).
3. **Tokens, not literals.** Every new color/radius/spacing value is added to `app_theme.dart` /
   `base.css` as a named token, never inlined in a widget/component — both files already establish
   this discipline.
4. **Zero `data-testid`/`Key` churn.** Existing tests are the acceptance criteria for "didn't break
   anything." Visual-only changes (color, radius, added icon, added header block) never rename or
   remove an existing test hook.
5. **Same brand, two registers.** staff-console stays calm/internal-tool; parent-app becomes more
   visually confident — both still unmistakably the same navy/blue SchoolOS product, never diverging
   into two unrelated visual languages.
