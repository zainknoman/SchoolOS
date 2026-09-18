# Architecture Audit

Scope: `D:\Zain\Projects\SchoolApp\build` (the git repo root). Read-only inspection, 2026-09-18.

## 1. Repository structure

```
build/
├── DESIGN.md                     # New three-surface design spec (2026-09-18)
├── backend/                      # API server (not deeply audited — UI-focused pass)
├── staff-console/                # Vue 3 + Vite web app — SUPER_ADMIN/SCHOOL_ADMIN/PRINCIPAL/
│                                  # ACCOUNTS/TEACHER/STUDENT surfaces, one deployable SPA
├── parent-app/                   # Flutter mobile app — PARENT role only
├── docs/                         # Design specs, plans, wireframe references, screenshots
│   ├── superpowers/plans/        # Dated implementation plans (one per feature/sprint)
│   ├── superpowers/specs/        # Dated design specs (paired with plans)
│   ├── Figma/, wireframe/, UI-Screenshots/  # Reference material, not live design tokens
│   └── database/                 # Data-model docs (backend, out of scope here)
├── PROJECT-STATUS.md             # Running log of shipped work
├── MASTER-PROMPT-TRACKER.md      # Master task tracker
└── docs/audit/                   # This audit (new)
```

There are **two frontend applications**, not three, despite DESIGN.md describing "three UX
surfaces": `staff-console` is a single Vue SPA serving both the Management and Academic user
groups (role-gated navigation inside one shell, not two separate builds/deployments), and
`parent-app` is the Flutter mobile app. See `findings.md` for why this matters.

## 2. Staff-console (Vue 3 + Vite) architecture

```
staff-console/src/
├── App.vue                # Just <RouterView /> — no global chrome here
├── main.ts                # App bootstrap (pinia, router, i18n)
├── router/index.ts         # All routes + role guard (see Section 4)
├── stores/auth.ts          # Pinia store: token pair, role, persisted session, refresh-token
│                            # single-flight guard
├── lib/
│   ├── api.ts               # Typed API client
│   ├── fetchInterceptor.ts  # Auth header / 401-refresh wiring
│   ├── i18n.ts               # vue-i18n setup, locale persistence, coarse dir-flip
│   ├── textDirection.ts      # Per-string RTL detection (Arabic/Urdu Unicode ranges)
│   ├── theme.ts               # Light/dark theme persistence + `data-theme` attribute toggle
│   ├── format.ts, useConfirm.ts, useToast.ts, useFocusTarget.ts, staff-profile.constants.ts,
│   │   student-profile.constants.ts
├── components/             # Shared component library — see design-system-inventory.md
├── views/                   # ~65 `*View.vue` (actual screen content) + ~33 `*PageView.vue`
│                            # (thin route wrappers, see Section 3)
├── assets/base.css, main.css  # All design tokens live here (see design-system-inventory.md)
└── locales/en.json, ur.json  # i18n strings
```

State management: Pinia (`stores/auth.ts` is the only store found). No Vuex, no ad-hoc global
state elsewhere.

Testing: every component and most views have a co-located `*.spec.ts` (Vitest + `@vue/test-utils`
+ `jsdom`). `noWindowConfirm.spec.ts` is a standing regression test enforcing that
`window.confirm()` is never reintroduced (the app has its own `ConfirmDialog.vue` +
`useConfirm.ts` queue). Any revamp must keep every existing `data-testid` unless deliberately
migrating a test alongside the markup change (see DESIGN.md Section 13 — preserve behavior, not
visual mistakes, but tests are the executable spec of that behavior).

## 3. The `View.vue` / `PageView.vue` pattern (not duplication — a real composition seam)

For most routed screens there are two files, e.g. `StudentManagementView.vue` +
`StudentManagementPageView.vue`. The `PageView` is a trivial wrapper:

```vue
<!-- StudentManagementPageView.vue -->
<script setup lang="ts">
import AppShell from '../components/AppShell.vue';
import StudentManagementView from './StudentManagementView.vue';
</script>
<template>
  <AppShell>
    <StudentManagementView />
  </AppShell>
</template>
```

The router (`router/index.ts`) only ever imports `*PageView.vue` components. This means **every
routed screen's chrome (topbar, sidenav, command palette, toasts, confirm dialog) is composed in
exactly one place** — `AppShell.vue`. A revamp of the app shell touches one file and one wrapper
pattern, not 33 separate integrations. This is a genuine asset to preserve, not a duplication
problem to clean up.

## 4. Routing (`router/index.ts`)

Single `vue-router` instance, `createWebHistory`. All routes are role-gated via `meta.requiresRole`
and a single `router.beforeEach` guard that:
- Redirects unauthenticated users to `/login` (except `meta.public` routes: login, forgot-password,
  reset-password).
- Redirects an authenticated user hitting `/login` to their role's home route.
- Redirects a wrong-role user hitting another role's route back to their own home route (not a
  blank/denied page).

Route tree (grouped as the router itself groups them via `meta.group`, used for breadcrumbs and
nav sectioning):

- **Public**: `/login`, `/forgot-password`, `/reset-password`
- **Teacher** (`requiresRole: ['TEACHER']`): `/teacher` (home/attendance), `/teacher/diary`,
  `/teacher/timetable`, `/teacher/messages`, `/teacher/complaints`, `/teacher/report-cards`,
  `/teacher/gradebook`
- **Admin — Overview**: `/admin` (dashboard)
- **Admin — Org Structure** (`SUPER_ADMIN` only): `/admin/schools`, `/admin/campuses`,
  `/admin/academic-sessions`, `/admin/classes`, `/admin/sections`
- **Admin — People** (`SCHOOL_ADMIN`/`SUPER_ADMIN`): `/admin/parents`, `/admin/students`,
  `/admin/students/:id`, `/admin/staff`, `/admin/staff/:id`
- **Admin — Operations** (role varies per route — see file): `/admin/hiring*`, `/admin/fees`,
  `/admin/timetable`, `/admin/leave`, `/admin/promotions`, `/admin/holidays`,
  `/admin/report-cards`, `/admin/terms`, `/admin/assessment-categories`, `/admin/admissions*`,
  `/admin/bulk-import`
- **Admin — Communication**: `/admin/circulars`, `/admin/messages`, `/admin/complaints`

Full role matrix is in the router file itself and is mirrored (with additional per-item
`computed()` gates) in `AppShell.vue`'s nav — see `findings.md` for the one already-documented and
fixed nav/route mismatch (Circulars/Timetable visibility, per the code comment at `AppShell.vue`
line ~78).

## 5. Authentication flow

- `stores/auth.ts` (Pinia): holds `accessToken`, `refreshToken`, `role`; persists to
  `localStorage` under key `schoolos.auth`; exposes `login()`/`logout()`.
- Refresh-token rotation has a **single-flight guard**: concurrent 401s from multiple in-flight
  requests share one refresh call (module-scope `Promise`, not store state) because the backend
  rotates the refresh token on every redemption and a second concurrent refresh would present an
  already-revoked token.
- `lib/fetchInterceptor.ts` wires the access token onto outgoing requests and triggers refresh on
  401.
- Router guard (`router/index.ts`) is the sole authorization enforcement point on the frontend
  (backend presumably re-checks — out of scope for this UI audit).

## 6. Role-based navigation

Two role families share the one shell:
- `isTeacher` → `TEACHER`
- `isAdmin` → `SCHOOL_ADMIN` | `ACCOUNTS` | `SUPER_ADMIN`

Within `isAdmin`, `AppShell.vue` computes ~12 additional per-capability booleans
(`canManageLeave`, `canManageOrgStructure`, `canManagePeople`, `canManageCirculars`,
`canManageTimetable`, `canManageHolidays`, `canManageGradebook`, `canManageReportCards`,
`canManageAdmissions`, `canManageBulkImport`, `canManageHiring`, `canManagePromotions`) that gate
individual `RouterLink`s — each one deliberately mirrors the corresponding route's own
`meta.requiresRole` (several have inline comments citing the backend controller's `@Roles`
decorator as the source of truth). This is a real, working, tested role model — any revamp of the
nav markup must preserve every one of these conditionals, not just the visual grouping.

Nav is also grouped into labeled sections matching the router's `meta.group`: Overview, People,
Operations, Communication, Org Structure (admin side); a flat list (no grouping) on the teacher
side.

Command palette (`CommandPalette.vue`, wired from `AppShell.vue`) duplicates this same role logic
to build its "go to" and "action" item lists — a second place any nav/role change must be mirrored.

## 7. Flutter parent-app architecture

```
parent-app/lib/
├── main.dart
├── src/
│   ├── api/            # api_client.dart, models.dart, refreshing_http_client.dart
│   ├── auth/            # auth_state.dart (Provider-based), token_store.dart
│   ├── cache/            # cached_load.dart, data_cache.dart, last_updated_banner.dart
│   ├── notifications/   # device_token_registrar.dart, push_token_provider.dart, notification_target.dart
│   ├── router/           # app_router.dart (go_router)
│   ├── screens/          # One file per tab/screen (see below)
│   └── theme/            # app_theme.dart, theme_controller.dart, locale_controller.dart, text_direction.dart
└── l10n/                # app_en.arb, app_ur.arb + generated localizations
```

State/DI: `provider` package (`AuthState`, `ApiClient`, `DeviceTokenRegistrar` supplied via
`Provider`/`context.read`). Routing: `go_router`, with a `redirect` callback doing the same
authenticated/unauthenticated split as the Vue router's guard.

Shell: `HomeShell` (`screens/home_shell.dart`) is a `Scaffold` with a bottom `NavigationBar` — the
Flutter equivalent of `AppShell.vue`. **Six** bottom-nav destinations today: Home, Calendar
(bundles Timetable/Attendance/Diary as sub-tabs inside `CalendarTab`), Circulars, Messages, Fees,
More. DESIGN.md Section 7 specifies "max 4–5 destinations (Home, Diary, Attendance, Fees, More)" —
see `findings.md`.

Theme: `theme/app_theme.dart` defines `AppColors`/`AppColorsDark` and `buildAppTheme()`/
`buildDarkAppTheme()`, both Material 3 (`ColorScheme.fromSeed`). Explicitly commented as sharing
the exact same hex values as the staff-console's `base.css` tokens (see README.md's headline
finding).

## 8. Backend (not deeply audited)

`backend/` exists as a sibling app with its own `package.json`; this audit did not inspect its
route/controller structure beyond confirming (via staff-console code comments) that the frontend's
role gates are deliberately kept in sync with backend `@Roles` decorators. No backend files were
read or modified. DESIGN.md Section 13 (Preservation Rules) applies: routes, DB models,
auth/authorization logic, and validation rules are out of scope for any UI migration regardless of
which direction the design-system decision (README.md) goes.
