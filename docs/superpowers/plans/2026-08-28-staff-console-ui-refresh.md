# Staff-Console UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the staff-console's Dashboard, Attendance roster, AppShell chrome, and a new Fee Reconciliation screen against the existing SchoolOS design-system tokens, following the layouts in `docs/wireframe/`.

**Architecture:** Pure Vue 3 SFC + scoped CSS changes on top of the existing token system in `staff-console/src/assets/base.css` — no new npm dependencies. Dashboard and Fee Reconciliation read from small local mock-data modules (`lib/mockDashboard.ts`, `lib/mockFees.ts`) instead of a real backend, since neither has a supporting API yet; both are isolated behind a single function so a later backend-wiring pass is a one-function swap, matching the pattern `AttendanceView.vue` already uses for its real `api.*` calls.

**Tech Stack:** Vue 3 (`<script setup>`, Composition API), Vue Router 4, Pinia, Vitest + `@vue/test-utils`, plain CSS custom properties (no Tailwind, no CSS framework).

**Spec:** `build/docs/superpowers/specs/2026-08-28-wireframe-css-refresh-design.md`

## Global Constraints

- No new npm dependencies — no charting library, no icon library, no CSS framework. Everything renders with hand-written SVG/CSS against existing tokens.
- New design tokens (added to `staff-console/src/assets/base.css`, and mirrored on the Flutter side in the companion parent-app plan): `--color-present: #15803D` (white text on this background measures ~5.0:1 contrast, passes WCAG AA) and `--color-late: #B45309` (white text on this background measures ~5.0:1 contrast, passes WCAG AA). `--color-destructive` (`#DC2626`, already in the token file) covers Absent/Exception — no new red token.
- Every new interactive element gets a `data-testid` attribute, following the existing convention (`data-testid="section-select"`, `data-testid="save-attendance"`, etc. in `AttendanceView.vue`).
- No backend/API changes in this plan. Dashboard and Fee Reconciliation are built against local mock data. The real `AttendanceStatus` enum (`PRESENT | ABSENT | LATE | LEAVE | HOLIDAY`) stays the source of truth for Attendance — the UI surfaces P/A/L as the primary segmented control plus a Leave/Holiday overflow, it never drops the other two states.
- Tests use Vitest + `@vue/test-utils`, `data-testid` selectors, and `vi.mock('../lib/api', ...)` for API-backed views — matching `AttendanceView.spec.ts`'s existing pattern exactly.
- `staff-console/src/components/AppShell.vue`, `AdminHomeView.vue`, `AttendanceView.vue` currently exist and are modified, not replaced wholesale — every task below shows the full new file content but preserves existing behavior (role gating, existing API calls, existing test IDs) unless the task explicitly says otherwise.

---

### Task 1: Design tokens

**Files:**
- Modify: `staff-console/src/assets/base.css`

**Interfaces:**
- Produces: `--color-present`, `--color-late` CSS custom properties, usable by every later task in this plan.

- [ ] **Step 1: Add the two new tokens**

In `staff-console/src/assets/base.css`, inside the existing `:root { ... }` block, right after the `--color-destructive` line:

```css
  --color-destructive: #dc2626;
  --color-present: #15803d;
  --color-late: #b45309;
  --color-ring: #0369a1;
```

(The file already has `--color-destructive` then `--color-ring` adjacent — insert the two new lines between them.)

- [ ] **Step 2: Verify the app still builds**

Run: `cd staff-console && npm run build-only`
Expected: build succeeds (this is a pure CSS addition, nothing should break).

- [ ] **Step 3: Commit**

```bash
git add staff-console/src/assets/base.css
git commit -m "style: add present/late status color tokens"
```

---

### Task 2: New icons (bell, warning)

**Files:**
- Modify: `staff-console/src/components/AppIcon.vue`
- Test: `staff-console/src/components/AppIcon.spec.ts` (new file)

**Interfaces:**
- Produces: `AppIcon` accepts `name="bell"` and `name="warning"` in addition to its existing icon names.

- [ ] **Step 1: Write the failing test**

Create `staff-console/src/components/AppIcon.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AppIcon from './AppIcon.vue';

const ICON_NAMES = [
  'home',
  'calendar',
  'notebook',
  'clock',
  'chat',
  'users',
  'user-circle',
  'chalkboard',
  'grid',
  'megaphone',
  'receipt',
  'logout',
  'bell',
  'warning',
] as const;

describe('AppIcon', () => {
  it.each(ICON_NAMES)('renders an svg for "%s"', (name) => {
    const wrapper = mount(AppIcon, { props: { name } });
    expect(wrapper.find('svg').exists()).toBe(true);
  });

  it('defaults to a 20px square icon and applies a custom size', () => {
    const wrapper = mount(AppIcon, { props: { name: 'bell' } });
    expect(wrapper.attributes('width')).toBe('20');

    const sized = mount(AppIcon, { props: { name: 'bell', size: 32 } });
    expect(sized.attributes('width')).toBe('32');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd staff-console && npx vitest run src/components/AppIcon.spec.ts`
Expected: FAIL — the `'bell'` and `'warning'` cases render no `<svg>` content matching (TypeScript will also flag `name: 'bell'` as not assignable to `IconName` since it's not yet in the union).

- [ ] **Step 3: Add the two icons**

In `staff-console/src/components/AppIcon.vue`, extend the `IconName` union (add after `'logout'`):

```ts
type IconName =
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
  | 'warning';
```

Add two new `<template v-else-if>` branches, right after the existing `'logout'` branch and before the closing `</svg>`:

```html
    <template v-else-if="name === 'bell'">
      <path d="M12 3a5 5 0 0 0-5 5v3.5c0 .8-.3 1.6-.9 2.2L5 15h14l-1.1-1.3a3.2 3.2 0 0 1-.9-2.2V8a5 5 0 0 0-5-5Z" />
      <path d="M9.5 18a2.5 2.5 0 0 0 5 0" />
    </template>
    <template v-else-if="name === 'warning'">
      <path d="M12 3.5 21 19H3L12 3.5Z" />
      <path d="M12 10v4M12 16.5v.01" />
    </template>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd staff-console && npx vitest run src/components/AppIcon.spec.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add staff-console/src/components/AppIcon.vue staff-console/src/components/AppIcon.spec.ts
git commit -m "feat: add bell and warning icons to AppIcon"
```

---

### Task 3: Shared formatting helpers

**Files:**
- Create: `staff-console/src/lib/format.ts`
- Test: `staff-console/src/lib/format.spec.ts`

**Interfaces:**
- Produces: `formatPkrShort(amount: number): string`, `formatPkrFull(amount: number): string`, `initialsFromName(name: string): string`, `roleInitials(role: string | null): string` — consumed by Tasks 4, 6, 7, 8.

- [ ] **Step 1: Write the failing test**

Create `staff-console/src/lib/format.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatPkrShort, formatPkrFull, initialsFromName, roleInitials } from './format';

describe('formatPkrShort', () => {
  it('formats millions with one decimal place', () => {
    expect(formatPkrShort(2_400_000)).toBe('2.4M');
  });

  it('formats thousands with no decimal place', () => {
    expect(formatPkrShort(680_000)).toBe('680K');
  });

  it('leaves small amounts as plain numbers', () => {
    expect(formatPkrShort(450)).toBe('450');
  });
});

describe('formatPkrFull', () => {
  it('adds thousands separators', () => {
    expect(formatPkrFull(18450)).toBe('18,450');
  });
});

describe('initialsFromName', () => {
  it('takes the first letter of the first two words', () => {
    expect(initialsFromName('Ali Khan')).toBe('AK');
  });

  it('takes the first two letters of a single word', () => {
    expect(initialsFromName('Eshaal')).toBe('ES');
  });

  it('falls back to "?" for an empty name', () => {
    expect(initialsFromName('   ')).toBe('?');
  });
});

describe('roleInitials', () => {
  it('maps each known staff role to a two-letter code', () => {
    expect(roleInitials('TEACHER')).toBe('TR');
    expect(roleInitials('SCHOOL_ADMIN')).toBe('SA');
    expect(roleInitials('ACCOUNTS')).toBe('AC');
    expect(roleInitials('SUPER_ADMIN')).toBe('SU');
  });

  it('falls back to "?" for an unknown or null role', () => {
    expect(roleInitials(null)).toBe('?');
    expect(roleInitials('SOMETHING_ELSE')).toBe('?');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd staff-console && npx vitest run src/lib/format.spec.ts`
Expected: FAIL — `./format` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

Create `staff-console/src/lib/format.ts`:

```ts
export function formatPkrShort(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}K`;
  return `${amount}`;
}

export function formatPkrFull(amount: number): string {
  return new Intl.NumberFormat('en-US').format(amount);
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const ROLE_INITIALS: Record<string, string> = {
  TEACHER: 'TR',
  SCHOOL_ADMIN: 'SA',
  ACCOUNTS: 'AC',
  SUPER_ADMIN: 'SU',
};

export function roleInitials(role: string | null): string {
  if (!role) return '?';
  return ROLE_INITIALS[role] ?? '?';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd staff-console && npx vitest run src/lib/format.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add staff-console/src/lib/format.ts staff-console/src/lib/format.spec.ts
git commit -m "feat: add formatPkrShort/formatPkrFull/initialsFromName/roleInitials helpers"
```

---

### Task 4: AppShell chrome — Dashboard nav link, notification bell, avatar, active-link styling

**Files:**
- Modify: `staff-console/src/components/AppShell.vue`
- Modify: `staff-console/src/components/AppShell.spec.ts`

**Interfaces:**
- Consumes: `Icon` (`AppIcon.vue`, Task 2) with `name="bell"`; `roleInitials` (`lib/format.ts`, Task 3).
- Produces: `data-testid="nav-dashboard"` RouterLink to `/admin`, `data-testid="notifications"` bell button, `data-testid="avatar"` initials badge — consumed visually by every admin-role screen via `<AppShell>`.

- [ ] **Step 1: Update the test to expect the new chrome (write this before touching the component)**

Replace `staff-console/src/components/AppShell.spec.ts` in full:

```ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import AppShell from './AppShell.vue';
import { useAuthStore } from '../stores/auth';

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: { template: '<div>login</div>' } },
      { path: '/teacher', name: 'teacher-home', component: { template: '<div>teacher</div>' } },
      { path: '/admin', name: 'admin-home', component: { template: '<div>admin</div>' } },
      { path: '/admin/fees', name: 'admin-fees', component: { template: '<div>fees</div>' } },
    ],
  });
}

async function mountAsRole(role: string) {
  setActivePinia(createPinia());
  const auth = useAuthStore();
  auth.role = role;
  const router = makeRouter();
  await router.push('/login');
  await router.isReady();
  return mount(AppShell, { global: { plugins: [router] } });
}

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
  });

  it('shows Admin/Accounts nav items for a SCHOOL_ADMIN role, with no teacher-only items', async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');

    expect(wrapper.text()).toContain('Dashboard');
    expect(wrapper.text()).toContain('Students');
    expect(wrapper.text()).toContain('Parents');
    expect(wrapper.text()).toContain('Teachers');
    expect(wrapper.text()).toContain('Classes');
    expect(wrapper.text()).toContain('Timetable');
    expect(wrapper.text()).toContain('Circulars');
    expect(wrapper.text()).toContain('Fees');

    expect(wrapper.find('[data-testid="nav-attendance"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-diary"]').exists()).toBe(false);

    expect(wrapper.find('[data-testid="nav-dashboard"]').attributes('href')).toBe('/admin');
    expect(wrapper.find('[data-testid="nav-fees"]').attributes('href')).toBe('/admin/fees');
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd staff-console && npx vitest run src/components/AppShell.spec.ts`
Expected: FAIL — no `nav-dashboard`, `avatar`, or `notifications` elements exist yet, and the Fees link is a plain `<a href="#">` not a routed link to `/admin/fees`.

- [ ] **Step 3: Update AppShell.vue**

Replace `staff-console/src/components/AppShell.vue` in full:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import Icon from './AppIcon.vue';
import { roleInitials } from '../lib/format';

const auth = useAuthStore();
const router = useRouter();

const isTeacher = computed(() => auth.role === 'TEACHER');
const isAdmin = computed(() => ['SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'].includes(auth.role ?? ''));
const avatarInitials = computed(() => roleInitials(auth.role));

async function onLogout() {
  auth.logout();
  await router.push({ name: 'login' });
}
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <span class="brand">SchoolOS Staff Console</span>
      <div class="topbar-actions">
        <button data-testid="notifications" class="icon-button" aria-label="Notifications">
          <Icon name="bell" :size="18" />
        </button>
        <span data-testid="avatar" class="avatar" aria-hidden="true">{{ avatarInitials }}</span>
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
          <a data-testid="nav-messages" href="#"><Icon name="chat" />Messages</a>
        </template>
        <template v-else-if="isAdmin">
          <RouterLink data-testid="nav-dashboard" to="/admin"><Icon name="home" />Dashboard</RouterLink>
          <a data-testid="nav-students" href="#"><Icon name="users" />Students</a>
          <a data-testid="nav-parents" href="#"><Icon name="user-circle" />Parents</a>
          <a data-testid="nav-teachers" href="#"><Icon name="chalkboard" />Teachers</a>
          <a data-testid="nav-classes" href="#"><Icon name="grid" />Classes</a>
          <a data-testid="nav-timetable" href="#"><Icon name="clock" />Timetable</a>
          <RouterLink data-testid="nav-circulars" to="/admin/circulars"><Icon name="megaphone" />Circulars</RouterLink>
          <RouterLink data-testid="nav-fees" to="/admin/fees"><Icon name="receipt" />Fees</RouterLink>
        </template>
      </nav>

      <main class="content">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--topbar-height);
  padding: 0 var(--space-4);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.brand {
  font-weight: 700;
  color: var(--color-primary);
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
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
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd staff-console && npx vitest run src/components/AppShell.spec.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add staff-console/src/components/AppShell.vue staff-console/src/components/AppShell.spec.ts
git commit -m "feat: add Dashboard nav link, notification bell, avatar, and active-link styling to AppShell"
```

---

### Task 5: Trends sparkline component + mock dashboard data

**Files:**
- Create: `staff-console/src/components/TrendsSparkline.vue`
- Test: `staff-console/src/components/TrendsSparkline.spec.ts`
- Create: `staff-console/src/lib/mockDashboard.ts`
- Test: `staff-console/src/lib/mockDashboard.spec.ts`

**Interfaces:**
- Produces: `TrendsSparkline` component with props `{ labels: string[]; series: { label: string; color: string; values: number[]; dashed?: boolean }[] }` (values must already be normalized to a 0–100 scale by the caller). `getMockDashboardSummary(): DashboardSummary` and the `DashboardSummary` type — consumed by Task 6.

- [ ] **Step 1: Write the failing test for the mock data**

Create `staff-console/src/lib/mockDashboard.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getMockDashboardSummary } from './mockDashboard';

describe('getMockDashboardSummary', () => {
  it('returns the primary KPI figures and a 7-day trend', () => {
    const summary = getMockDashboardSummary();

    expect(summary.studentsTotal).toBe(1284);
    expect(summary.presentTodayPercent).toBe(93.5);
    expect(summary.feesCollectedPkr).toBe(2_400_000);
    expect(summary.feesOutstandingPkr).toBe(680_000);
    expect(summary.atRiskStudents).toBe(37);
    expect(summary.absentToday).toBe(84);
    expect(summary.teachersAbsent).toBe(6);
    expect(summary.weeklyTrend).toHaveLength(7);
    expect(summary.weeklyTrend[0].day).toBe('Mon');
    expect(summary.recentAlerts.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd staff-console && npx vitest run src/lib/mockDashboard.spec.ts`
Expected: FAIL — `./mockDashboard` doesn't exist yet.

- [ ] **Step 3: Write the mock data module**

Create `staff-console/src/lib/mockDashboard.ts`:

```ts
export interface WeeklyTrendPoint {
  day: string;
  attendancePercent: number;
  feesCollectedPkr: number;
}

export interface DashboardAlert {
  message: string;
  timeAgo: string;
}

export interface DashboardSummary {
  studentsTotal: number;
  presentTodayPercent: number;
  feesCollectedPkr: number;
  feesOutstandingPkr: number;
  atRiskStudents: number;
  absentToday: number;
  teachersAbsent: number;
  weeklyTrend: WeeklyTrendPoint[];
  recentAlerts: DashboardAlert[];
}

export function getMockDashboardSummary(): DashboardSummary {
  return {
    studentsTotal: 1284,
    presentTodayPercent: 93.5,
    feesCollectedPkr: 2_400_000,
    feesOutstandingPkr: 680_000,
    atRiskStudents: 37,
    absentToday: 84,
    teachersAbsent: 6,
    weeklyTrend: [
      { day: 'Mon', attendancePercent: 88, feesCollectedPkr: 320_000 },
      { day: 'Tue', attendancePercent: 95, feesCollectedPkr: 410_000 },
      { day: 'Wed', attendancePercent: 82, feesCollectedPkr: 360_000 },
      { day: 'Thu', attendancePercent: 92, feesCollectedPkr: 460_000 },
      { day: 'Fri', attendancePercent: 88, feesCollectedPkr: 300_000 },
      { day: 'Sat', attendancePercent: 95, feesCollectedPkr: 410_000 },
      { day: 'Sun', attendancePercent: 90, feesCollectedPkr: 360_000 },
    ],
    recentAlerts: [
      { message: '12 students absent 3+ days', timeAgo: '10m ago' },
      { message: 'Fee reminder failed for 18 parents', timeAgo: '45m ago' },
      { message: 'Exam marks pending for 2 classes', timeAgo: '2h ago' },
    ],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd staff-console && npx vitest run src/lib/mockDashboard.spec.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing test for the sparkline component**

Create `staff-console/src/components/TrendsSparkline.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import TrendsSparkline from './TrendsSparkline.vue';

describe('TrendsSparkline', () => {
  it('draws one polyline per series and a legend entry per series', () => {
    const wrapper = mount(TrendsSparkline, {
      props: {
        labels: ['Mon', 'Tue', 'Wed'],
        series: [
          { label: 'Attendance %', color: '#0f172a', values: [0, 50, 100] },
          { label: 'Fees Collected (PKR)', color: '#64748b', dashed: true, values: [100, 0, 50] },
        ],
      },
    });

    const polylines = wrapper.findAll('polyline');
    expect(polylines).toHaveLength(2);
    // y is inverted (0 -> bottom/100, 100 -> top/0) so a chart reads bottom-to-top like the wireframe
    expect(polylines[0].attributes('points')).toBe('0,100 50,50 100,0');

    expect(wrapper.text()).toContain('Attendance %');
    expect(wrapper.text()).toContain('Fees Collected (PKR)');
    expect(wrapper.findAll('.sparkline-x-label').map((n) => n.text())).toEqual(['Mon', 'Tue', 'Wed']);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd staff-console && npx vitest run src/components/TrendsSparkline.spec.ts`
Expected: FAIL — component doesn't exist yet.

- [ ] **Step 7: Write the component**

Create `staff-console/src/components/TrendsSparkline.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';

interface SparklineSeries {
  label: string;
  color: string;
  values: number[];
  dashed?: boolean;
}

const props = defineProps<{
  labels: string[];
  series: SparklineSeries[];
}>();

const lines = computed(() =>
  props.series.map((s) => {
    const step = s.values.length > 1 ? 100 / (s.values.length - 1) : 0;
    const points = s.values.map((v, i) => ({ x: i * step, y: 100 - v }));
    return {
      ...s,
      pointsAttr: points.map((p) => `${p.x},${p.y}`).join(' '),
      points,
    };
  }),
);
</script>

<template>
  <div class="sparkline">
    <div class="sparkline-chart">
      <div class="sparkline-y-axis">
        <span>100%</span>
        <span>50%</span>
        <span>0%</span>
      </div>
      <svg class="sparkline-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline
          v-for="line in lines"
          :key="line.label"
          fill="none"
          :stroke="line.color"
          stroke-width="1.5"
          :stroke-dasharray="line.dashed ? '2,2' : undefined"
          :points="line.pointsAttr"
        />
        <template v-for="line in lines" :key="`dots-${line.label}`">
          <circle
            v-for="(p, i) in line.points"
            :key="`${line.label}-${i}`"
            :cx="p.x"
            :cy="p.y"
            r="2"
            :fill="line.color"
          />
        </template>
      </svg>
    </div>
    <div class="sparkline-x-axis">
      <span v-for="label in labels" :key="label" class="sparkline-x-label">{{ label }}</span>
    </div>
    <div class="sparkline-legend">
      <span v-for="line in lines" :key="line.label" class="legend-item">
        <span class="legend-swatch" :style="{ background: line.color }" />
        {{ line.label }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.sparkline {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.sparkline-chart {
  display: flex;
  gap: var(--space-2);
  height: 200px;
}
.sparkline-y-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-size: var(--font-size-xs);
  color: var(--color-muted);
  padding-right: var(--space-2);
  border-right: 1px solid var(--color-border);
}
.sparkline-svg {
  flex: 1;
  width: 100%;
  height: 100%;
}
.sparkline-x-axis {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-xs);
  color: var(--color-muted);
  padding-left: 3rem;
}
.sparkline-legend {
  display: flex;
  gap: var(--space-4);
  padding-left: 3rem;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
  color: var(--color-muted);
}
.legend-swatch {
  width: 0.75rem;
  height: 0.15rem;
  display: inline-block;
}
</style>
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd staff-console && npx vitest run src/components/TrendsSparkline.spec.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add staff-console/src/components/TrendsSparkline.vue staff-console/src/components/TrendsSparkline.spec.ts staff-console/src/lib/mockDashboard.ts staff-console/src/lib/mockDashboard.spec.ts
git commit -m "feat: add TrendsSparkline component and mock dashboard summary data"
```

---

### Task 6: Dashboard (`AdminHomeView.vue`)

**Files:**
- Modify: `staff-console/src/views/AdminHomeView.vue`
- Test: `staff-console/src/views/AdminHomeView.spec.ts` (new file)

**Interfaces:**
- Consumes: `getMockDashboardSummary` (Task 5), `TrendsSparkline` (Task 5), `formatPkrShort` (Task 3), `Icon` (Task 2).

- [ ] **Step 1: Write the failing test**

Create `staff-console/src/views/AdminHomeView.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import AdminHomeView from './AdminHomeView.vue';
import { useAuthStore } from '../stores/auth';

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: { template: '<div>login</div>' } },
      { path: '/admin', name: 'admin-home', component: AdminHomeView },
      { path: '/admin/fees', name: 'admin-fees', component: { template: '<div>fees</div>' } },
    ],
  });
}

async function mountView() {
  setActivePinia(createPinia());
  const auth = useAuthStore();
  auth.role = 'SCHOOL_ADMIN';
  const router = makeRouter();
  await router.push('/admin');
  await router.isReady();
  return mount(AdminHomeView, { global: { plugins: [router] } });
}

describe('AdminHomeView (Dashboard)', () => {
  it('renders the primary and secondary KPI figures', async () => {
    const wrapper = await mountView();
    const text = wrapper.text();

    expect(text).toContain('1,284');
    expect(text).toContain('93.5%');
    expect(text).toContain('2.4M');
    expect(text).toContain('680K');
    expect(text).toContain('37');
    expect(text).toContain('84');
    expect(text).toContain('6');
  });

  it('renders the trends chart and the recent alerts list', async () => {
    const wrapper = await mountView();

    expect(wrapper.findComponent({ name: 'TrendsSparkline' }).exists()).toBe(true);
    expect(wrapper.text()).toContain('12 students absent 3+ days');
    expect(wrapper.text()).toContain('Fee reminder failed for 18 parents');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd staff-console && npx vitest run src/views/AdminHomeView.spec.ts`
Expected: FAIL — `AdminHomeView.vue` is still the placeholder paragraph.

- [ ] **Step 3: Rewrite AdminHomeView.vue**

Replace `staff-console/src/views/AdminHomeView.vue` in full:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import AppShell from '../components/AppShell.vue';
import Icon from '../components/AppIcon.vue';
import TrendsSparkline from '../components/TrendsSparkline.vue';
import { getMockDashboardSummary } from '../lib/mockDashboard';
import { formatPkrShort } from '../lib/format';

const summary = getMockDashboardSummary();

const trendLabels = computed(() => summary.weeklyTrend.map((d) => d.day));
const maxFees = computed(() => Math.max(...summary.weeklyTrend.map((d) => d.feesCollectedPkr)));
const trendSeries = computed(() => [
  {
    label: 'Attendance %',
    color: 'var(--color-primary)',
    values: summary.weeklyTrend.map((d) => d.attendancePercent),
  },
  {
    label: 'Fees Collected (PKR)',
    color: 'var(--color-muted)',
    dashed: true,
    values: summary.weeklyTrend.map((d) => (d.feesCollectedPkr / maxFees.value) * 100),
  },
]);
</script>

<template>
  <AppShell>
    <div class="dashboard">
      <div class="dashboard-header">
        <h1>Dashboard</h1>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Students</div>
          <div class="stat-value">{{ summary.studentsTotal.toLocaleString() }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Present</div>
          <div class="stat-value">{{ summary.presentTodayPercent }}%</div>
          <div class="stat-hint">Today</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Fees Collected</div>
          <div class="stat-value">
            {{ formatPkrShort(summary.feesCollectedPkr) }} <span class="stat-unit">PKR</span>
          </div>
          <div class="stat-hint">Month to date</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Outstanding</div>
          <div class="stat-value">
            {{ formatPkrShort(summary.feesOutstandingPkr) }} <span class="stat-unit">PKR</span>
          </div>
          <div class="stat-hint">Total</div>
        </div>
      </div>

      <div class="secondary-row">
        <div class="secondary-card">
          <span class="secondary-icon warning"><Icon name="warning" :size="18" /></span>
          <span class="secondary-label">At-risk students</span>
          <span class="secondary-value">{{ summary.atRiskStudents }}</span>
        </div>
        <div class="secondary-card">
          <span class="secondary-icon"><Icon name="user-circle" :size="18" /></span>
          <span class="secondary-label">Absent today</span>
          <span class="secondary-value">{{ summary.absentToday }}</span>
        </div>
        <div class="secondary-card">
          <span class="secondary-icon"><Icon name="users" :size="18" /></span>
          <span class="secondary-label">Teachers absent</span>
          <span class="secondary-value">{{ summary.teachersAbsent }}</span>
        </div>
      </div>

      <div class="lower-grid">
        <div class="trends-panel">
          <h2>Trends <span class="muted">(This Week)</span></h2>
          <TrendsSparkline :labels="trendLabels" :series="trendSeries" />
        </div>

        <div class="alerts-panel">
          <h2>Recent Alerts</h2>
          <ul class="alert-list">
            <li v-for="(alert, i) in summary.recentAlerts" :key="i">
              <span>{{ alert.message }}</span>
              <span class="alert-time">{{ alert.timeAgo }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </AppShell>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 1200px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}
@media (max-width: 1024px) {
  .stat-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 640px) {
  .stat-grid {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-4);
}
.stat-label {
  color: var(--color-muted);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  margin-bottom: var(--space-1);
}
.stat-value {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-primary);
}
.stat-unit {
  font-size: var(--font-size-lg);
  font-weight: 400;
  color: var(--color-muted);
}
.stat-hint {
  color: var(--color-muted);
  font-size: var(--font-size-xs);
  margin-top: var(--space-1);
}

.secondary-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
}
@media (max-width: 768px) {
  .secondary-row {
    grid-template-columns: 1fr;
  }
}
.secondary-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-3) var(--space-4);
}
.secondary-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-sm);
  background: var(--color-muted-bg);
  color: var(--color-muted);
}
.secondary-icon.warning {
  background: color-mix(in srgb, var(--color-destructive) 12%, white);
  color: var(--color-destructive);
}
.secondary-label {
  flex: 1;
  font-weight: 500;
}
.secondary-value {
  font-size: var(--font-size-xl);
  font-weight: 700;
}

.lower-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--space-4);
}
@media (max-width: 1024px) {
  .lower-grid {
    grid-template-columns: 1fr;
  }
}

.trends-panel,
.alerts-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-4);
}
.trends-panel h2,
.alerts-panel h2 {
  font-size: var(--font-size-base);
  margin-bottom: var(--space-4);
}
.muted {
  color: var(--color-muted);
  font-weight: 400;
  font-size: var(--font-size-sm);
}

.alert-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.alert-list li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}
.alert-list li:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.alert-time {
  color: var(--color-muted);
  font-size: var(--font-size-xs);
  white-space: nowrap;
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd staff-console && npx vitest run src/views/AdminHomeView.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add staff-console/src/views/AdminHomeView.vue staff-console/src/views/AdminHomeView.spec.ts
git commit -m "feat: build out the admin Dashboard against mock summary data"
```

---

### Task 7: Attendance roster (`AttendanceView.vue`)

**Files:**
- Modify: `staff-console/src/views/AttendanceView.vue`
- Modify: `staff-console/src/views/AttendanceView.spec.ts`

**Interfaces:**
- Consumes: `initialsFromName` (Task 3).
- Produces: no change to the public shape of the view (still no props), but its internal `data-testid`s change from `status-${id}` (a `<select>`) to `status-${id}-present` / `-absent` / `-late` / `-more` / `-leave` / `-holiday` (buttons) and adds `default-all-present`.

- [ ] **Step 1: Update the test to expect the new roster UI (write before touching the component)**

Replace `staff-console/src/views/AttendanceView.spec.ts` in full:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AttendanceView from './AttendanceView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listSections: vi.fn(),
    sectionStudents: vi.fn(),
    markAttendance: vi.fn(),
  },
}));

describe('AttendanceView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    vi.mocked(api.listSections).mockReset();
    vi.mocked(api.sectionStudents).mockReset();
    vi.mocked(api.markAttendance).mockReset();
  });

  it('loads sections, then students once a section is picked, and marks attendance on save', async () => {
    vi.mocked(api.listSections).mockResolvedValue([
      { id: 'sec-1', name: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
    ]);
    vi.mocked(api.sectionStudents).mockResolvedValue([
      { id: 's1', name: 'Eshaal', grNumber: 'GR-1001' },
    ]);
    vi.mocked(api.markAttendance).mockResolvedValue(undefined);

    const wrapper = mount(AttendanceView);
    await flushPromises();

    expect(wrapper.find('option[value="sec-1"]').exists()).toBe(true);

    await wrapper.find('select[data-testid="section-select"]').setValue('sec-1');
    await flushPromises();

    expect(wrapper.text()).toContain('Eshaal');
    expect(wrapper.find('.roster-avatar').text()).toBe('ES');

    await wrapper.find('[data-testid="status-s1-present"]').trigger('click');
    await wrapper.find('[data-testid="save-attendance"]').trigger('click');
    await flushPromises();

    expect(api.markAttendance).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({ studentId: 's1', status: 'PRESENT' }),
    );
    expect(wrapper.text()).toContain('Saved');
  });

  it('shows an error message if marking attendance fails', async () => {
    vi.mocked(api.listSections).mockResolvedValue([
      { id: 'sec-1', name: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
    ]);
    vi.mocked(api.sectionStudents).mockResolvedValue([
      { id: 's1', name: 'Eshaal', grNumber: 'GR-1001' },
    ]);
    vi.mocked(api.markAttendance).mockRejectedValue(
      new Error('Something went wrong. Please try again.'),
    );

    const wrapper = mount(AttendanceView);
    await flushPromises();
    await wrapper.find('select[data-testid="section-select"]').setValue('sec-1');
    await flushPromises();
    await wrapper.find('[data-testid="status-s1-absent"]').trigger('click');
    await wrapper.find('[data-testid="save-attendance"]').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Something went wrong');
  });

  it('"Default all present" sets every visible student to Present and updates the submit count', async () => {
    vi.mocked(api.listSections).mockResolvedValue([
      { id: 'sec-1', name: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
    ]);
    vi.mocked(api.sectionStudents).mockResolvedValue([
      { id: 's1', name: 'Ali Khan', grNumber: 'GR-1001' },
      { id: 's2', name: 'Ayesha Noor', grNumber: 'GR-1002' },
    ]);

    const wrapper = mount(AttendanceView);
    await flushPromises();
    await wrapper.find('select[data-testid="section-select"]').setValue('sec-1');
    await flushPromises();

    await wrapper.find('[data-testid="default-all-present"]').trigger('click');

    expect(wrapper.find('[data-testid="status-s1-present"]').classes()).toContain('active');
    expect(wrapper.find('[data-testid="status-s2-present"]').classes()).toContain('active');
    expect(wrapper.text()).toContain('Submit Attendance (2/2)');
  });

  it('marks a student Leave via the overflow menu', async () => {
    vi.mocked(api.listSections).mockResolvedValue([
      { id: 'sec-1', name: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
    ]);
    vi.mocked(api.sectionStudents).mockResolvedValue([
      { id: 's1', name: 'Ali Khan', grNumber: 'GR-1001' },
    ]);

    const wrapper = mount(AttendanceView);
    await flushPromises();
    await wrapper.find('select[data-testid="section-select"]').setValue('sec-1');
    await flushPromises();

    await wrapper.find('[data-testid="status-s1-more"]').trigger('click');
    await wrapper.find('[data-testid="status-s1-leave"]').trigger('click');
    await wrapper.find('[data-testid="save-attendance"]').trigger('click');
    await flushPromises();

    expect(api.markAttendance).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({ studentId: 's1', status: 'LEAVE' }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd staff-console && npx vitest run src/views/AttendanceView.spec.ts`
Expected: FAIL — the component still renders a `<select>` per row, not segmented buttons.

- [ ] **Step 3: Rewrite AttendanceView.vue**

Replace `staff-console/src/views/AttendanceView.vue` in full:

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type SectionSummary, type StudentSummary, type AttendanceStatus } from '../lib/api';
import { initialsFromName } from '../lib/format';

const auth = useAuthStore();
const today = new Date().toISOString().slice(0, 10);

const sections = ref<SectionSummary[]>([]);
const selectedSectionId = ref('');
const students = ref<StudentSummary[]>([]);
const statuses = ref<Record<string, AttendanceStatus | ''>>({});
const isSaving = ref(false);
const message = ref<string | null>(null);
const errorMessage = ref<string | null>(null);
const openOverflowFor = ref<string | null>(null);

async function loadSections() {
  if (!auth.accessToken) return;
  try {
    sections.value = await api.listSections(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load sections.';
  }
}
loadSections();

async function onSectionChange() {
  message.value = null;
  errorMessage.value = null;
  students.value = [];
  statuses.value = {};
  if (!selectedSectionId.value || !auth.accessToken) return;
  try {
    students.value = await api.sectionStudents(auth.accessToken, selectedSectionId.value);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load students.';
  }
}

function setStatus(studentId: string, status: AttendanceStatus) {
  statuses.value[studentId] = status;
  openOverflowFor.value = null;
}

function toggleOverflow(studentId: string) {
  openOverflowFor.value = openOverflowFor.value === studentId ? null : studentId;
}

function markAllPresent() {
  for (const student of students.value) {
    statuses.value[student.id] = 'PRESENT';
  }
}

const presentCount = computed(
  () => Object.values(statuses.value).filter((s) => s === 'PRESENT').length,
);
const absentCount = computed(
  () => Object.values(statuses.value).filter((s) => s === 'ABSENT').length,
);

async function onSave() {
  if (!auth.accessToken) return;
  message.value = null;
  errorMessage.value = null;
  isSaving.value = true;

  try {
    const entries = Object.entries(statuses.value).filter(([, status]) => status !== '');
    for (const [studentId, status] of entries) {
      await api.markAttendance(auth.accessToken, {
        studentId,
        date: today,
        status: status as AttendanceStatus,
      });
    }
    message.value = `Saved attendance for ${entries.length} student(s).`;
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="attendance">
    <h1>Attendance</h1>
    <p class="subtitle">{{ today }}</p>

    <label class="field">
      <span>Section</span>
      <select data-testid="section-select" v-model="selectedSectionId" @change="onSectionChange">
        <option value="" disabled>Choose a section</option>
        <option v-for="s in sections" :key="s.id" :value="s.id">
          {{ s.className }} {{ s.name }} — {{ s.campusName }}
        </option>
      </select>
    </label>

    <button
      v-if="students.length"
      type="button"
      data-testid="default-all-present"
      class="default-all"
      @click="markAllPresent"
    >
      Default all present
    </button>

    <ul v-if="students.length" class="roster">
      <li v-for="(student, i) in students" :key="student.id" class="roster-row">
        <div class="roster-student">
          <span class="roster-index">{{ i + 1 }}</span>
          <span class="roster-avatar">{{ initialsFromName(student.name) }}</span>
          <span class="roster-name">{{ student.name }}</span>
        </div>

        <div class="status-group">
          <div class="segmented">
            <button
              type="button"
              :data-testid="`status-${student.id}-present`"
              class="segment segment-present"
              :class="{ active: statuses[student.id] === 'PRESENT' }"
              @click="setStatus(student.id, 'PRESENT')"
            >
              P
            </button>
            <button
              type="button"
              :data-testid="`status-${student.id}-absent`"
              class="segment segment-absent"
              :class="{ active: statuses[student.id] === 'ABSENT' }"
              @click="setStatus(student.id, 'ABSENT')"
            >
              A
            </button>
            <button
              type="button"
              :data-testid="`status-${student.id}-late`"
              class="segment segment-late"
              :class="{ active: statuses[student.id] === 'LATE' }"
              @click="setStatus(student.id, 'LATE')"
            >
              L
            </button>
          </div>
          <div class="overflow">
            <button
              type="button"
              :data-testid="`status-${student.id}-more`"
              class="overflow-trigger"
              aria-haspopup="true"
              @click="toggleOverflow(student.id)"
            >
              …
            </button>
            <div v-if="openOverflowFor === student.id" class="overflow-menu">
              <button
                type="button"
                :data-testid="`status-${student.id}-leave`"
                @click="setStatus(student.id, 'LEAVE')"
              >
                Leave
              </button>
              <button
                type="button"
                :data-testid="`status-${student.id}-holiday`"
                @click="setStatus(student.id, 'HOLIDAY')"
              >
                Holiday
              </button>
            </div>
          </div>
        </div>
      </li>
    </ul>

    <p v-if="message" class="success" data-testid="success">{{ message }}</p>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <footer v-if="students.length" class="summary-bar">
      <div class="summary-counts">
        <span><strong>{{ presentCount }}</strong> Present</span>
        <span><strong>{{ absentCount }}</strong> Absent</span>
        <span><strong>{{ students.length }}</strong> Total</span>
      </div>
      <button data-testid="save-attendance" :disabled="isSaving" @click="onSave">
        {{ isSaving ? 'Saving…' : `Submit Attendance (${presentCount}/${students.length})` }}
      </button>
    </footer>
  </div>
</template>

<style scoped>
.attendance {
  max-width: 640px;
}
.subtitle {
  color: var(--color-muted);
  margin-bottom: var(--space-4);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-3);
  max-width: 320px;
}
select {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
}

.default-all {
  display: block;
  width: 100%;
  margin-bottom: var(--space-4);
  padding: 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-muted-bg);
  color: var(--color-primary);
  font-weight: 600;
  cursor: pointer;
}

.roster {
  list-style: none;
  margin-bottom: var(--space-4);
  border-top: 1px solid var(--color-border);
}
.roster-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}
.roster-student {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}
.roster-index {
  color: var(--color-muted);
  font-size: var(--font-size-sm);
  width: 1.2rem;
}
.roster-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 50%;
  background: var(--color-muted-bg);
  color: var(--color-primary);
  font-size: var(--font-size-xs);
  font-weight: 700;
  flex-shrink: 0;
}
.roster-name {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}
.segmented {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.segment {
  min-width: 2.5rem;
  padding: 0.4rem 0;
  border: none;
  border-left: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-muted);
  font-weight: 600;
  font-size: var(--font-size-sm);
  cursor: pointer;
}
.segment:first-child {
  border-left: none;
}
.segment-present.active {
  background: var(--color-present);
  color: var(--color-on-primary);
}
.segment-absent.active {
  background: var(--color-destructive);
  color: var(--color-on-primary);
}
.segment-late.active {
  background: var(--color-late);
  color: var(--color-on-primary);
}

.overflow {
  position: relative;
}
.overflow-trigger {
  border: none;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  font-size: var(--font-size-base);
  padding: 0.2rem 0.4rem;
}
.overflow-menu {
  position: absolute;
  right: 0;
  top: 100%;
  z-index: 1;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
  display: flex;
  flex-direction: column;
  min-width: 6rem;
}
.overflow-menu button {
  border: none;
  background: transparent;
  text-align: left;
  padding: 0.5rem 0.7rem;
  font: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
}
.overflow-menu button:hover {
  background: var(--color-muted-bg);
}

.success {
  color: var(--color-accent);
  margin-bottom: var(--space-3);
}
.error {
  color: var(--color-destructive);
  margin-bottom: var(--space-3);
}

.summary-bar {
  position: sticky;
  bottom: 0;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  padding: var(--space-3) 0;
}
.summary-counts {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-muted);
}
.summary-bar button {
  width: 100%;
  padding: 0.8rem;
  border: none;
  border-radius: var(--radius);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-weight: 700;
  cursor: pointer;
}
.summary-bar button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd staff-console && npx vitest run src/views/AttendanceView.spec.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add staff-console/src/views/AttendanceView.vue staff-console/src/views/AttendanceView.spec.ts
git commit -m "feat: replace the attendance roster's dropdown with a segmented P/A/L control"
```

---

### Task 8: Fee Reconciliation (`FeesView.vue`, new) + router wiring

**Files:**
- Create: `staff-console/src/lib/mockFees.ts`
- Test: `staff-console/src/lib/mockFees.spec.ts`
- Create: `staff-console/src/views/FeesView.vue`
- Test: `staff-console/src/views/FeesView.spec.ts`
- Modify: `staff-console/src/router/index.ts`

**Interfaces:**
- Consumes: `formatPkrFull` (Task 3).
- Produces: `getMockReconciliationQueue(): ReconciliationTransaction[]`, `getSuggestedMatch(transactionId: string): SuggestedMatch | null`, and the `/admin/fees` route (name `admin-fees`).

- [ ] **Step 1: Write the failing test for the mock data**

Create `staff-console/src/lib/mockFees.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getMockReconciliationQueue, getSuggestedMatch } from './mockFees';

describe('getMockReconciliationQueue', () => {
  it('returns 4 transactions, 3 of them exceptions', () => {
    const queue = getMockReconciliationQueue();
    expect(queue).toHaveLength(4);
    expect(queue.filter((t) => t.status === 'EXCEPTION')).toHaveLength(3);
    expect(queue.filter((t) => t.status === 'AUTO_MATCHED')).toHaveLength(1);
  });
});

describe('getSuggestedMatch', () => {
  it('returns a suggestion for a known transaction id', () => {
    expect(getSuggestedMatch('t1')).toEqual({
      invoiceNo: 'INV-2026-000123',
      studentName: 'Hassan Ahmed',
      amountPkr: 18450,
    });
  });

  it('returns null for an unknown transaction id', () => {
    expect(getSuggestedMatch('does-not-exist')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd staff-console && npx vitest run src/lib/mockFees.spec.ts`
Expected: FAIL — `./mockFees` doesn't exist yet.

- [ ] **Step 3: Write the mock data module**

Create `staff-console/src/lib/mockFees.ts`:

```ts
export type ReconciliationStatus = 'AUTO_MATCHED' | 'EXCEPTION';

export interface ReconciliationTransaction {
  id: string;
  timestamp: string;
  rail: string;
  transactionId: string;
  amountPkr: number;
  status: ReconciliationStatus;
  exceptionReason: string | null;
}

export interface SuggestedMatch {
  invoiceNo: string;
  studentName: string;
  amountPkr: number;
}

export function getMockReconciliationQueue(): ReconciliationTransaction[] {
  return [
    {
      id: 't1',
      timestamp: '27 Aug 2026, 14:32',
      rail: '1Link',
      transactionId: '1L-998234-A',
      amountPkr: 18450,
      status: 'EXCEPTION',
      exceptionReason: 'Invalid Challan Number',
    },
    {
      id: 't2',
      timestamp: '27 Aug 2026, 11:15',
      rail: 'JazzCash',
      transactionId: 'JC-554129-X',
      amountPkr: 22000,
      status: 'EXCEPTION',
      exceptionReason: 'Amount Mismatch (Partial Payment)',
    },
    {
      id: 't3',
      timestamp: '27 Aug 2026, 10:45',
      rail: 'EasyPaisa',
      transactionId: 'EP-776211-Y',
      amountPkr: 15000,
      status: 'AUTO_MATCHED',
      exceptionReason: null,
    },
    {
      id: 't4',
      timestamp: '27 Aug 2026, 09:20',
      rail: '1Link',
      transactionId: '1L-112345-B',
      amountPkr: 18450,
      status: 'EXCEPTION',
      exceptionReason: 'Duplicate Transaction Detected',
    },
  ];
}

const SUGGESTIONS: Record<string, SuggestedMatch> = {
  t1: { invoiceNo: 'INV-2026-000123', studentName: 'Hassan Ahmed', amountPkr: 18450 },
  t4: { invoiceNo: 'INV-2026-000456', studentName: 'Hassan Ahmed', amountPkr: 18450 },
};

export function getSuggestedMatch(transactionId: string): SuggestedMatch | null {
  return SUGGESTIONS[transactionId] ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd staff-console && npx vitest run src/lib/mockFees.spec.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing test for the view**

Create `staff-console/src/views/FeesView.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import FeesView from './FeesView.vue';
import { useAuthStore } from '../stores/auth';

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: { template: '<div>login</div>' } },
      { path: '/admin', name: 'admin-home', component: { template: '<div>admin</div>' } },
      { path: '/admin/fees', name: 'admin-fees', component: FeesView },
    ],
  });
}

async function mountView() {
  setActivePinia(createPinia());
  const auth = useAuthStore();
  auth.role = 'ACCOUNTS';
  const router = makeRouter();
  await router.push('/admin/fees');
  await router.isReady();
  return mount(FeesView, { global: { plugins: [router] } });
}

describe('FeesView', () => {
  it('defaults to the Exception filter and shows the three summary counts', async () => {
    const wrapper = await mountView();

    expect((wrapper.find('[data-testid="status-filter"]').element as HTMLSelectElement).value).toBe(
      'EXCEPTION',
    );
    expect(wrapper.text()).toContain('Total Transactions (Today)');
    expect(wrapper.text()).toContain('Auto-Matched');
    expect(wrapper.text()).toContain('Exceptions (Requires Action)');
    expect(wrapper.find('[data-testid="row-t3"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="row-t1"]').exists()).toBe(true);
  });

  it('filters by transaction ID search', async () => {
    const wrapper = await mountView();
    await wrapper.find('[data-testid="status-filter"]').setValue('ALL');
    await wrapper.find('[data-testid="search-transaction"]').setValue('JC-554129-X');

    expect(wrapper.find('[data-testid="row-t2"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="row-t1"]').exists()).toBe(false);
  });

  it('opens the resolve panel for an exception row, shows the suggested match, and resolves it', async () => {
    const wrapper = await mountView();

    await wrapper.find('[data-testid="resolve-t1"]').trigger('click');

    expect(wrapper.find('[data-testid="resolve-panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="suggestion-card"]').text()).toContain('INV-2026-000123');
    expect(wrapper.find('[data-testid="suggestion-card"]').text()).toContain('Hassan Ahmed');

    await wrapper.find('[data-testid="confirm-resolution"]').trigger('click');

    expect(wrapper.find('[data-testid="resolve-panel"]').exists()).toBe(false);
    await wrapper.find('[data-testid="status-filter"]').setValue('ALL');
    expect(wrapper.find('[data-testid="row-t1"] .badge').text()).toBe('Auto-Matched');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd staff-console && npx vitest run src/views/FeesView.spec.ts`
Expected: FAIL — `FeesView.vue` doesn't exist yet.

- [ ] **Step 7: Write FeesView.vue**

Create `staff-console/src/views/FeesView.vue`:

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import AppShell from '../components/AppShell.vue';
import {
  getMockReconciliationQueue,
  getSuggestedMatch,
  type ReconciliationTransaction,
} from '../lib/mockFees';
import { formatPkrFull } from '../lib/format';

const transactions = ref<ReconciliationTransaction[]>(getMockReconciliationQueue());
const searchQuery = ref('');
const railFilter = ref('ALL');
const statusFilter = ref<'ALL' | 'AUTO_MATCHED' | 'EXCEPTION'>('EXCEPTION');
const selectedId = ref<string | null>(null);
const manualSearch = ref('');

const rails = computed(() => ['ALL', ...new Set(transactions.value.map((t) => t.rail))]);

const filtered = computed(() =>
  transactions.value.filter((t) => {
    if (railFilter.value !== 'ALL' && t.rail !== railFilter.value) return false;
    if (statusFilter.value !== 'ALL' && t.status !== statusFilter.value) return false;
    if (
      searchQuery.value &&
      !t.transactionId.toLowerCase().includes(searchQuery.value.toLowerCase())
    ) {
      return false;
    }
    return true;
  }),
);

const totalCount = computed(() => transactions.value.length);
const autoMatchedCount = computed(
  () => transactions.value.filter((t) => t.status === 'AUTO_MATCHED').length,
);
const exceptionCount = computed(
  () => transactions.value.filter((t) => t.status === 'EXCEPTION').length,
);

const selected = computed(() => transactions.value.find((t) => t.id === selectedId.value) ?? null);
const suggestion = computed(() => (selectedId.value ? getSuggestedMatch(selectedId.value) : null));

function selectRow(transaction: ReconciliationTransaction) {
  if (transaction.status !== 'EXCEPTION') return;
  selectedId.value = transaction.id;
  manualSearch.value = suggestion.value?.studentName ?? '';
}

function closePanel() {
  selectedId.value = null;
}

function confirmResolution() {
  const target = transactions.value.find((t) => t.id === selectedId.value);
  if (!target) return;
  target.status = 'AUTO_MATCHED';
  target.exceptionReason = null;
  closePanel();
}
</script>

<template>
  <AppShell>
    <div class="fees">
      <h1>Fee Reconciliation Queue</h1>

      <section class="filters-card">
        <div class="filters-row">
          <input
            v-model="searchQuery"
            data-testid="search-transaction"
            type="text"
            placeholder="Search Transaction ID"
          />
          <select v-model="railFilter" data-testid="rail-filter">
            <option v-for="rail in rails" :key="rail" :value="rail">
              {{ rail === 'ALL' ? 'All Rails' : rail }}
            </option>
          </select>
          <select v-model="statusFilter" data-testid="status-filter">
            <option value="EXCEPTION">Status: Exception</option>
            <option value="AUTO_MATCHED">Status: Auto-Matched</option>
            <option value="ALL">Status: All</option>
          </select>
        </div>

        <div class="stats-row">
          <div class="stat">
            <div class="stat-label">Total Transactions (Today)</div>
            <div class="stat-value">{{ totalCount }}</div>
          </div>
          <div class="stat stat-success">
            <div class="stat-label">Auto-Matched</div>
            <div class="stat-value">{{ autoMatchedCount }}</div>
          </div>
          <div class="stat stat-danger">
            <div class="stat-label">Exceptions (Requires Action)</div>
            <div class="stat-value">{{ exceptionCount }}</div>
          </div>
        </div>
      </section>

      <div class="fees-body">
        <section class="table-card">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Rail</th>
                <th>Transaction ID</th>
                <th class="num">Amount (PKR)</th>
                <th>Status</th>
                <th>Exception Reason</th>
                <th class="num">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="t in filtered"
                :key="t.id"
                :data-testid="`row-${t.id}`"
                :class="{ selected: t.id === selectedId, clickable: t.status === 'EXCEPTION' }"
                @click="selectRow(t)"
              >
                <td>{{ t.timestamp }}</td>
                <td>{{ t.rail }}</td>
                <td>{{ t.transactionId }}</td>
                <td class="num">{{ formatPkrFull(t.amountPkr) }}</td>
                <td>
                  <span class="badge" :class="t.status === 'EXCEPTION' ? 'badge-danger' : 'badge-success'">
                    {{ t.status === 'EXCEPTION' ? 'Exception' : 'Auto-Matched' }}
                  </span>
                </td>
                <td>{{ t.exceptionReason ?? '-' }}</td>
                <td class="num">
                  <button
                    v-if="t.status === 'EXCEPTION'"
                    type="button"
                    :data-testid="`resolve-${t.id}`"
                    class="link-button"
                    @click.stop="selectRow(t)"
                  >
                    Resolve
                  </button>
                  <span v-else class="muted">View</span>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <aside v-if="selected" class="resolve-panel" data-testid="resolve-panel">
          <div class="resolve-header">
            <h2>Resolve Exception</h2>
            <button type="button" data-testid="close-resolve" aria-label="Close" @click="closePanel">
              ×
            </button>
          </div>

          <div class="resolve-section">
            <h3>Bank Transaction Details</h3>
            <dl class="detail-list">
              <div><dt>Transaction ID</dt><dd>{{ selected.transactionId }}</dd></div>
              <div><dt>Rail</dt><dd>{{ selected.rail }}</dd></div>
              <div><dt>Amount Received</dt><dd>PKR {{ formatPkrFull(selected.amountPkr) }}</dd></div>
              <div class="issue"><dt>Issue</dt><dd>{{ selected.exceptionReason }}</dd></div>
            </dl>
          </div>

          <div class="resolve-section">
            <h3>Manual Resolution</h3>
            <label class="field">
              <span>Search Student or Correct Challan</span>
              <input v-model="manualSearch" data-testid="manual-search" type="text" />
            </label>

            <div v-if="suggestion" class="suggestion-card" data-testid="suggestion-card">
              <div class="suggestion-row">
                <span class="suggestion-invoice">{{ suggestion.invoiceNo }}</span>
                <span class="suggestion-amount">PKR {{ formatPkrFull(suggestion.amountPkr) }}</span>
              </div>
              <div class="suggestion-name">{{ suggestion.studentName }}</div>
            </div>

            <button
              type="button"
              data-testid="confirm-resolution"
              class="confirm-button"
              @click="confirmResolution"
            >
              Confirm Match
            </button>
          </div>
        </aside>
      </div>
    </div>
  </AppShell>
</template>

<style scoped>
.fees {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.filters-card,
.table-card,
.resolve-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.filters-card {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.filters-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.filters-row input,
.filters-row select {
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: var(--font-size-sm);
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}
@media (max-width: 768px) {
  .stats-row {
    grid-template-columns: 1fr;
  }
}
.stat {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-3);
}
.stat-success {
  background: color-mix(in srgb, var(--color-present) 10%, white);
  border-color: color-mix(in srgb, var(--color-present) 30%, white);
}
.stat-danger {
  background: color-mix(in srgb, var(--color-destructive) 8%, white);
  border-color: color-mix(in srgb, var(--color-destructive) 25%, white);
}
.stat-label {
  font-size: var(--font-size-sm);
  color: var(--color-muted);
}
.stat-value {
  font-size: var(--font-size-xl);
  font-weight: 700;
  margin-top: var(--space-1);
}

.fees-body {
  display: flex;
  gap: var(--space-4);
  align-items: flex-start;
}
.table-card {
  flex: 1;
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}
th {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  color: var(--color-muted);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  border-bottom: 1px solid var(--color-border);
}
td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
}
.num {
  text-align: right;
}
tr.clickable {
  cursor: pointer;
}
tr.selected {
  background: var(--color-muted-bg);
}
tr.clickable:hover {
  background: var(--color-background);
}

.badge {
  display: inline-block;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-size: var(--font-size-xs);
  font-weight: 700;
}
.badge-danger {
  background: color-mix(in srgb, var(--color-destructive) 15%, white);
  color: var(--color-destructive);
}
.badge-success {
  background: color-mix(in srgb, var(--color-present) 15%, white);
  color: var(--color-present);
}

.link-button {
  border: none;
  background: none;
  color: var(--color-accent);
  font-weight: 600;
  cursor: pointer;
}
.muted {
  color: var(--color-muted);
}

.resolve-panel {
  width: 22rem;
  flex-shrink: 0;
}
.resolve-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}
.resolve-header button {
  border: none;
  background: none;
  font-size: var(--font-size-lg);
  cursor: pointer;
  color: var(--color-muted);
}
.resolve-section {
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}
.resolve-section h3 {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  color: var(--color-muted);
  margin-bottom: var(--space-2);
}
.detail-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
}
.detail-list > div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
}
.detail-list dt {
  color: var(--color-muted);
}
.detail-list dd {
  font-weight: 500;
  text-align: right;
}
.detail-list .issue dd {
  color: var(--color-destructive);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-3);
}
.field input {
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
}

.suggestion-card {
  border: 1px solid var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 8%, white);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  margin-bottom: var(--space-3);
  font-size: var(--font-size-sm);
}
.suggestion-row {
  display: flex;
  justify-content: space-between;
  font-weight: 600;
}

.confirm-button {
  width: 100%;
  padding: 0.6rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-on-primary);
  font-weight: 700;
  cursor: pointer;
}
</style>
```

- [ ] **Step 8: Wire the `/admin/fees` route**

In `staff-console/src/router/index.ts`, add a new route entry right after the `/admin` route (before `/admin/circulars`):

```ts
    {
      path: '/admin/fees',
      name: 'admin-fees',
      component: () => import('../views/FeesView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'] },
    },
```

- [ ] **Step 9: Run test to verify it passes**

Run: `cd staff-console && npx vitest run src/views/FeesView.spec.ts`
Expected: PASS, all cases.

- [ ] **Step 10: Run the full test suite once to confirm nothing else broke**

Run: `cd staff-console && npm test`
Expected: all suites pass (this plan's tasks plus every pre-existing spec — `LoginView`, `CircularsView`, `DiaryView`).

- [ ] **Step 11: Run lint and type-check**

Run: `cd staff-console && npm run lint && npm run build`
Expected: both clean (the `build` script runs `type-check` then `build-only`).

- [ ] **Step 12: Commit**

```bash
git add staff-console/src/lib/mockFees.ts staff-console/src/lib/mockFees.spec.ts staff-console/src/views/FeesView.vue staff-console/src/views/FeesView.spec.ts staff-console/src/router/index.ts
git commit -m "feat: add Fee Reconciliation Queue view against mock data, wire /admin/fees route"
```

---

## Manual verification (do this after Task 8, before calling the plan done)

- [ ] Start the backend (`cd backend && npm run start:dev`) and staff-console (`cd staff-console && npm run dev`), log in as a seeded `SCHOOL_ADMIN`/`ACCOUNTS` user.
- [ ] Confirm the sidebar shows Dashboard first, the Dashboard route renders the new stat cards/sparkline/alerts, the topbar shows a bell icon and role-initials avatar, and the current nav item is visually highlighted.
- [ ] Click into Fees — confirm the reconciliation table, stat cards, and resolve panel all render and that resolving a row moves it out of the default Exception filter.
- [ ] Log in as a seeded `TEACHER`, open Attendance, pick a real section, confirm the segmented P/A/L control, avatar initials, "Default all present", and sticky submit bar all work end-to-end against the real `/attendance` endpoint (this is the one screen in this plan still wired to a live backend).
