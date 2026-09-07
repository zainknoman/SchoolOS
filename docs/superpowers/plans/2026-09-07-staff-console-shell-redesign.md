# Staff Console Shell Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the staff console's shared shell (`AppShell.vue`) with grouped role-gated navigation, a breadcrumb, a working `Ctrl/Cmd+K` command palette, two-tier notification badges, and a persisted light/dark theme toggle — on top of the existing design-system tokens, no new brand/font/icon library.

**Architecture:** Pure Vue 3 SFC + scoped CSS + one new small composable, on top of the existing token system in `staff-console/src/assets/base.css`. No new npm dependencies. Dark mode is CSS-custom-property driven (`data-theme` attribute + `prefers-color-scheme` fallback); the command palette's "Actions" deep-link into existing forms via a `?focus=<id>` query param, the same low-tech convention `MessagesView.vue` already uses for `?conversationId=`.

**Tech Stack:** Vue 3 (`<script setup>`, Composition API), Vue Router 4, Pinia, Vitest + `@vue/test-utils`, plain CSS custom properties.

**Spec:** `build/docs/superpowers/specs/2026-09-07-staff-console-shell-redesign-design.md`

## Global Constraints

- No new npm dependencies — no icon library, no CSS framework, no state-machine library.
- No backend/API changes. Two-tier notifications derive client-side from the existing
  `NotificationSummary.type` field (`'message' | 'diary' | 'circular'`); nothing new is requested
  from the server.
- Every new interactive element gets a `data-testid`, matching the existing convention throughout
  `AppShell.vue` and its spec.
- The real role model is `auth.role: 'TEACHER' | 'SCHOOL_ADMIN' | 'ACCOUNTS' | 'SUPER_ADMIN'`
  (`staff-console/src/stores/auth.ts`) — there is **no** `isPrincipal` field on the frontend auth
  store (a principal account is a plain `SCHOOL_ADMIN` in this client; do not reference
  `auth.isPrincipal`, it does not exist and would break the build).
- The auth store carries no display name (only `accessToken`/`refreshToken`/`role`) — do not invent
  or render a fabricated user name anywhere; only role-derived initials/labels are available.
- This plan modifies `AppShell.vue`, `AppIcon.vue`, `base.css`, `router/index.ts`, and three
  existing views (`StudentManagementView.vue`, `FeeManagementView.vue`, `CircularsView.vue`) for a
  single, narrow addition each (a `ref` + a `useFocusTarget()` call) — it does **not** touch those
  three views' state machines, tables, or forms otherwise; that is the separate, later per-screen
  plan.
- Tests use Vitest + `@vue/test-utils`, `data-testid` selectors, and `vi.mock('../lib/api', ...)`
  for API-backed components — matching `AppShell.spec.ts`'s existing pattern exactly. Every
  existing `AppShell.spec.ts` assertion must keep passing (this task extends that file, it does
  not rewrite its existing coverage).
- This is a fix, discovered while designing this pass, for a real pre-existing bug noted in
  `PROJECT-STATUS.md`: `AppShell`'s nav showed the Circulars link to `ACCOUNTS`, but
  `/admin/circulars`'s route guard requires `SCHOOL_ADMIN`/`SUPER_ADMIN`, silently bouncing an
  `ACCOUNTS` user who clicks it. The same gap exists for Timetable (`/admin/timetable` has the
  identical route-guard role list, and the current nav item has no role gate at all). Both are
  fixed by this plan's new `canManageCirculars`/`canManageTimetable` computeds — call this out in
  the commit message for Task 6 as a bug fix, not just a refactor.

---

### Task 1: Design tokens + shell scroll fix

**Files:**
- Modify: `staff-console/index.html`
- Modify: `staff-console/src/assets/base.css`

**Interfaces:**
- Produces (CSS custom properties, consumed by every later task): `--color-status-success`,
  `--color-status-success-tint`, `--color-status-warning`, `--color-status-warning-tint`,
  `--color-status-critical`, `--color-status-critical-tint`, `--color-status-info`,
  `--color-status-info-tint`, `--color-status-neutral`, `--color-status-neutral-tint`,
  `--font-family-mono`. Produces the `.tabular` utility class. Produces dark-theme values for
  every existing token, switched via `[data-theme="dark"]` or `prefers-color-scheme: dark`.

- [ ] **Step 1: Add the IBM Plex Mono font link**

In `staff-console/index.html`, add a third Google Fonts `<link>` right after the existing Noto
Nastaliq Urdu one:

```html
    <link
      href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap"
      rel="stylesheet"
    />
    <link
      href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap"
      rel="stylesheet"
    />
    <title>SEEDS Staff Console</title>
```

- [ ] **Step 2: Replace `base.css` with the token-extended version**

Replace the full contents of `staff-console/src/assets/base.css` with:

```css
/* SEEDS Staff Console — design tokens (see design-system/seeds-staff-console/MASTER.md) */
:root {
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

  /* Semantic status colors — deliberately separate from --color-accent. Used only by StatusPill
     and anywhere a status (not a brand action) needs color-coding. */
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

  --font-family-base:
    'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-family-urdu: 'Noto Nastaliq Urdu', 'Plus Jakarta Sans', sans-serif;
  --font-family-mono: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --font-size-xs: 0.8rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.15rem;
  --font-size-xl: 1.5rem;
  --font-size-2xl: 1.9rem;

  --space-1: 0.5rem;
  --space-2: 0.75rem;
  --space-3: 1rem;
  --space-4: 1.5rem;
  --space-5: 2rem;
  --space-6: 3rem;

  --sidebar-width: 240px;
  --topbar-height: 60px;
  --radius: 8px;
  --radius-sm: 6px;

  --transition-fast: 150ms ease-out;
  --transition-base: 200ms ease-out;
}

/* OS-default dark mode — only applies when the user hasn't made an explicit choice via the
   theme toggle (AppShell writes/reads a `data-theme` attribute on <html> for that). */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --color-primary: #f1f5f9;
    --color-on-primary: #0b1220;
    --color-accent: #4fc0f0;
    --color-accent-hover: #7cd1f5;
    --color-background: #0b1220;
    --color-surface: #111a2c;
    --color-text: #dce4ee;
    --color-muted: #8c9ab3;
    --color-muted-bg: #1c2a42;
    --color-border: #233150;
    --color-destructive: #f87171;
    --color-present: #4ade80;
    --color-late: #fbbf24;
    --color-ring: #4fc0f0;

    --color-status-success-tint: #123321;
    --color-status-warning-tint: #3a2a0c;
    --color-status-critical-tint: #3a1717;
    --color-status-info-tint: #12293c;
  }
}

/* Explicit theme toggle — wins over the OS default in both directions. */
:root[data-theme='dark'] {
  --color-primary: #f1f5f9;
  --color-on-primary: #0b1220;
  --color-accent: #4fc0f0;
  --color-accent-hover: #7cd1f5;
  --color-background: #0b1220;
  --color-surface: #111a2c;
  --color-text: #dce4ee;
  --color-muted: #8c9ab3;
  --color-muted-bg: #1c2a42;
  --color-border: #233150;
  --color-destructive: #f87171;
  --color-present: #4ade80;
  --color-late: #fbbf24;
  --color-ring: #4fc0f0;

  --color-status-success-tint: #123321;
  --color-status-warning-tint: #3a2a0c;
  --color-status-critical-tint: #3a1717;
  --color-status-info-tint: #12293c;
}

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
}

html,
body,
#app {
  height: 100%;
}

body {
  color: var(--color-text);
  background: var(--color-background);
  font-family: var(--font-family-base);
  font-size: var(--font-size-base);
  line-height: 1.5;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

h1,
h2,
h3 {
  font-weight: 700;
  line-height: 1.2;
  color: var(--color-primary);
}

a {
  color: var(--color-accent);
}

/* Every existing view's <input>/<select>/<textarea> relies on this default — none of them set
   their own background/color today, so without this rule they'd render as unstyled white boxes
   the moment dark mode is active (confirmed as a real bug against the design-review mockup this
   pass is based on). Low specificity — any view's own more-specific selector still wins. */
input,
select,
textarea {
  background: var(--color-surface);
  color: var(--color-text);
}

.tabular {
  font-variant-numeric: tabular-nums;
  font-family: var(--font-family-mono);
}

:focus-visible {
  outline: 2px solid var(--color-ring);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: Verify the app still builds**

Run: `cd staff-console && npm run build-only`
Expected: build succeeds (pure CSS/HTML changes, no `.vue`/`.ts` touched yet).

- [ ] **Step 4: Commit**

```bash
git add staff-console/index.html staff-console/src/assets/base.css
git commit -m "style: add dark-mode tokens, semantic status colors, mono font"
```

---

### Task 2: Route meta titles

**Files:**
- Modify: `staff-console/src/router/index.ts`

**Interfaces:**
- Produces: `route.meta.title: string` on every route, consumed by `AppShell.vue`'s breadcrumb in
  Task 6.

- [ ] **Step 1: Add a `title` to every route's `meta`**

Replace the full contents of `staff-console/src/router/index.ts` with:

```ts
import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const STAFF_ROLES = ['TEACHER', 'SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'];

function homeRouteForRole(role: string | null): string {
  if (role === 'TEACHER') return '/teacher';
  if (role && STAFF_ROLES.includes(role)) return '/admin';
  return '/login';
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { public: true, title: 'Log in' },
    },
    {
      path: '/teacher',
      name: 'teacher-home',
      component: () => import('../views/TeacherHomeView.vue'),
      meta: { requiresRole: ['TEACHER'], title: 'Attendance' },
    },
    {
      path: '/teacher/diary',
      name: 'teacher-diary',
      component: () => import('../views/DiaryPageView.vue'),
      meta: { requiresRole: ['TEACHER'], title: 'Diary' },
    },
    {
      path: '/teacher/messages',
      name: 'teacher-messages',
      component: () => import('../views/MessagesPageView.vue'),
      meta: { requiresRole: ['TEACHER'], title: 'Messages' },
    },
    {
      path: '/admin',
      name: 'admin-home',
      component: () => import('../views/AdminHomeView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'], title: 'Dashboard' },
    },
    {
      path: '/admin/schools',
      name: 'admin-schools',
      component: () => import('../views/SchoolManagementPageView.vue'),
      meta: { requiresRole: ['SUPER_ADMIN'], title: 'Schools' },
    },
    {
      path: '/admin/campuses',
      name: 'admin-campuses',
      component: () => import('../views/CampusManagementPageView.vue'),
      meta: { requiresRole: ['SUPER_ADMIN'], title: 'Campuses' },
    },
    {
      path: '/admin/academic-sessions',
      name: 'admin-academic-sessions',
      component: () => import('../views/AcademicSessionManagementPageView.vue'),
      meta: { requiresRole: ['SUPER_ADMIN'], title: 'Academic Sessions' },
    },
    {
      path: '/admin/classes',
      name: 'admin-classes',
      component: () => import('../views/ClassManagementPageView.vue'),
      meta: { requiresRole: ['SUPER_ADMIN'], title: 'Classes' },
    },
    {
      path: '/admin/sections',
      name: 'admin-sections',
      component: () => import('../views/SectionManagementPageView.vue'),
      meta: { requiresRole: ['SUPER_ADMIN'], title: 'Sections' },
    },
    {
      path: '/admin/teachers',
      name: 'admin-teachers',
      component: () => import('../views/TeacherManagementPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Teachers' },
    },
    {
      path: '/admin/parents',
      name: 'admin-parents',
      component: () => import('../views/ParentManagementPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Parents' },
    },
    {
      path: '/admin/students',
      name: 'admin-students',
      component: () => import('../views/StudentManagementPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Students' },
    },
    {
      path: '/admin/fees',
      name: 'admin-fees',
      component: () => import('../views/FeeManagementPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'], title: 'Fees' },
    },
    {
      path: '/admin/circulars',
      name: 'admin-circulars',
      component: () => import('../views/CircularsPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Circulars' },
    },
    {
      path: '/admin/timetable',
      name: 'admin-timetable',
      component: () => import('../views/TimetablePageView.vue'),
      // Matches POST/PATCH/DELETE /api/v1/timetable's own @Roles — ACCOUNTS can't write a
      // timetable, so it doesn't get this screen either (same precedent as admin-circulars).
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Timetable' },
    },
    {
      path: '/admin/messages',
      name: 'admin-messages',
      component: () => import('../views/MessagesPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'], title: 'Messages' },
    },
    {
      path: '/admin/leave',
      name: 'admin-leave',
      component: () => import('../views/LeaveManagementPageView.vue'),
      // Matches POST /api/v1/leave-requests/:id/approve's own @Roles — ACCOUNTS can't decide
      // leave, so it doesn't get this screen either (same precedent as admin-circulars/admin-timetable).
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Leave Applications' },
    },
    { path: '/', redirect: '/login' },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();

  if (to.meta.public) {
    // Already logged in and heading to /login — send them straight to their own home instead.
    if (auth.isAuthenticated && to.name === 'login') {
      return homeRouteForRole(auth.role);
    }
    return true;
  }

  if (!auth.isAuthenticated) {
    return { name: 'login' };
  }

  const requiresRole = to.meta.requiresRole as string[] | undefined;
  if (requiresRole && !requiresRole.includes(auth.role ?? '')) {
    // Wrong-role staff hitting the other console's route — send them home, not a blank/denied page.
    return homeRouteForRole(auth.role);
  }

  return true;
});

export default router;
```

- [ ] **Step 2: Verify the app still builds and existing router-dependent tests pass**

Run: `cd staff-console && npm run build-only && npm test -- --run`
Expected: build succeeds; the existing test suite still passes (this change is additive —
`meta.title` is a new field, nothing existing reads or depends on its absence).

- [ ] **Step 3: Commit**

```bash
git add staff-console/src/router/index.ts
git commit -m "feat: add route meta titles for the upcoming breadcrumb"
```

---

### Task 3: New icons (search, sun, moon)

**Files:**
- Modify: `staff-console/src/components/AppIcon.vue`

**Interfaces:**
- Produces: `export type IconName` (now exported, includes `'search' | 'sun' | 'moon'`),
  importable as `import type { IconName } from './AppIcon.vue'`, and renderable as
  `<Icon name="search" />` etc.

- [ ] **Step 1: Replace `AppIcon.vue` with the icon set extended**

Replace the full contents of `staff-console/src/components/AppIcon.vue` with:

```vue
<script setup lang="ts">
// Outline-style SVG icons (Phosphor "regular" visual language), 20px, currentColor stroke.
// No emoji, no icon-library dependency — this project doesn't have one yet (MASTER.md).
// Exported (previously local-only) so CommandPalette.vue and AppShell.vue can import this exact
// union instead of redeclaring it — one source of truth for which icon names exist.
export type IconName =
  | 'home'
  | 'calendar'
  | 'notebook'
  | 'clock'
  | 'chat'
  | 'users'
  | 'user-circle'
  | 'chalkboard'
  | 'grid'
  | 'megaphone'
  | 'receipt'
  | 'logout'
  | 'bell'
  | 'warning'
  | 'search'
  | 'sun'
  | 'moon';

defineProps<{ name: IconName; size?: number }>();
</script>

<template>
  <svg
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'home'">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </template>
    <template v-else-if="name === 'calendar'">
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </template>
    <template v-else-if="name === 'notebook'">
      <rect x="4.5" y="3" width="15" height="18" rx="2" />
      <path d="M8 3v18M9 8h7M9 12h7M9 16h5" />
    </template>
    <template v-else-if="name === 'clock'">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </template>
    <template v-else-if="name === 'chat'">
      <path d="M4 5h16v11H8l-4 4V5Z" />
    </template>
    <template v-else-if="name === 'users'">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="8.5" r="2.3" />
      <path d="M16 14.2c2.4.4 4 2.6 4 5.8" />
    </template>
    <template v-else-if="name === 'user-circle'">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="10" r="2.5" />
      <path d="M6.5 18.5c1-2.6 3-4 5.5-4s4.5 1.4 5.5 4" />
    </template>
    <template v-else-if="name === 'chalkboard'">
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M9 20h6M12 16v4" />
    </template>
    <template v-else-if="name === 'grid'">
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.2" />
      <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.2" />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.2" />
      <rect x="13" y="13" width="7.5" height="7.5" rx="1.2" />
    </template>
    <template v-else-if="name === 'megaphone'">
      <path d="M3 10v4l4 1 8 4V5L7 9l-4 1Z" />
      <path d="M17 9a3 3 0 0 1 0 6" />
    </template>
    <template v-else-if="name === 'receipt'">
      <path d="M6 3h12v18l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5V3Z" />
      <path d="M9 8h6M9 12h6" />
    </template>
    <template v-else-if="name === 'logout'">
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
      <path d="M15 16l4-4-4-4M8 12h11" />
    </template>
    <template v-else-if="name === 'bell'">
      <path d="M12 3a5 5 0 0 0-5 5v3.5c0 .8-.3 1.6-.9 2.2L5 15h14l-1.1-1.3a3.2 3.2 0 0 1-.9-2.2V8a5 5 0 0 0-5-5Z" />
      <path d="M9.5 18a2.5 2.5 0 0 0 5 0" />
    </template>
    <template v-else-if="name === 'warning'">
      <path d="M12 3.5 21 19H3L12 3.5Z" />
      <path d="M12 10v4M12 16.5v.01" />
    </template>
    <template v-else-if="name === 'search'">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.8-4.8" />
    </template>
    <template v-else-if="name === 'sun'">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12H5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" />
    </template>
    <template v-else-if="name === 'moon'">
      <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z" />
    </template>
  </svg>
</template>
```

- [ ] **Step 2: Verify the app still builds**

Run: `cd staff-console && npm run build-only`
Expected: build succeeds (additive change to a discriminated union — every existing usage of
`<Icon name="...">` still type-checks).

- [ ] **Step 3: Commit**

```bash
git add staff-console/src/components/AppIcon.vue
git commit -m "feat: add search/sun/moon icons for the command palette and theme toggle"
```

---

### Task 4: Focus-target composable + wiring

**Files:**
- Create: `staff-console/src/lib/useFocusTarget.ts`
- Create: `staff-console/src/lib/useFocusTarget.spec.ts`
- Modify: `staff-console/src/views/StudentManagementView.vue`
- Modify: `staff-console/src/views/FeeManagementView.vue`
- Modify: `staff-console/src/views/CircularsView.vue`

**Interfaces:**
- Produces: `useFocusTarget(targets: Record<string, Ref<HTMLElement | null>>): void`, callable
  from any view's `<script setup>`, consumed directly by Task 5's `CommandPalette.vue` only in the
  sense that the palette's "Actions" navigate with a matching `?focus=<id>` query value — the
  palette itself does not import this composable.

- [ ] **Step 1: Write the composable**

Create `staff-console/src/lib/useFocusTarget.ts`:

```ts
import { onMounted, type Ref } from 'vue';
import { useRoute } from 'vue-router';

// The command palette's "Actions" deep-link into a specific input via a `?focus=<id>` query
// param — the same low-tech convention MessagesView.vue already uses for `?conversationId=`.
// Call this once per view with a map of focus-id -> template ref; on mount, if the current
// route's `focus` query matches a key, that element is focused. Does nothing on a normal,
// non-deep-linked page load, and does nothing if the id doesn't match (e.g. the ref hasn't
// rendered yet because a v-if guards it).
export function useFocusTarget(targets: Record<string, Ref<HTMLElement | null>>): void {
  const route = useRoute();

  onMounted(() => {
    const focusId = route.query.focus;
    if (typeof focusId !== 'string') return;
    targets[focusId]?.value?.focus();
  });
}
```

- [ ] **Step 2: Write the composable's test**

Create `staff-console/src/lib/useFocusTarget.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { defineComponent, ref, h } from 'vue';
import { mount } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import { useFocusTarget } from './useFocusTarget';

async function mountAt(query: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/target', name: 'target', component: { template: '<div />' } }],
  });

  const TestComponent = defineComponent({
    setup() {
      const inputRef = ref<HTMLElement | null>(null);
      useFocusTarget({ 'gr-number': inputRef });
      return () => h('input', { ref: inputRef, 'data-testid': 'gr-input' });
    },
  });

  await router.push(`/target${query}`);
  await router.isReady();
  return mount(TestComponent, { global: { plugins: [router] }, attachTo: document.body });
}

describe('useFocusTarget', () => {
  it('focuses the matching ref when the route carries a matching ?focus= value', async () => {
    const wrapper = await mountAt('?focus=gr-number');
    const input = wrapper.find('[data-testid="gr-input"]').element as HTMLInputElement;

    expect(document.activeElement).toBe(input);
    wrapper.unmount();
  });

  it('does nothing when there is no ?focus= query', async () => {
    const focusSpy = vi.fn();
    HTMLElement.prototype.focus = focusSpy;
    const wrapper = await mountAt('');

    expect(focusSpy).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('does nothing when ?focus= does not match any provided key', async () => {
    const focusSpy = vi.fn();
    HTMLElement.prototype.focus = focusSpy;
    const wrapper = await mountAt('?focus=nonexistent-id');

    expect(focusSpy).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
```

- [ ] **Step 3: Run the new tests**

Run: `cd staff-console && npm test -- useFocusTarget --run`
Expected: PASS (3 tests).

- [ ] **Step 4: Wire the composable into `StudentManagementView.vue`**

In `staff-console/src/views/StudentManagementView.vue`, add the import and a template ref. Change:

```ts
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type SectionSummary, type ParentSummary, type StudentAdminSummary } from '../lib/api';
```

to:

```ts
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type SectionSummary, type ParentSummary, type StudentAdminSummary } from '../lib/api';
import { useFocusTarget } from '../lib/useFocusTarget';
```

and right after the existing `const isSaving = ref(false);` line (before `const editingId = ref<string | null>(null);`), add:

```ts
const grNumberInputRef = ref<HTMLInputElement | null>(null);
useFocusTarget({ 'gr-number': grNumberInputRef });
```

In the template, change:

```html
<input data-testid="add-gr-number" v-model="newGrNumber" type="text" placeholder="GR number" />
```

to:

```html
<input ref="grNumberInputRef" data-testid="add-gr-number" v-model="newGrNumber" type="text" placeholder="GR number" />
```

- [ ] **Step 5: Wire the composable into `FeeManagementView.vue`**

In `staff-console/src/views/FeeManagementView.vue`, change the import block:

```ts
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import {
  api,
  type SectionSummary,
  type StudentSummary,
  type FeeStructureSummary,
  type FeeVoucherSummary,
  type FeePaymentSummary,
} from '../lib/api';
import { formatPkrFull } from '../lib/format';
```

to:

```ts
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import {
  api,
  type SectionSummary,
  type StudentSummary,
  type FeeStructureSummary,
  type FeeVoucherSummary,
  type FeePaymentSummary,
} from '../lib/api';
import { formatPkrFull } from '../lib/format';
import { useFocusTarget } from '../lib/useFocusTarget';
```

Right after `const issueSectionId = ref('');` add:

```ts
const issueSectionRef = ref<HTMLSelectElement | null>(null);
useFocusTarget({ 'issue-section': issueSectionRef });
```

In the template, change:

```html
<select data-testid="issue-section" v-model="issueSectionId" @change="onSectionChange">
```

to:

```html
<select ref="issueSectionRef" data-testid="issue-section" v-model="issueSectionId" @change="onSectionChange">
```

- [ ] **Step 6: Wire the composable into `CircularsView.vue`**

In `staff-console/src/views/CircularsView.vue`, change:

```ts
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type SectionSummary, type CircularSummary } from '../lib/api';
import { detectDirection } from '../lib/textDirection';
```

to:

```ts
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type SectionSummary, type CircularSummary } from '../lib/api';
import { detectDirection } from '../lib/textDirection';
import { useFocusTarget } from '../lib/useFocusTarget';
```

Right after `const title = ref('');` add:

```ts
const titleInputRef = ref<HTMLInputElement | null>(null);
useFocusTarget({ title: titleInputRef });
```

In the template, change:

```html
<input data-testid="title-input" v-model="title" type="text" :disabled="isSaving" />
```

to:

```html
<input ref="titleInputRef" data-testid="title-input" v-model="title" type="text" :disabled="isSaving" />
```

- [ ] **Step 7: Run each view's existing test suite to confirm no regression**

Run: `cd staff-console && npm test -- StudentManagementView FeeManagementView CircularsView --run`
Expected: PASS, same test counts as before this task (this task only adds a `ref` and a
`useFocusTarget()` call — it does not change any existing behavior, so no existing test should
need updating).

- [ ] **Step 8: Commit**

```bash
git add staff-console/src/lib/useFocusTarget.ts staff-console/src/lib/useFocusTarget.spec.ts \
  staff-console/src/views/StudentManagementView.vue staff-console/src/views/FeeManagementView.vue \
  staff-console/src/views/CircularsView.vue
git commit -m "feat: add useFocusTarget composable, wire into student/fee/circular forms"
```

---

### Task 5: CommandPalette component

**Files:**
- Create: `staff-console/src/components/CommandPalette.vue`
- Create: `staff-console/src/components/CommandPalette.spec.ts`

**Interfaces:**
- Consumes: `AppIcon.vue`'s `IconName` type (Task 3).
- Produces:
  ```ts
  interface CommandPaletteGoToItem { testid: string; label: string; icon: IconName; to: string }
  interface CommandPaletteActionItem {
    testid: string; label: string; icon: IconName; to: string; query?: Record<string, string>;
  }
  ```
  and the component `<CommandPalette :open="boolean" :go-to-items="CommandPaletteGoToItem[]" :action-items="CommandPaletteActionItem[]" @close="..." />`, consumed by `AppShell.vue` in Task 6.

- [ ] **Step 1: Write the component**

Create `staff-console/src/components/CommandPalette.vue`:

```vue
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import Icon, { type IconName } from './AppIcon.vue';

interface GoToItem {
  testid: string;
  label: string;
  icon: IconName;
  to: string;
}
interface ActionItem {
  testid: string;
  label: string;
  icon: IconName;
  to: string;
  query?: Record<string, string>;
}
type PaletteItem =
  | ({ group: 'Go to' } & GoToItem)
  | ({ group: 'Actions' } & ActionItem);

const props = defineProps<{
  open: boolean;
  goToItems: GoToItem[];
  actionItems: ActionItem[];
}>();
const emit = defineEmits<{ close: [] }>();

const router = useRouter();
const query = ref('');
const selectedIndex = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);

const allItems = computed<PaletteItem[]>(() => [
  ...props.goToItems.map((i) => ({ group: 'Go to' as const, ...i })),
  ...props.actionItems.map((i) => ({ group: 'Actions' as const, ...i })),
]);

const filteredItems = computed<PaletteItem[]>(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return allItems.value;
  return allItems.value.filter((i) => i.label.toLowerCase().includes(q));
});

watch(query, () => {
  selectedIndex.value = 0;
});

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return;
    query.value = '';
    selectedIndex.value = 0;
    await nextTick();
    inputRef.value?.focus();
  },
);

function activate(item: PaletteItem) {
  if (item.group === 'Actions' && item.query) {
    router.push({ path: item.to, query: item.query });
  } else {
    router.push(item.to);
  }
  emit('close');
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close');
    return;
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (filteredItems.value.length === 0) return;
    selectedIndex.value = (selectedIndex.value + 1) % filteredItems.value.length;
    return;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (filteredItems.value.length === 0) return;
    selectedIndex.value = (selectedIndex.value - 1 + filteredItems.value.length) % filteredItems.value.length;
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    const item = filteredItems.value[selectedIndex.value];
    if (item) activate(item);
  }
}
</script>

<template>
  <div
    v-if="open"
    class="cmdk-overlay"
    data-testid="cmdk-overlay"
    @click.self="emit('close')"
  >
    <div class="cmdk" role="dialog" aria-modal="true" aria-label="Command palette">
      <div class="cmdk-input-row">
        <Icon name="search" :size="16" />
        <input
          ref="inputRef"
          data-testid="cmdk-input"
          v-model="query"
          type="text"
          placeholder="Jump to a screen or run an action…"
          autocomplete="off"
          @keydown="onKeydown"
        />
        <kbd>Esc</kbd>
      </div>
      <div class="cmdk-list" data-testid="cmdk-list">
        <template v-if="filteredItems.length">
          <template v-for="(item, index) in filteredItems" :key="item.testid">
            <div
              v-if="index === 0 || filteredItems[index - 1].group !== item.group"
              class="cmdk-group-label"
            >
              {{ item.group }}
            </div>
            <button
              type="button"
              class="cmdk-item"
              :class="{ selected: index === selectedIndex }"
              :data-testid="item.testid"
              @click="activate(item)"
              @mouseenter="selectedIndex = index"
            >
              <Icon :name="item.icon" :size="16" />
              <span>{{ item.label }}</span>
              <span class="cmdk-go">{{ item.group === 'Actions' ? 'Open' : 'Jump ↵' }}</span>
            </button>
          </template>
        </template>
        <div v-else class="cmdk-empty" data-testid="cmdk-empty">No results</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cmdk-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 12, 0.55);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
  z-index: 100;
}
.cmdk {
  width: min(560px, 92vw);
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: 0 20px 60px -12px rgba(15, 23, 42, 0.35);
  overflow: hidden;
}
.cmdk-input-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
  color: var(--color-muted);
  flex-shrink: 0;
}
.cmdk-input-row input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-size: var(--font-size-lg);
}
.cmdk-input-row kbd {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-xs);
  color: var(--color-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
}
.cmdk-list {
  overflow-y: auto;
  padding: var(--space-1);
}
.cmdk-group-label {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-muted);
  font-weight: 700;
  padding: var(--space-2) var(--space-3) var(--space-1);
}
.cmdk-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: none;
  background: none;
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font: inherit;
  font-size: var(--font-size-sm);
  text-align: left;
  cursor: pointer;
}
.cmdk-item.selected,
.cmdk-item:hover {
  background: var(--color-muted-bg);
}
.cmdk-go {
  margin-left: auto;
  font-size: var(--font-size-xs);
  color: var(--color-muted);
}
.cmdk-empty {
  padding: var(--space-4);
  color: var(--color-muted);
  text-align: center;
  font-size: var(--font-size-sm);
}
</style>
```

- [ ] **Step 2: Write the test**

Create `staff-console/src/components/CommandPalette.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import CommandPalette from './CommandPalette.vue';

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div>home</div>' } },
      { path: '/admin/students', name: 'students', component: { template: '<div>students</div>' } },
      { path: '/admin/fees', name: 'fees', component: { template: '<div>fees</div>' } },
    ],
  });
}

const goToItems = [
  { testid: 'cmdk-dashboard', label: 'Dashboard', icon: 'home' as const, to: '/' },
  { testid: 'cmdk-students', label: 'Students', icon: 'users' as const, to: '/admin/students' },
];
const actionItems = [
  {
    testid: 'cmdk-action-issue-vouchers',
    label: 'Issue fee vouchers',
    icon: 'receipt' as const,
    to: '/admin/fees',
    query: { focus: 'issue-section' },
  },
];

async function mountPalette(open = true) {
  const router = makeRouter();
  await router.push('/');
  await router.isReady();
  const wrapper = mount(CommandPalette, {
    props: { open, goToItems, actionItems },
    global: { plugins: [router] },
  });
  return { wrapper, router };
}

describe('CommandPalette', () => {
  it('renders nothing when closed', async () => {
    const { wrapper } = await mountPalette(false);
    expect(wrapper.find('[data-testid="cmdk-overlay"]').exists()).toBe(false);
  });

  it('lists every go-to and action item, grouped, when open', async () => {
    const { wrapper } = await mountPalette(true);

    expect(wrapper.find('[data-testid="cmdk-dashboard"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="cmdk-students"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="cmdk-action-issue-vouchers"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Go to');
    expect(wrapper.text()).toContain('Actions');
  });

  it('filters items by the typed query', async () => {
    const { wrapper } = await mountPalette(true);

    await wrapper.find('[data-testid="cmdk-input"]').setValue('student');

    expect(wrapper.find('[data-testid="cmdk-students"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="cmdk-dashboard"]').exists()).toBe(false);
  });

  it('shows an empty state when nothing matches', async () => {
    const { wrapper } = await mountPalette(true);

    await wrapper.find('[data-testid="cmdk-input"]').setValue('nonexistent-screen-xyz');

    expect(wrapper.find('[data-testid="cmdk-empty"]').exists()).toBe(true);
  });

  it('navigates to a go-to item on click and emits close', async () => {
    const { wrapper, router } = await mountPalette(true);

    await wrapper.find('[data-testid="cmdk-students"]').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/admin/students');
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('navigates an action item to its target path with its focus query', async () => {
    const { wrapper, router } = await mountPalette(true);

    await wrapper.find('[data-testid="cmdk-action-issue-vouchers"]').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/admin/fees');
    expect(router.currentRoute.value.query.focus).toBe('issue-section');
  });

  it('closes on Escape', async () => {
    const { wrapper } = await mountPalette(true);

    await wrapper.find('[data-testid="cmdk-input"]').trigger('keydown', { key: 'Escape' });

    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('moves the selection with ArrowDown/ArrowUp and activates on Enter', async () => {
    const { wrapper, router } = await mountPalette(true);
    const input = wrapper.find('[data-testid="cmdk-input"]');

    await input.trigger('keydown', { key: 'ArrowDown' });
    await input.trigger('keydown', { key: 'Enter' });
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/admin/students');
  });

  it('resets the query when reopened', async () => {
    const router = makeRouter();
    await router.push('/');
    await router.isReady();
    const wrapper = mount(CommandPalette, {
      props: { open: true, goToItems, actionItems },
      global: { plugins: [router] },
    });

    await wrapper.find('[data-testid="cmdk-input"]').setValue('student');
    await wrapper.setProps({ open: false });
    await wrapper.setProps({ open: true });

    expect((wrapper.find('[data-testid="cmdk-input"]').element as HTMLInputElement).value).toBe('');
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `cd staff-console && npm test -- CommandPalette --run`
Expected: PASS (9 tests).

- [ ] **Step 4: Commit**

```bash
git add staff-console/src/components/CommandPalette.vue staff-console/src/components/CommandPalette.spec.ts
git commit -m "feat: add CommandPalette component"
```

---

### Task 6: AppShell rebuild — grouped nav, breadcrumb, notifications, theme toggle

**Files:**
- Modify: `staff-console/src/components/AppShell.vue`
- Modify: `staff-console/src/components/AppShell.spec.ts`

**Interfaces:**
- Consumes: `CommandPalette.vue` (Task 5), `route.meta.title` (Task 2), `Icon` `'search'|'sun'|'moon'` (Task 3).
- Produces: the shipped shell every other view renders inside — no new interface for later tasks
  (this is the top of the dependency chain for this plan).

- [ ] **Step 1: Replace `AppShell.vue`**

Replace the full contents of `staff-console/src/components/AppShell.vue` with:

```vue
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api, type NotificationSummary } from '../lib/api';
import Icon, { type IconName } from './AppIcon.vue';
import CommandPalette from './CommandPalette.vue';
import { roleInitials } from '../lib/format';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const isTeacher = computed(() => auth.role === 'TEACHER');
const isAdmin = computed(() => ['SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'].includes(auth.role ?? ''));
const canManageLeave = computed(() => auth.role === 'SCHOOL_ADMIN' || auth.role === 'SUPER_ADMIN');
const canManageOrgStructure = computed(() => auth.role === 'SUPER_ADMIN');
const canManagePeople = computed(() => auth.role === 'SCHOOL_ADMIN' || auth.role === 'SUPER_ADMIN');
// Fixes a real pre-existing bug (PROJECT-STATUS.md): the nav used to show Circulars/Timetable to
// every admin-side role, but their route guards only allow SCHOOL_ADMIN/SUPER_ADMIN — an ACCOUNTS
// user clicking either link used to silently bounce back to /admin with no explanation.
const canManageCirculars = computed(() => auth.role === 'SCHOOL_ADMIN' || auth.role === 'SUPER_ADMIN');
const canManageTimetable = computed(() => auth.role === 'SCHOOL_ADMIN' || auth.role === 'SUPER_ADMIN');

const avatarInitials = computed(() => roleInitials(auth.role));
const roleLabel = computed(() => {
  switch (auth.role) {
    case 'TEACHER':
      return 'Teacher';
    case 'SCHOOL_ADMIN':
      return 'School Admin';
    case 'ACCOUNTS':
      return 'Accounts';
    case 'SUPER_ADMIN':
      return 'Super Admin';
    default:
      return '';
  }
});

const breadcrumbTitle = computed(() => (route.meta.title as string | undefined) ?? '');

// --- Notifications (two-tier: numeric badge for actionable, dot for ambient) ---
const notifications = ref<NotificationSummary[]>([]);
const isNotifOpen = ref(false);
const notifError = ref<string | null>(null);
const actionableUnreadCount = computed(
  () => notifications.value.filter((n) => !n.readAt && n.type === 'message').length,
);
const hasAmbientUnread = computed(
  () => notifications.value.some((n) => !n.readAt && n.type !== 'message'),
);

async function loadNotifications() {
  if (!auth.accessToken) return;
  try {
    notifications.value = await api.listNotifications(auth.accessToken);
  } catch {
    // Convenience only — a failed fetch just leaves the bell showing zero unread.
  }
}
onMounted(loadNotifications);

function notifIcon(type: NotificationSummary['type']): IconName {
  if (type === 'message') return 'chat';
  if (type === 'diary') return 'notebook';
  return 'megaphone';
}

// Notifications for diary/circular events only ever target parents (see NotificationsService
// callers); staff will realistically only ever see 'message' type here, but this stays generic
// to match the "deep-links to the right screen" requirement for all three types.
//
// This is type-based, not role-based, so it can resolve to a route the current user's role can't
// enter (teacher-diary requires TEACHER only; admin-circulars requires SCHOOL_ADMIN/SUPER_ADMIN
// only, not ACCOUNTS). The router's global guard would silently bounce them elsewhere with no
// explanation, so fall back to the caller's own home route in those known-mismatch cases.
function routeForNotification(n: NotificationSummary): { path: string; query?: Record<string, string> } {
  if (n.type === 'message') {
    const path = isTeacher.value ? '/teacher/messages' : '/admin/messages';
    // entityRef is the conversation this notification was about — carry it through so the
    // Messages view opens that specific thread instead of just landing on the list.
    return n.entityRef ? { path, query: { conversationId: n.entityRef } } : { path };
  }
  const homeRoute = isTeacher.value ? '/teacher' : '/admin';
  if (n.type === 'diary') return { path: isTeacher.value ? '/teacher/diary' : homeRoute };
  const canViewCirculars = auth.role === 'SCHOOL_ADMIN' || auth.role === 'SUPER_ADMIN';
  return { path: canViewCirculars ? '/admin/circulars' : homeRoute };
}

async function onOpenNotification(n: NotificationSummary) {
  isNotifOpen.value = false;
  if (!auth.accessToken) return;
  if (!n.readAt) {
    try {
      await api.markNotificationRead(auth.accessToken, n.id);
      await loadNotifications();
    } catch {
      // Marking read is best-effort — don't block navigation to the relevant screen on it.
    }
  }
  await router.push(routeForNotification(n));
}

async function onMarkAllRead() {
  if (!auth.accessToken) return;
  notifError.value = null;
  try {
    await api.markAllNotificationsRead(auth.accessToken);
    await loadNotifications();
  } catch {
    notifError.value = 'Could not mark notifications read. Please try again.';
  }
}

async function onLogout() {
  auth.logout();
  await router.push({ name: 'login' });
}

// --- Theme toggle (persisted; falls back to OS prefers-color-scheme when unset) ---
const THEME_STORAGE_KEY = 'seeds.theme';
const themeOverride = ref<'light' | 'dark' | null>(null);

function loadThemePreference(): 'light' | 'dark' | null {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return raw === 'light' || raw === 'dark' ? raw : null;
  } catch {
    return null;
  }
}

function applyTheme(mode: 'light' | 'dark' | null) {
  if (mode) {
    document.documentElement.setAttribute('data-theme', mode);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

themeOverride.value = loadThemePreference();
applyTheme(themeOverride.value);

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

const isDarkActive = computed(() =>
  themeOverride.value ? themeOverride.value === 'dark' : systemPrefersDark(),
);

function onToggleTheme() {
  const next: 'light' | 'dark' = isDarkActive.value ? 'light' : 'dark';
  themeOverride.value = next;
  applyTheme(next);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Best-effort persistence only — the theme still applies for this session.
  }
}

// --- Command palette ---
const isPaletteOpen = ref(false);

interface CmdkGoTo { testid: string; label: string; icon: IconName; to: string }
interface CmdkAction { testid: string; label: string; icon: IconName; to: string; query?: Record<string, string> }

const goToItems = computed<CmdkGoTo[]>(() => {
  if (isTeacher.value) {
    return [
      { testid: 'cmdk-attendance', label: 'Attendance', icon: 'calendar', to: '/teacher' },
      { testid: 'cmdk-diary', label: 'Diary', icon: 'notebook', to: '/teacher/diary' },
      { testid: 'cmdk-messages', label: 'Messages', icon: 'chat', to: '/teacher/messages' },
    ];
  }
  if (!isAdmin.value) return [];
  const items: CmdkGoTo[] = [{ testid: 'cmdk-dashboard', label: 'Dashboard', icon: 'home', to: '/admin' }];
  if (canManageOrgStructure.value) {
    items.push(
      { testid: 'cmdk-schools', label: 'Schools', icon: 'chalkboard', to: '/admin/schools' },
      { testid: 'cmdk-campuses', label: 'Campuses', icon: 'grid', to: '/admin/campuses' },
      {
        testid: 'cmdk-academic-sessions',
        label: 'Academic Sessions',
        icon: 'calendar',
        to: '/admin/academic-sessions',
      },
      { testid: 'cmdk-classes', label: 'Classes', icon: 'grid', to: '/admin/classes' },
      { testid: 'cmdk-sections', label: 'Sections', icon: 'grid', to: '/admin/sections' },
    );
  }
  if (canManagePeople.value) {
    items.push(
      { testid: 'cmdk-students', label: 'Students', icon: 'users', to: '/admin/students' },
      { testid: 'cmdk-parents', label: 'Parents', icon: 'user-circle', to: '/admin/parents' },
      { testid: 'cmdk-teachers', label: 'Teachers', icon: 'chalkboard', to: '/admin/teachers' },
    );
  }
  if (canManageTimetable.value) {
    items.push({ testid: 'cmdk-timetable', label: 'Timetable', icon: 'clock', to: '/admin/timetable' });
  }
  items.push({ testid: 'cmdk-fees', label: 'Fees', icon: 'receipt', to: '/admin/fees' });
  if (canManageLeave.value) {
    items.push({ testid: 'cmdk-leave', label: 'Leave', icon: 'calendar', to: '/admin/leave' });
  }
  if (canManageCirculars.value) {
    items.push({ testid: 'cmdk-circulars', label: 'Circulars', icon: 'megaphone', to: '/admin/circulars' });
  }
  items.push({ testid: 'cmdk-messages', label: 'Messages', icon: 'chat', to: '/admin/messages' });
  return items;
});

const actionItems = computed<CmdkAction[]>(() => {
  const items: CmdkAction[] = [];
  if (canManagePeople.value) {
    items.push({
      testid: 'cmdk-action-add-student',
      label: 'Add student',
      icon: 'users',
      to: '/admin/students',
      query: { focus: 'gr-number' },
    });
  }
  if (isAdmin.value) {
    items.push({
      testid: 'cmdk-action-issue-vouchers',
      label: 'Issue fee vouchers',
      icon: 'receipt',
      to: '/admin/fees',
      query: { focus: 'issue-section' },
    });
  }
  if (canManageLeave.value) {
    items.push({
      testid: 'cmdk-action-approve-leave',
      label: 'Approve a leave request',
      icon: 'calendar',
      to: '/admin/leave',
    });
  }
  if (canManageCirculars.value) {
    items.push({
      testid: 'cmdk-action-publish-circular',
      label: 'Publish a circular',
      icon: 'megaphone',
      to: '/admin/circulars',
      query: { focus: 'title' },
    });
  }
  return items;
});

function onGlobalKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    isPaletteOpen.value = !isPaletteOpen.value;
  }
}
onMounted(() => window.addEventListener('keydown', onGlobalKeydown));
onUnmounted(() => window.removeEventListener('keydown', onGlobalKeydown));
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <span class="brand">SEEDS Staff Console</span>
      <nav class="crumbs" aria-label="Breadcrumb" data-testid="breadcrumb">
        <b>{{ breadcrumbTitle }}</b>
      </nav>
      <div class="topbar-spacer"></div>
      <button
        type="button"
        class="cmdk-trigger"
        data-testid="cmdk-trigger"
        @click="isPaletteOpen = true"
      >
        <Icon name="search" :size="15" />
        <span>Jump to… or search</span>
        <kbd>Ctrl K</kbd>
      </button>
      <button
        type="button"
        class="icon-button"
        data-testid="theme-toggle"
        :aria-label="isDarkActive ? 'Switch to light theme' : 'Switch to dark theme'"
        @click="onToggleTheme"
      >
        <Icon :name="isDarkActive ? 'sun' : 'moon'" :size="18" />
      </button>
      <div class="topbar-actions">
        <div class="notif-wrapper">
          <button
            data-testid="notifications"
            class="icon-button"
            aria-label="Notifications"
            @click="isNotifOpen = !isNotifOpen"
          >
            <Icon name="bell" :size="18" />
            <span v-if="actionableUnreadCount > 0" class="badge" data-testid="notif-badge">{{
              actionableUnreadCount
            }}</span>
            <span v-else-if="hasAmbientUnread" class="badge-dot" data-testid="notif-dot" aria-hidden="true"></span>
          </button>
          <div v-if="isNotifOpen" class="notif-dropdown" data-testid="notif-dropdown">
            <p v-if="notifError" class="notif-error" data-testid="notif-error" role="alert">{{ notifError }}</p>
            <p v-if="!notifications.length" class="notif-empty">No notifications yet.</p>
            <button
              v-else
              data-testid="notif-mark-all-read"
              class="notif-mark-all"
              @click="onMarkAllRead"
            >
              Mark all read
            </button>
            <button
              v-for="n in notifications"
              :key="n.id"
              :data-testid="`notif-item-${n.id}`"
              class="notif-item"
              :class="{ unread: !n.readAt }"
              @click="onOpenNotification(n)"
            >
              <span class="notif-icon" :class="{ actionable: n.type === 'message' && !n.readAt }">
                <Icon :name="notifIcon(n.type)" :size="14" />
              </span>
              <span class="notif-item-text">
                <strong>{{ n.title }}</strong>
                <span>{{ n.body }}</span>
              </span>
            </button>
          </div>
        </div>
        <span data-testid="avatar" class="avatar" aria-hidden="true">{{ avatarInitials }}</span>
        <span class="role-label">{{ roleLabel }}</span>
        <button data-testid="logout" class="logout" @click="onLogout">
          <Icon name="logout" :size="16" />
          Log out
        </button>
      </div>
    </header>

    <div class="body">
      <nav class="sidenav" aria-label="Main">
        <template v-if="isTeacher">
          <RouterLink data-testid="nav-attendance" to="/teacher"><Icon name="calendar" />Attendance</RouterLink>
          <RouterLink data-testid="nav-diary" to="/teacher/diary"><Icon name="notebook" />Diary</RouterLink>
          <a data-testid="nav-timetable" href="#"><Icon name="clock" />Timetable</a>
          <RouterLink data-testid="nav-messages" to="/teacher/messages"><Icon name="chat" />Messages</RouterLink>
        </template>
        <template v-else-if="isAdmin">
          <div class="nav-group">
            <div class="nav-group-label">Overview</div>
            <RouterLink data-testid="nav-dashboard" to="/admin"><Icon name="home" />Dashboard</RouterLink>
          </div>

          <div v-if="canManagePeople" class="nav-group">
            <div class="nav-group-label">People</div>
            <RouterLink data-testid="nav-students" to="/admin/students"><Icon name="users" />Students</RouterLink>
            <RouterLink data-testid="nav-parents" to="/admin/parents"
              ><Icon name="user-circle" />Parents</RouterLink
            >
            <RouterLink data-testid="nav-teachers" to="/admin/teachers"
              ><Icon name="chalkboard" />Teachers</RouterLink
            >
          </div>

          <div v-if="canManageOrgStructure" class="nav-group">
            <div class="nav-group-label">Org Structure</div>
            <RouterLink data-testid="nav-schools" to="/admin/schools"
              ><Icon name="chalkboard" />Schools</RouterLink
            >
            <RouterLink data-testid="nav-campuses" to="/admin/campuses"><Icon name="grid" />Campuses</RouterLink>
            <RouterLink data-testid="nav-academic-sessions" to="/admin/academic-sessions"
              ><Icon name="calendar" />Academic Sessions</RouterLink
            >
            <RouterLink data-testid="nav-classes" to="/admin/classes"><Icon name="grid" />Classes</RouterLink>
            <RouterLink data-testid="nav-sections" to="/admin/sections"><Icon name="grid" />Sections</RouterLink>
          </div>

          <div class="nav-group">
            <div class="nav-group-label">Operations</div>
            <RouterLink v-if="canManageTimetable" data-testid="nav-timetable" to="/admin/timetable"
              ><Icon name="clock" />Timetable</RouterLink
            >
            <RouterLink data-testid="nav-fees" to="/admin/fees"><Icon name="receipt" />Fees</RouterLink>
            <RouterLink v-if="canManageLeave" data-testid="nav-leave" to="/admin/leave"
              ><Icon name="calendar" />Leave</RouterLink
            >
          </div>

          <div class="nav-group">
            <div class="nav-group-label">Communication</div>
            <RouterLink v-if="canManageCirculars" data-testid="nav-circulars" to="/admin/circulars"
              ><Icon name="megaphone" />Circulars</RouterLink
            >
            <RouterLink data-testid="nav-messages" to="/admin/messages"><Icon name="chat" />Messages</RouterLink>
          </div>
        </template>
      </nav>

      <main class="content">
        <slot />
      </main>
    </div>

    <CommandPalette
      :open="isPaletteOpen"
      :go-to-items="goToItems"
      :action-items="actionItems"
      @close="isPaletteOpen = false"
    />
  </div>
</template>

<style scoped>
.shell {
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.topbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  height: var(--topbar-height);
  padding: 0 var(--space-4);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.brand {
  font-weight: 700;
  color: var(--color-primary);
  white-space: nowrap;
}

.crumbs {
  color: var(--color-muted);
  font-size: var(--font-size-sm);
}
.crumbs b {
  color: var(--color-text);
  font-weight: 600;
}

.topbar-spacer {
  flex: 1;
}

.cmdk-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: 6px var(--space-2) 6px 10px;
  border: 1px solid var(--color-border);
  background: var(--color-background);
  color: var(--color-muted);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  cursor: pointer;
  min-width: 200px;
  transition: border-color var(--transition-fast);
}
.cmdk-trigger:hover {
  border-color: var(--color-accent);
}
.cmdk-trigger span {
  flex: 1;
  text-align: left;
}
.cmdk-trigger kbd {
  font-family: var(--font-family-mono);
  font-size: 0.68rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 5px;
  padding: 1px 5px;
  color: var(--color-muted);
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.role-label {
  font-size: var(--font-size-xs);
  color: var(--color-muted);
  white-space: nowrap;
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  background: transparent;
  color: var(--color-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.icon-button:hover {
  background: var(--color-muted-bg);
}

.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: var(--font-size-xs);
  font-weight: 700;
  flex-shrink: 0;
}

.logout {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text);
  border-radius: var(--radius-sm);
  padding: 0.45rem 0.8rem;
  font: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.logout:hover {
  background: var(--color-muted-bg);
}

.body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.sidenav {
  width: var(--sidebar-width);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: var(--space-3);
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
  overflow-y: auto;
}

.nav-group {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  margin-top: var(--space-3);
}
.nav-group:first-child {
  margin-top: 0;
}
.nav-group-label {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-muted);
  padding: 0.3rem 0.7rem 0.15rem;
}

.sidenav a {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0.55rem 0.7rem;
  border-radius: var(--radius-sm);
  color: var(--color-text);
  text-decoration: none;
  font-size: var(--font-size-sm);
  transition: background var(--transition-fast);
}
.sidenav a:hover,
.sidenav a:focus-visible {
  background: var(--color-muted-bg);
}
.sidenav a.router-link-active {
  background: var(--color-muted-bg);
  font-weight: 600;
}

.content {
  flex: 1;
  padding: var(--space-5) var(--space-6);
  overflow-y: auto;
}

.notif-wrapper {
  position: relative;
}
.badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--color-destructive);
  color: white;
  border-radius: 999px;
  font-size: 0.65rem;
  min-width: 1.1rem;
  height: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.25rem;
}
.badge-dot {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-accent);
  border: 1.5px solid var(--color-surface);
}
.notif-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  width: 300px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 10;
  display: flex;
  flex-direction: column;
}
.notif-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: none;
  border-bottom: 1px solid var(--color-border);
  background: none;
  text-align: left;
  cursor: pointer;
  font: inherit;
}
.notif-icon {
  width: 1.6rem;
  height: 1.6rem;
  border-radius: var(--radius-sm);
  background: var(--color-muted-bg);
  color: var(--color-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.notif-icon.actionable {
  background: var(--color-status-info-tint);
  color: var(--color-status-info);
}
.notif-item-text {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}
.notif-item.unread strong {
  font-weight: 700;
}
.notif-empty {
  padding: var(--space-3);
  color: var(--color-muted);
}
.notif-error {
  padding: var(--space-2) var(--space-3);
  color: var(--color-destructive);
  font-size: var(--font-size-sm);
}
.notif-mark-all {
  padding: var(--space-2) var(--space-3);
  border: none;
  border-bottom: 1px solid var(--color-border);
  background: none;
  text-align: left;
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-sm);
  color: var(--color-accent);
}
</style>
```

- [ ] **Step 2: Update `AppShell.spec.ts`**

Replace the full contents of `staff-console/src/components/AppShell.spec.ts` with (existing tests
preserved verbatim except where the grouped-nav DOM restructure requires an updated selector;
new tests appended at the end):

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import AppShell from './AppShell.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listNotifications: vi.fn().mockResolvedValue([]),
    markNotificationRead: vi.fn().mockResolvedValue(undefined),
    markAllNotificationsRead: vi.fn().mockResolvedValue(undefined),
  },
}));

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: { template: '<div>login</div>' } },
      { path: '/teacher', name: 'teacher-home', component: { template: '<div>teacher</div>' } },
      { path: '/admin', name: 'admin-home', component: { template: '<div>admin</div>' }, meta: { title: 'Dashboard' } },
      { path: '/admin/fees', name: 'admin-fees', component: { template: '<div>fees</div>' } },
      { path: '/admin/leave', name: 'admin-leave', component: { template: '<div>leave</div>' } },
      { path: '/teacher/messages', name: 'teacher-messages', component: { template: '<div>messages</div>' } },
      { path: '/admin/messages', name: 'admin-messages', component: { template: '<div>messages</div>' } },
      { path: '/teacher/diary', name: 'teacher-diary', component: { template: '<div>diary</div>' } },
      { path: '/admin/circulars', name: 'admin-circulars', component: { template: '<div>circulars</div>' } },
      { path: '/admin/timetable', name: 'admin-timetable', component: { template: '<div>timetable</div>' } },
      { path: '/admin/schools', name: 'admin-schools', component: { template: '<div>schools</div>' } },
      { path: '/admin/campuses', name: 'admin-campuses', component: { template: '<div>campuses</div>' } },
      {
        path: '/admin/academic-sessions',
        name: 'admin-academic-sessions',
        component: { template: '<div>academic-sessions</div>' },
      },
      { path: '/admin/classes', name: 'admin-classes', component: { template: '<div>classes</div>' } },
      { path: '/admin/sections', name: 'admin-sections', component: { template: '<div>sections</div>' } },
      { path: '/admin/teachers', name: 'admin-teachers', component: { template: '<div>teachers</div>' } },
      { path: '/admin/parents', name: 'admin-parents', component: { template: '<div>parents</div>' } },
      { path: '/admin/students', name: 'admin-students', component: { template: '<div>students</div>' } },
    ],
  });
}

async function mountAsRole(role: string) {
  setActivePinia(createPinia());
  const auth = useAuthStore();
  auth.role = role;
  auth.accessToken = 'token-1';
  const router = makeRouter();
  await router.push('/login');
  await router.isReady();
  const wrapper = mount(AppShell, { global: { plugins: [router] } });
  await flushPromises();
  return wrapper;
}

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  localStorage.clear();
});

describe('AppShell (role-gated nav)', () => {
  it('shows only Teacher nav items for a TEACHER role, with no admin items in the DOM at all', async () => {
    const wrapper = await mountAsRole('TEACHER');

    expect(wrapper.text()).toContain('Attendance');
    expect(wrapper.text()).toContain('Diary');
    expect(wrapper.text()).toContain('Timetable');
    expect(wrapper.text()).toContain('Messages');

    // Not CSS-hidden — absent from the DOM entirely.
    expect(wrapper.text()).not.toContain('Students');
    expect(wrapper.text()).not.toContain('Fees');
    expect(wrapper.find('[data-testid="nav-students"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-fees"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-dashboard"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-leave"]').exists()).toBe(false);
  });

  it('shows Admin/Accounts nav items for a SCHOOL_ADMIN role, with no teacher-only items', async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');

    expect(wrapper.text()).toContain('Dashboard');
    expect(wrapper.text()).toContain('Students');
    expect(wrapper.text()).toContain('Parents');
    expect(wrapper.text()).toContain('Teachers');
    expect(wrapper.text()).toContain('Timetable');
    expect(wrapper.text()).toContain('Circulars');
    expect(wrapper.text()).toContain('Fees');
    expect(wrapper.text()).toContain('Leave');
    expect(wrapper.text()).toContain('Messages');

    expect(wrapper.find('[data-testid="nav-attendance"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-diary"]').exists()).toBe(false);

    // Org Structure links (Schools/Campuses/Academic Sessions/Classes/Sections) are
    // SUPER_ADMIN-only — not visible to SCHOOL_ADMIN, even though it's otherwise a full admin role.
    expect(wrapper.find('[data-testid="nav-schools"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-campuses"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-academic-sessions"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-classes"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-sections"]').exists()).toBe(false);

    expect(wrapper.find('[data-testid="nav-dashboard"]').attributes('href')).toBe('/admin');
    expect(wrapper.find('[data-testid="nav-fees"]').attributes('href')).toBe('/admin/fees');
    expect(wrapper.find('[data-testid="nav-timetable"]').attributes('href')).toBe('/admin/timetable');
    expect(wrapper.find('[data-testid="nav-leave"]').attributes('href')).toBe('/admin/leave');
  });

  it('shows nav-leave for a SUPER_ADMIN role', async () => {
    const wrapper = await mountAsRole('SUPER_ADMIN');

    expect(wrapper.find('[data-testid="nav-leave"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-leave"]').attributes('href')).toBe('/admin/leave');
  });

  it('shows the Org Structure nav links (Schools/Campuses/Academic Sessions/Classes/Sections) for a SUPER_ADMIN role', async () => {
    const wrapper = await mountAsRole('SUPER_ADMIN');

    expect(wrapper.find('[data-testid="nav-schools"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-schools"]').attributes('href')).toBe('/admin/schools');
    expect(wrapper.find('[data-testid="nav-campuses"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-campuses"]').attributes('href')).toBe('/admin/campuses');
    expect(wrapper.find('[data-testid="nav-academic-sessions"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-academic-sessions"]').attributes('href')).toBe(
      '/admin/academic-sessions',
    );
    expect(wrapper.find('[data-testid="nav-classes"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-classes"]').attributes('href')).toBe('/admin/classes');
    expect(wrapper.find('[data-testid="nav-sections"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-sections"]').attributes('href')).toBe('/admin/sections');
  });

  it('hides the Org Structure nav links for an ACCOUNTS role', async () => {
    const wrapper = await mountAsRole('ACCOUNTS');

    expect(wrapper.find('[data-testid="nav-schools"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-campuses"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-academic-sessions"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-classes"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-sections"]').exists()).toBe(false);
  });

  it('shows the People CRUD nav links (Teachers/Parents/Students) for a SUPER_ADMIN role', async () => {
    const wrapper = await mountAsRole('SUPER_ADMIN');

    expect(wrapper.find('[data-testid="nav-teachers"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-teachers"]').attributes('href')).toBe('/admin/teachers');
    expect(wrapper.find('[data-testid="nav-parents"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-parents"]').attributes('href')).toBe('/admin/parents');
    expect(wrapper.find('[data-testid="nav-students"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-students"]').attributes('href')).toBe('/admin/students');
  });

  it('shows the People CRUD nav links (Teachers/Parents/Students) for a SCHOOL_ADMIN role', async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');

    expect(wrapper.find('[data-testid="nav-teachers"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-teachers"]').attributes('href')).toBe('/admin/teachers');
    expect(wrapper.find('[data-testid="nav-parents"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-parents"]').attributes('href')).toBe('/admin/parents');
    expect(wrapper.find('[data-testid="nav-students"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-students"]').attributes('href')).toBe('/admin/students');
  });

  it('hides the People CRUD nav links (Teachers/Parents/Students) for an ACCOUNTS role', async () => {
    const wrapper = await mountAsRole('ACCOUNTS');

    expect(wrapper.find('[data-testid="nav-teachers"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-parents"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-students"]').exists()).toBe(false);
  });

  it('hides the People CRUD nav links (Teachers/Parents/Students) for a TEACHER role', async () => {
    const wrapper = await mountAsRole('TEACHER');

    expect(wrapper.find('[data-testid="nav-teachers"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-parents"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-students"]').exists()).toBe(false);
  });

  it('hides nav-leave for an ACCOUNTS role', async () => {
    const wrapper = await mountAsRole('ACCOUNTS');

    expect(wrapper.find('[data-testid="nav-fees"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-leave"]').exists()).toBe(false);
  });

  it('hides nav-circulars and nav-timetable for an ACCOUNTS role (fixes the route/nav mismatch bug)', async () => {
    const wrapper = await mountAsRole('ACCOUNTS');

    expect(wrapper.find('[data-testid="nav-circulars"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-timetable"]').exists()).toBe(false);
    // Fees and Messages have no such restriction and should still show.
    expect(wrapper.find('[data-testid="nav-fees"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-messages"]').exists()).toBe(true);
  });

  it('shows nav-circulars and nav-timetable for a SCHOOL_ADMIN role', async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');

    expect(wrapper.find('[data-testid="nav-circulars"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="nav-timetable"]').exists()).toBe(true);
  });

  it('shows a role-initials avatar and a notifications bell in the topbar', async () => {
    const wrapper = await mountAsRole('ACCOUNTS');

    expect(wrapper.find('[data-testid="avatar"]').text()).toBe('AC');
    expect(wrapper.find('[data-testid="notifications"]').exists()).toBe(true);
  });

  it('highlights the active nav item with the router-link-active class', async () => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.role = 'SCHOOL_ADMIN';
    auth.accessToken = 'token-1';
    const router = makeRouter();
    await router.push('/admin');
    await router.isReady();
    const wrapper = mount(AppShell, { global: { plugins: [router] } });

    expect(wrapper.find('[data-testid="nav-dashboard"]').classes()).toContain('router-link-active');
  });

  it('logs out and returns to /login when the logout control is used', async () => {
    const wrapper = await mountAsRole('TEACHER');
    const auth = useAuthStore();

    await wrapper.find('[data-testid="logout"]').trigger('click');

    expect(auth.isAuthenticated).toBe(false);
  });

  it('opens a dropdown of notifications, marks one read, and navigates on click', async () => {
    vi.mocked(api.listNotifications).mockResolvedValue([
      {
        id: 'n1',
        type: 'message',
        title: 'New message',
        body: 'Hi there',
        entityRef: 'conv-1',
        readAt: null,
        createdAt: '2026-08-29T00:00:00.000Z',
      },
    ]);
    const wrapper = await mountAsRole('TEACHER');

    expect(wrapper.find('[data-testid="notif-badge"]').text()).toBe('1');

    await wrapper.find('[data-testid="notifications"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="notif-dropdown"]').text()).toContain('New message');

    await wrapper.find('[data-testid="notif-item-n1"]').trigger('click');
    await flushPromises();

    expect(api.markNotificationRead).toHaveBeenCalledWith(expect.any(String), 'n1');
  });

  it('"mark all read" clears every unread notification', async () => {
    vi.mocked(api.listNotifications).mockResolvedValue([
      {
        id: 'n1',
        type: 'message',
        title: 'New message',
        body: 'Hi there',
        entityRef: 'conv-1',
        readAt: null,
        createdAt: '2026-08-29T00:00:00.000Z',
      },
    ]);
    const wrapper = await mountAsRole('TEACHER');

    await wrapper.find('[data-testid="notifications"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="notif-mark-all-read"]').trigger('click');
    await flushPromises();

    expect(api.markAllNotificationsRead).toHaveBeenCalledWith('token-1');
  });

  it('still navigates when marking a notification read fails', async () => {
    vi.mocked(api.listNotifications).mockResolvedValue([
      {
        id: 'n1',
        type: 'message',
        title: 'New message',
        body: 'Hi there',
        entityRef: 'conv-1',
        readAt: null,
        createdAt: '2026-08-29T00:00:00.000Z',
      },
    ]);
    vi.mocked(api.markNotificationRead).mockRejectedValueOnce(new Error('expired token'));
    const wrapper = await mountAsRole('TEACHER');

    await wrapper.find('[data-testid="notifications"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="notif-item-n1"]').trigger('click');
    await flushPromises();

    expect(wrapper.vm.$router.currentRoute.value.path).toBe('/teacher/messages');
  });

  it('surfaces an error but does not throw when "mark all read" fails', async () => {
    vi.mocked(api.listNotifications).mockResolvedValue([
      {
        id: 'n1',
        type: 'message',
        title: 'New message',
        body: 'Hi there',
        entityRef: 'conv-1',
        readAt: null,
        createdAt: '2026-08-29T00:00:00.000Z',
      },
    ]);
    vi.mocked(api.markAllNotificationsRead).mockRejectedValueOnce(new Error('network error'));
    const wrapper = await mountAsRole('TEACHER');

    await wrapper.find('[data-testid="notifications"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="notif-mark-all-read"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="notif-error"]').exists()).toBe(true);
  });

  it("carries the notification's conversation id through as a query param, for the Messages view to open it directly", async () => {
    vi.mocked(api.listNotifications).mockResolvedValue([
      {
        id: 'n1',
        type: 'message',
        title: 'New message',
        body: 'Hi there',
        entityRef: 'conv-1',
        readAt: null,
        createdAt: '2026-08-29T00:00:00.000Z',
      },
    ]);
    const wrapper = await mountAsRole('TEACHER');

    await wrapper.find('[data-testid="notifications"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="notif-item-n1"]').trigger('click');
    await flushPromises();

    expect(wrapper.vm.$router.currentRoute.value.path).toBe('/teacher/messages');
    expect(wrapper.vm.$router.currentRoute.value.query.conversationId).toBe('conv-1');
  });

  it('falls back to the home route when a notification type does not match the caller role', async () => {
    vi.mocked(api.listNotifications).mockResolvedValue([
      {
        id: 'n1',
        type: 'circular',
        title: 'New circular',
        body: 'Read this',
        entityRef: 'circ-1',
        readAt: null,
        createdAt: '2026-08-29T00:00:00.000Z',
      },
    ]);
    const wrapper = await mountAsRole('ACCOUNTS');

    await wrapper.find('[data-testid="notifications"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="notif-item-n1"]').trigger('click');
    await flushPromises();

    expect(wrapper.vm.$router.currentRoute.value.path).toBe('/admin');
  });
});

describe('AppShell (breadcrumb)', () => {
  it("renders the current route's meta.title in the breadcrumb", async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');
    await wrapper.vm.$router.push('/admin');
    await flushPromises();

    expect(wrapper.find('[data-testid="breadcrumb"]').text()).toBe('Dashboard');
  });
});

describe('AppShell (two-tier notifications)', () => {
  it('shows a dot, not a number, when only non-message unread notifications exist', async () => {
    vi.mocked(api.listNotifications).mockResolvedValue([
      {
        id: 'n1',
        type: 'circular',
        title: 'New circular',
        body: 'Read this',
        entityRef: 'circ-1',
        readAt: null,
        createdAt: '2026-08-29T00:00:00.000Z',
      },
    ]);
    const wrapper = await mountAsRole('SCHOOL_ADMIN');

    expect(wrapper.find('[data-testid="notif-badge"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="notif-dot"]').exists()).toBe(true);
  });

  it('shows the numeric badge (not a dot) when at least one message is unread, even alongside ambient unread', async () => {
    vi.mocked(api.listNotifications).mockResolvedValue([
      {
        id: 'n1',
        type: 'circular',
        title: 'New circular',
        body: 'Read this',
        entityRef: 'circ-1',
        readAt: null,
        createdAt: '2026-08-29T00:00:00.000Z',
      },
      {
        id: 'n2',
        type: 'message',
        title: 'New message',
        body: 'Hi',
        entityRef: 'conv-1',
        readAt: null,
        createdAt: '2026-08-29T00:00:00.000Z',
      },
    ]);
    const wrapper = await mountAsRole('SCHOOL_ADMIN');

    expect(wrapper.find('[data-testid="notif-badge"]').text()).toBe('1');
    expect(wrapper.find('[data-testid="notif-dot"]').exists()).toBe(false);
  });

  it('shows neither badge nor dot when there is no unread notification', async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');

    expect(wrapper.find('[data-testid="notif-badge"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="notif-dot"]').exists()).toBe(false);
  });
});

describe('AppShell (theme toggle)', () => {
  it('defaults to no explicit data-theme attribute (follows OS default)', async () => {
    await mountAsRole('SCHOOL_ADMIN');

    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('sets data-theme="dark" and persists it on first click', async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');

    await wrapper.find('[data-testid="theme-toggle"]').trigger('click');

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('seeds.theme')).toBe('dark');
  });

  it('toggles back to light on a second click', async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');

    await wrapper.find('[data-testid="theme-toggle"]').trigger('click');
    await wrapper.find('[data-testid="theme-toggle"]').trigger('click');

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('seeds.theme')).toBe('light');
  });

  it('reads a persisted preference back on mount', async () => {
    localStorage.setItem('seeds.theme', 'dark');

    await mountAsRole('SCHOOL_ADMIN');

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});

describe('AppShell (command palette)', () => {
  it('opens the palette from the topbar trigger', async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');

    expect(wrapper.find('[data-testid="cmdk-overlay"]').exists()).toBe(false);

    await wrapper.find('[data-testid="cmdk-trigger"]').trigger('click');

    expect(wrapper.find('[data-testid="cmdk-overlay"]').exists()).toBe(true);
  });

  it('opens the palette on Ctrl+K and closes it on a second Ctrl+K', async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    await flushPromises();
    expect(wrapper.find('[data-testid="cmdk-overlay"]').exists()).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    await flushPromises();
    expect(wrapper.find('[data-testid="cmdk-overlay"]').exists()).toBe(false);
  });

  it("only offers actions the current role can perform (e.g. no 'Add student' for ACCOUNTS)", async () => {
    const wrapper = await mountAsRole('ACCOUNTS');

    await wrapper.find('[data-testid="cmdk-trigger"]').trigger('click');

    expect(wrapper.find('[data-testid="cmdk-action-add-student"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="cmdk-action-issue-vouchers"]').exists()).toBe(true);
  });

  it("navigates to /admin/students with ?focus=gr-number for the 'Add student' action", async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');

    await wrapper.find('[data-testid="cmdk-trigger"]').trigger('click');
    await wrapper.find('[data-testid="cmdk-action-add-student"]').trigger('click');
    await flushPromises();

    expect(wrapper.vm.$router.currentRoute.value.path).toBe('/admin/students');
    expect(wrapper.vm.$router.currentRoute.value.query.focus).toBe('gr-number');
  });
});
```

- [ ] **Step 3: Run the full staff-console test suite**

Run: `cd staff-console && npm test -- --run`
Expected: PASS — every existing test plus the new breadcrumb/two-tier-notification/theme-toggle/
command-palette tests above.

- [ ] **Step 4: Type-check and lint**

Run: `cd staff-console && npm run build && npm run lint`
Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add staff-console/src/components/AppShell.vue staff-console/src/components/AppShell.spec.ts
git commit -m "feat: rebuild AppShell with grouped nav, breadcrumb, command palette, two-tier notifications, theme toggle

Also fixes a pre-existing bug: the Circulars and Timetable nav links were shown to ACCOUNTS
even though their routes require SCHOOL_ADMIN/SUPER_ADMIN, silently bouncing that role back
to /admin on click. Both are now gated by the same role check as their route guard."
```

---

### Task 7: Manual smoke test + full verification

**Files:** none (verification only).

- [ ] **Step 1: Start the backend and staff console**

Run (separate terminals): `cd backend && npm run start:dev` (port 3000), then
`cd staff-console && npm run dev` (port 5173).

- [ ] **Step 2: Log in as `admin@seeds.edu.pk` and verify the redesigned shell**

Open `http://localhost:5173`, log in as `SCHOOL_ADMIN`. Confirm:
- Sidebar shows grouped labels (Overview / People / Operations / Communication — no Org Structure
  group for this role) and every link still routes correctly.
- Breadcrumb in the topbar reads "Dashboard", and updates when navigating to another screen (e.g.
  "Students").
- `Ctrl+K` opens the command palette; typing "student" filters to the Students go-to item and the
  "Add student" action; clicking "Add student" navigates to `/admin/students` with the GR-number
  input focused (visible caret/outline in the input).
- The notification bell shows a dot (not a number) if only non-message notifications are unread,
  and a number if a message is unread — trigger both by using the app's existing seed data or by
  sending a test message from another logged-in account.
- Clicking the theme toggle switches the whole page (topbar, sidebar, content, command palette,
  every existing screen's cards/tables/forms) to dark colors with no unstyled white boxes anywhere
  — check at least the Students table's inline-add-form inputs and the Fees view's selects, since
  those previously had no explicit background color.
- Reload the page — the dark theme choice persists.

- [ ] **Step 3: Log in as `accounts@seeds.edu.pk` (ACCOUNTS role) and verify the bug fix**

Confirm the sidebar does **not** show Circulars or Timetable, and the command palette's "Go to"
list also excludes them (previously the nav showed both, and clicking either silently bounced back
to `/admin`).

- [ ] **Step 4: Log in as a `TEACHER` account and spot-check**

Confirm the teacher nav (Attendance/Diary/Timetable/Messages) still renders exactly as before,
`Ctrl+K` still opens a palette scoped to those three real routes, and the theme toggle still works
on the teacher's screens too.

- [ ] **Step 5: Run the full test suite, lint, and build one more time**

Run: `cd staff-console && npm test -- --run && npm run lint && npm run build`
Expected: all green.

- [ ] **Step 6: Update `PROJECT-STATUS.md`**

Add a new section (following the existing format of every prior entry) documenting this pass:
phases completed, the Circulars/Timetable bug fix, test counts, and — since the per-screen state
machine/status-pill/skeleton work was deliberately scoped out of this plan — a `Next step` note
pointing at the still-to-be-written per-screen plan, so the project's own living checklist stays
accurate (matching this file's own stated convention: "update this file... whenever a feature
lands or scope changes").
