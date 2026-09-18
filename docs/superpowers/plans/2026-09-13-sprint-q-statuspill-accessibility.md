# Sprint Q — StatusPill + Remaining Accessibility — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `StatusPill.vue` component scoped back in the 2026-09-07 Staff Console Shell
Redesign spec, and close the two remaining accessibility items: a real ARIA `radiogroup`/`radio`
pattern with arrow-key navigation on the attendance segmented control, and a richer, unit-aware
accessible label on the dashboard's `TrendsSparkline`.

**Architecture:** One new shared component (`StatusPill.vue`) swapped into three existing views'
status displays, no new state or API calls. Two independent, additive accessibility fixes on
already-shipped markup (`AttendanceView.vue`'s segmented control, `TrendsSparkline.vue`'s
`aria-label`) — no visual/behavioral change to either beyond the new ARIA attributes and keyboard
handling.

**Tech Stack:** Vue 3 + `@vue/test-utils`/`vitest` (staff-console).

**Spec:** `build/docs/superpowers/specs/2026-09-13-sprint-q-statuspill-accessibility-design.md`

## Global Constraints

- `StatusPill.vue` ships exactly as scoped in
  `build/docs/superpowers/specs/2026-09-07-staff-console-shell-redesign-design.md:113-116` — no
  redesign.
- No `*PageView.vue` wrapper gets a new spec (established zero-logic-wrapper convention).
- The segmented-control fix only adds ARIA roles/attributes and keyboard handling — no visual/CSS
  change, no change to the overflow ("…") menu (Leave/Holiday), which is out of scope this sprint.
- The `TrendsSparkline` fix only changes the `aria-label` text — no rendering/visual change.

---

### Task 1: `StatusPill.vue`

**Files:**
- Create: `staff-console/src/components/StatusPill.vue`, `staff-console/src/components/StatusPill.spec.ts`

**Interfaces:**
- Produces: `StatusPill` component, props `{ tone: 'success' | 'warning' | 'critical' | 'info' |
  'neutral'; label: string }` — Task 2 imports and uses this in three views.

- [ ] **Step 1: Write the failing test**

```ts
// staff-console/src/components/StatusPill.spec.ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import StatusPill from './StatusPill.vue';

describe('StatusPill', () => {
  it.each([
    ['success', 'tone-success'],
    ['warning', 'tone-warning'],
    ['critical', 'tone-critical'],
    ['info', 'tone-info'],
    ['neutral', 'tone-neutral'],
  ] as const)('renders the %s tone with class %s', (tone, expectedClass) => {
    const wrapper = mount(StatusPill, { props: { tone, label: 'Some Status' } });
    expect(wrapper.classes()).toContain(expectedClass);
    expect(wrapper.text()).toBe('Some Status');
    expect(wrapper.attributes('data-testid')).toBe('status-pill');
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `cd staff-console && npx vitest run src/components/StatusPill.spec.ts`
Expected: FAIL — `Cannot find module './StatusPill.vue'`.

- [ ] **Step 3: Implement `StatusPill.vue`**

```vue
<!-- staff-console/src/components/StatusPill.vue -->
<script setup lang="ts">
defineProps<{
  tone: 'success' | 'warning' | 'critical' | 'info' | 'neutral';
  label: string;
}>();
</script>

<template>
  <span class="status-pill" :class="`tone-${tone}`" data-testid="status-pill">{{ label }}</span>
</template>

<style scoped>
.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-size: var(--font-size-sm);
  font-weight: 600;
  line-height: 1.4;
}
.tone-success {
  background: var(--color-success-bg, #dcfce7);
  color: var(--color-success, #166534);
}
.tone-warning {
  background: var(--color-warning-bg, #fef9c3);
  color: var(--color-warning, #854d0e);
}
.tone-critical {
  background: var(--color-destructive-bg, #fee2e2);
  color: var(--color-destructive, #991b1b);
}
.tone-info {
  background: var(--color-info-bg, #dbeafe);
  color: var(--color-info, #1e40af);
}
.tone-neutral {
  background: var(--color-muted-bg, #f1f5f9);
  color: var(--color-muted, #475569);
}
</style>
```
Before finalizing the `tone-*` color values, check `staff-console/src/styles` (or wherever this
project's design tokens live) for existing `--color-success`/`--color-warning`/`--color-destructive`
token names — reuse them exactly rather than inventing new ones if equivalents already exist; the
literal hex fallbacks above are a safety net only.

- [ ] **Step 4: Run the test to see it pass**

Run: `cd staff-console && npx vitest run src/components/StatusPill.spec.ts`
Expected: PASS (5 cases).

- [ ] **Step 5: Commit**

```bash
git add staff-console/src/components/StatusPill.vue staff-console/src/components/StatusPill.spec.ts
git commit -m "feat(statuspill): add shared StatusPill component"
```

---

### Task 2: Swap `StatusPill` into `LeaveManagementView`, `FeeManagementView`, `AcademicSessionManagementView`

**Files:**
- Modify: `staff-console/src/views/LeaveManagementView.vue`, `staff-console/src/views/LeaveManagementView.spec.ts`
- Modify: `staff-console/src/views/FeeManagementView.vue`, `staff-console/src/views/FeeManagementView.spec.ts`
- Modify: `staff-console/src/views/AcademicSessionManagementView.vue`, `staff-console/src/views/AcademicSessionManagementView.spec.ts`

**Interfaces:**
- Consumes: `StatusPill` (Task 1).

- [ ] **Step 1: `LeaveManagementView.vue`**

Replace (around line 79):
```html
<span class="badge" :class="`badge-${r.status}`">{{ r.status }}</span>
```
with:
```html
<StatusPill :tone="leaveTone(r.status)" :label="r.status" />
```
Add to `<script setup>`: `import StatusPill from '../components/StatusPill.vue';` and
```ts
function leaveTone(status: string): 'success' | 'warning' | 'critical' | 'neutral' {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'critical';
  if (status === 'pending') return 'warning';
  return 'neutral';
}
```
Remove the now-unused `.badge`/`.badge-pending`/`.badge-approved`/`.badge-rejected` CSS rules
(`LeaveManagementView.vue:160-172` or wherever they land after the markup edit) — dead CSS once
nothing references those classes.

- [ ] **Step 2: Add a test case to `LeaveManagementView.spec.ts`**

```ts
it('renders each leave-request status through StatusPill with the right tone', async () => {
  vi.mocked(api.listLeaveRequests).mockResolvedValue([
    { id: 'lr1', studentId: 's1', studentName: 'Eshaal', startDate: '2026-09-01', endDate: '2026-09-02', reason: 'Trip', status: 'pending', createdAt: '2026-08-30T00:00:00.000Z' },
  ]);

  const wrapper = mount(LeaveManagementView);
  await flushPromises();

  const pill = wrapper.find('[data-testid="status-pill"]');
  expect(pill.classes()).toContain('tone-warning');
  expect(pill.text()).toBe('pending');
});
```
(Read the file's existing `beforeEach`/mock setup first and adapt the exact `api.listLeaveRequests`
mock name/fixture shape to whatever it actually is — this file's real mocked method name isn't
re-derived here.)

- [ ] **Step 3: Run the spec**

Run: `cd staff-console && npx vitest run src/views/LeaveManagementView.spec.ts`
Expected: PASS, including all pre-existing cases (they assert on `.text()` content, unaffected by
the markup swap).

- [ ] **Step 4: `FeeManagementView.vue`**

Replace (around line 298):
```html
<td>{{ v.status }}</td>
```
with:
```html
<td><StatusPill :tone="voucherTone(v.status)" :label="v.status" /></td>
```
Add the import and:
```ts
function voucherTone(status: string): 'success' | 'warning' | 'critical' | 'neutral' {
  if (status === 'paid') return 'success';
  if (status === 'overdue') return 'critical';
  if (status === 'partial') return 'warning';
  return 'neutral'; // 'unpaid'
}
```

- [ ] **Step 5: Extend the existing ledger test in `FeeManagementView.spec.ts`**

Add these two lines to the end of the existing `"loads a student's fee ledger showing voucher
status and payment history"` test (`FeeManagementView.spec.ts:107-137`) — its fixture already has a
`status: 'unpaid'` voucher, so no new test or fixture is needed:
```ts
const pill = wrapper.find('[data-testid="status-pill"]');
expect(pill.classes()).toContain('tone-neutral');
expect(pill.text()).toBe('unpaid');
```

- [ ] **Step 6: Run the spec**

Run: `cd staff-console && npx vitest run src/views/FeeManagementView.spec.ts`
Expected: PASS.

- [ ] **Step 7: `AcademicSessionManagementView.vue`**

Replace (around line 142):
```html
<span v-else>{{ item.isActive ? 'Active' : '—' }}</span>
```
with:
```html
<StatusPill v-else :tone="item.isActive ? 'success' : 'neutral'" :label="item.isActive ? 'Active' : 'Inactive'" />
```
(Note: this changes the inactive label from the em-dash `'—'` to the word `'Inactive'` — a small,
deliberate readability improvement consistent with `StatusPill` always carrying a real word label,
not a symbol. Update `AcademicSessionManagementView.spec.ts:40`'s existing
`expect(wrapper.text()).toContain('Active')` assertion — it still passes unchanged since `'Active'`
is a substring of nothing else problematic here, but add a sibling assertion for the inactive case
too, since none currently exists.)

- [ ] **Step 8: Add a test case to `AcademicSessionManagementView.spec.ts`**

```ts
it('shows an active and an inactive session with the right StatusPill tone each', async () => {
  vi.mocked(api.listAcademicSessions).mockResolvedValue([
    { id: 'as1', label: '2026-2027', startDate: '2026-08-01', endDate: '2027-06-30', isActive: true },
    { id: 'as2', label: '2027-2028', startDate: '2027-08-01', endDate: '2028-06-30', isActive: false },
  ]);

  const wrapper = mount(AcademicSessionManagementView);
  await flushPromises();

  const pills = wrapper.findAll('[data-testid="status-pill"]');
  const activePill = pills.find((p) => p.text() === 'Active');
  const inactivePill = pills.find((p) => p.text() === 'Inactive');
  expect(activePill?.classes()).toContain('tone-success');
  expect(inactivePill?.classes()).toContain('tone-neutral');
});
```

- [ ] **Step 9: Run the spec**

Run: `cd staff-console && npx vitest run src/views/AcademicSessionManagementView.spec.ts`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add staff-console/src/views/LeaveManagementView.vue staff-console/src/views/LeaveManagementView.spec.ts \
        staff-console/src/views/FeeManagementView.vue staff-console/src/views/FeeManagementView.spec.ts \
        staff-console/src/views/AcademicSessionManagementView.vue staff-console/src/views/AcademicSessionManagementView.spec.ts
git commit -m "feat(statuspill): swap into Leave/Fees/AcademicSession status displays"
```

---

### Task 3: Attendance segmented-control accessibility (ARIA + keyboard)

**Files:**
- Modify: `staff-console/src/views/AttendanceView.vue`, `staff-console/src/views/AttendanceView.spec.ts`

**Interfaces:** none — self-contained within this view.

- [ ] **Step 1: Add the failing test cases**

```ts
async function mountWithOneStudent() {
  vi.mocked(api.listSections).mockResolvedValue([
    { id: 'sec-1', name: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
  ]);
  vi.mocked(api.sectionStudents).mockResolvedValue([{ id: 's1', name: 'Eshaal', grNumber: 'GR-1001' }]);
  // attachTo: document.body is required for document.activeElement assertions to work in jsdom —
  // matches this codebase's existing precedent (ConfirmDialog.spec.ts, FormField.spec.ts,
  // useFocusTarget.spec.ts all do the same for the same reason).
  const wrapper = mount(AttendanceView, { attachTo: document.body });
  await flushPromises();
  await wrapper.find('select[data-testid="section-select"]').setValue('sec-1');
  await flushPromises();
  return wrapper;
}

it('exposes the segmented control as an ARIA radiogroup with the checked state reflected', async () => {
  const wrapper = await mountWithOneStudent();

  const group = wrapper.find('[data-testid="status-s1-present"]').element.closest('[role="radiogroup"]');
  expect(group).not.toBeNull();
  expect(group?.getAttribute('aria-label')).toContain('Eshaal');

  const presentBtn = wrapper.find('[data-testid="status-s1-present"]');
  expect(presentBtn.attributes('role')).toBe('radio');
  expect(presentBtn.attributes('aria-checked')).toBe('false');

  await presentBtn.trigger('click');
  expect(wrapper.find('[data-testid="status-s1-present"]').attributes('aria-checked')).toBe('true');
  expect(wrapper.find('[data-testid="status-s1-absent"]').attributes('aria-checked')).toBe('false');
  wrapper.unmount();
});

it('moves focus to the adjacent segment on ArrowRight', async () => {
  const wrapper = await mountWithOneStudent();

  await wrapper.find('[data-testid="status-s1-present"]').trigger('click');
  await wrapper.find('[data-testid="status-s1-present"]').trigger('keydown', { key: 'ArrowRight' });
  await flushPromises();

  expect(document.activeElement?.getAttribute('data-testid')).toBe('status-s1-absent');
  wrapper.unmount();
});
```
Add the `mountWithOneStudent` helper and both `it` blocks inside the existing
`describe('AttendanceView', ...)` block in `AttendanceView.spec.ts`, alongside its other tests —
the helper mirrors the existing "loads sections, then students..." test's own mount sequence
(`AttendanceView.spec.ts:28-43`) exactly, factored out since these two new tests both need it.

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd staff-console && npx vitest run src/views/AttendanceView.spec.ts`
Expected: the two new cases FAIL (no `role`/`aria-checked` attributes exist yet); all pre-existing
cases still PASS.

- [ ] **Step 3: Implement the ARIA roles and keyboard handling**

In `AttendanceView.vue`'s `<script setup>`, add:
```ts
function focusAdjacentSegment(studentId: string, currentStatus: 'PRESENT' | 'ABSENT' | 'LATE', direction: 1 | -1) {
  const order: ('PRESENT' | 'ABSENT' | 'LATE')[] = ['PRESENT', 'ABSENT', 'LATE'];
  const nextIndex = (order.indexOf(currentStatus) + direction + order.length) % order.length;
  const next = order[nextIndex];
  setStatus(studentId, next);
  const selector = `[data-testid="status-${studentId}-${next.toLowerCase()}"]`;
  (document.querySelector(selector) as HTMLElement | null)?.focus();
}
```
In the template (`:133-160`), wrap the three buttons with `role="radiogroup"` and add `role="radio"`/
`aria-checked`/roving `tabindex`/keydown handlers to each:

```html
<div class="segmented" role="radiogroup" :aria-label="`Attendance for ${student.name}`">
  <button
    type="button"
    role="radio"
    :aria-checked="statuses[student.id] === 'PRESENT'"
    :tabindex="statuses[student.id] === 'PRESENT' || !statuses[student.id] ? 0 : -1"
    :data-testid="`status-${student.id}-present`"
    class="segment segment-present"
    :class="{ active: statuses[student.id] === 'PRESENT' }"
    @click="setStatus(student.id, 'PRESENT')"
    @keydown.right.prevent="focusAdjacentSegment(student.id, 'PRESENT', 1)"
    @keydown.left.prevent="focusAdjacentSegment(student.id, 'PRESENT', -1)"
  >
    P
  </button>
  <button
    type="button"
    role="radio"
    :aria-checked="statuses[student.id] === 'ABSENT'"
    :tabindex="statuses[student.id] === 'ABSENT' ? 0 : -1"
    :data-testid="`status-${student.id}-absent`"
    class="segment segment-absent"
    :class="{ active: statuses[student.id] === 'ABSENT' }"
    @click="setStatus(student.id, 'ABSENT')"
    @keydown.right.prevent="focusAdjacentSegment(student.id, 'ABSENT', 1)"
    @keydown.left.prevent="focusAdjacentSegment(student.id, 'ABSENT', -1)"
  >
    A
  </button>
  <button
    type="button"
    role="radio"
    :aria-checked="statuses[student.id] === 'LATE'"
    :tabindex="statuses[student.id] === 'LATE' ? 0 : -1"
    :data-testid="`status-${student.id}-late`"
    class="segment segment-late"
    :class="{ active: statuses[student.id] === 'LATE' }"
    @click="setStatus(student.id, 'LATE')"
    @keydown.right.prevent="focusAdjacentSegment(student.id, 'LATE', 1)"
    @keydown.left.prevent="focusAdjacentSegment(student.id, 'LATE', -1)"
  >
    L
  </button>
</div>
```
No change to the CSS or to the sibling "overflow" (`…`) menu — out of scope this sprint.

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd staff-console && npx vitest run src/views/AttendanceView.spec.ts`
Expected: PASS, all cases including the two new ones and every pre-existing one.

- [ ] **Step 5: Manual keyboard/screen-reader smoke pass**

Per this project's established verification convention (Sprint J's own "manual keyboard-only
walkthrough"): tab into the Attendance screen's roster, confirm Tab moves between students (not
within a student's three segments), and Left/Right arrow keys move the selection within one
student's segmented control. Note the result in the sprint's verification summary.

- [ ] **Step 6: Commit**

```bash
git add staff-console/src/views/AttendanceView.vue staff-console/src/views/AttendanceView.spec.ts
git commit -m "fix(a11y): add ARIA radiogroup/radio + arrow-key nav to attendance segmented control"
```

---

### Task 4: `TrendsSparkline` accessible-label wording

**Files:**
- Modify: `staff-console/src/components/TrendsSparkline.vue`, `staff-console/src/components/TrendsSparkline.spec.ts`
- Modify: `staff-console/src/views/AdminHomeView.vue`

**Interfaces:**
- Produces: `SparklineSeries` gains an optional `unit?: string` field — no other consumer of this
  component exists in the codebase besides `AdminHomeView.vue` (confirm with a repo-wide grep for
  `TrendsSparkline` before assuming this, since a second caller would also need the same `unit`
  threading).

- [ ] **Step 1: Confirm there's only one caller**

Run: `cd staff-console && grep -rn "TrendsSparkline" src --include=*.vue -l`
Expected: only `src/views/AdminHomeView.vue` imports it (besides its own definition file) — if a
second view shows up, thread `unit` into that caller too in Step 4 below.

- [ ] **Step 2: Write the failing test**

```ts
it('includes the day label and unit in the accessible label, not just bare numbers', () => {
  const wrapper = mount(TrendsSparkline, {
    props: {
      labels: ['Mon', 'Tue'],
      series: [{ label: 'Attendance %', color: '#0f172a', values: [88, 95], unit: '%' }],
    },
  });

  const label = wrapper.find('svg').attributes('aria-label');
  expect(label).toContain('Attendance % by day');
  expect(label).toContain('Mon 88%');
  expect(label).toContain('Tue 95%');
});
```
Add this to the existing `describe('TrendsSparkline', ...)` block in `TrendsSparkline.spec.ts`.

- [ ] **Step 3: Run the test to see it fail**

Run: `cd staff-console && npx vitest run src/components/TrendsSparkline.spec.ts`
Expected: FAIL — the current label is `"Attendance %: 88, 95"`, not the new wording.

- [ ] **Step 4: Implement the new label and thread `unit` from the caller**

In `TrendsSparkline.vue`:
```ts
interface SparklineSeries {
  label: string;
  color: string;
  values: number[];
  dashed?: boolean;
  unit?: string;
}

const accessibleLabel = computed(() =>
  props.series
    .map(
      (s) =>
        `${s.label} by day: ` +
        s.values.map((v, i) => `${props.labels[i] ?? ''} ${v}${s.unit ?? ''}`).join(', '),
    )
    .join('. '),
);
```
In `AdminHomeView.vue`'s `trendSeries` computed (`:43-55`), add `unit: '%'` to the "Attendance %"
series and `unit: ' PKR'` to the "Fees Collected (PKR)" series.

- [ ] **Step 5: Run the test to see it pass**

Run: `cd staff-console && npx vitest run src/components/TrendsSparkline.spec.ts`
Expected: PASS, including the pre-existing polyline/legend test (unaffected — it never asserted on
`aria-label`).

- [ ] **Step 6: Run `AdminHomeView.spec.ts` to confirm no regression**

Run: `cd staff-console && npx vitest run src/views/AdminHomeView.spec.ts`
Expected: PASS unchanged (its existing tests don't assert on the sparkline's `aria-label` either).

- [ ] **Step 7: Commit**

```bash
git add staff-console/src/components/TrendsSparkline.vue staff-console/src/components/TrendsSparkline.spec.ts staff-console/src/views/AdminHomeView.vue
git commit -m "fix(a11y): give TrendsSparkline's accessible label real units and day context"
```

---

### Task 5: Full-suite verification and roadmap update

**Files:** `docs/Plan-Ideas/PHASE-1/SchoolOS-PostMVP-Roadmap-2026-09-08.md` (roadmap checklist only).

- [ ] **Step 1: Run the full staff-console suite**

Run: `cd staff-console && npx vitest run && npx vue-tsc --noEmit && npm run lint`
Expected: all green, clean type-check and lint.

- [ ] **Step 2: Run the backend and parent-app suites for a full-repo sanity check**

Run: `cd backend && npm test && npm run test:e2e`
Run: `cd parent-app && flutter analyze && flutter test`
Expected: all green (this sprint touches staff-console only, but a full-repo check is this
project's established closing step for every sprint).

- [ ] **Step 3: Update the roadmap doc's Implementation Checklist**

Check off Sprint Q's box and sub-items in
`docs/Plan-Ideas/PHASE-1/SchoolOS-PostMVP-Roadmap-2026-09-08.md`, noting that the dashboard
chart accessible-name item was found already substantially fixed by Sprint J (this sprint only
tightened the label's wording, not added a missing label from scratch) — matching the established
"verify against real code, don't assume" format from Sprints A-P.

- [ ] **Step 4: Commit**

```bash
git add docs/Plan-Ideas/PHASE-1/SchoolOS-PostMVP-Roadmap-2026-09-08.md
git commit -m "docs: mark Sprint Q complete in the roadmap checklist"
```
