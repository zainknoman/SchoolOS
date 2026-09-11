# Sprint D — Staff Console Component Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract 4 shared Vue components (`EntityTable`, `FormField`, `Button`, `ConfirmDialog` + `useConfirm()`) and migrate all 8 CRUD screens plus Timetable/Leave's unguarded actions onto them, with zero intended visual change.

**Architecture:** Build the 4 shared components + `useConfirm()` singleton store in isolation (each with its own spec), wire `ConfirmDialog` into `AppShell.vue` once, then migrate `SchoolManagementView.vue` as the reference pattern, then repeat that proven pattern across the remaining 7 CRUD screens in increasing complexity order, then add `useConfirm()` guards to `TimetableView.vue`/`LeaveManagementView.vue`'s currently-unguarded actions, then do the independent nav/breadcrumb fix, then add a regression test banning `window.confirm`.

**Tech Stack:** Vue 3.5 `<script setup>` (incl. generic components), TypeScript, Pinia, Vitest + `@vue/test-utils`, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-10-sprint-d-component-extraction-design.md`

**Working directory for all commands/paths below:** `staff-console/` (a subdirectory of this git repo's root). All file paths in this plan are relative to `staff-console/` unless stated otherwise. Run tests with `npm run test -- <path>` (= `vitest run <path>`) and type-check with `npm run type-check`.

## Global Constraints

- Zero intended visual change — every migrated screen must render pixel-equivalent to today (same colors, spacing, copy). This is the single most important constraint; several implementation choices below exist purely to satisfy it.
- No change to any API contract, Prisma schema, or business logic — this is a Vue-layer-only sprint.
- No real breadcrumb trail — only `AppShell.vue`'s `aria-label` changes, not the rendering logic.
- No teacher-facing timetable view build-out (Sprint I) — the teacher nav link is removed with no replacement.
- `ConfirmDialog`'s `danger:false` styling must be verified via its own component spec only — no Sprint D call site exercises it live.
- Every existing `data-testid` on add-form inputs and table action buttons must be preserved exactly (passthrough via `v-bind="$attrs"` on `FormField`, and explicit `:data-testid` bindings on `Button` usages).
- Each screen's existing `*ManagementView.spec.ts` is updated in the same task as its migration — never as a separate later pass.

## Resolved Spec Gaps (read before implementing)

Direct inspection of the actual view files (not just the design doc) surfaced five places where the doc's description doesn't quite match what the code needs. Each is resolved here so every task can just build against a settled decision instead of re-deriving it:

1. **`FormField`'s `type` union is missing `'date'`.** `AcademicSessionManagementView.vue`'s add-form has two `<input type="date">` fields. The doc's own description — "`text`/`password` render `<input :type>`" — already implies the value is passed straight through as the native `type` attribute, so `'date'` is added to the union and falls into that exact same render branch. No new behavior, just one more literal value.
2. **`EntityTable` needs an `editingId` prop the doc's Props list omits.** The doc's own usage example shows scoped slots receiving `{ item, editing }`, but `editing` can't be computed without `EntityTable` knowing which row id is currently being edited — and the doc explicitly says `EntityTable` does *not* own that state itself. So `EntityTable` takes an `editingId: unknown` prop (the view still owns the `ref`, just also passes it in), and computes `editing = editingId === item[rowKey]` per row.
3. **`FormField`'s `label` prop must NOT render visible text for text/password/date/select.** The doc says "label above control... matches current `.inline-form` look" — but the actual current `.inline-form` markup has no visible label at all, only a placeholder (verified across all 7 add-forms that use `.inline-form`). Rendering a visible label would be a real visual regression, which the doc's own Non-goals section forbids. Resolution: for text/password/date/select, the `label` prop renders as a visually-hidden (`.sr-only`) `<label>` for accessibility only; the visible hint stays exactly as it is today, via `placeholder`. For `type="checkbox"`, the current `.checkbox-row` markup already shows the label text today (e.g. "Active", "+ New Parent…"), so that one case keeps rendering it visibly — no change from today's behavior either way.
4. **`StudentManagementView.vue`'s GR-number field needs a focus target through a component boundary.** Today `<input ref="grNumberInputRef">` is a raw template ref consumed by `useFocusTarget()` (`targets[focusId]?.value?.focus()`), so the command palette's "Add student" action (`?focus=gr-number`) can focus it. Once that input is wrapped in `<FormField>`, a template `ref` on `<FormField>` resolves to the component's exposed instance, not a raw `HTMLElement`. Resolution: `FormField` calls `defineExpose({ focus: () => inputRef.value?.focus() })`, and `useFocusTarget`'s parameter type widens from `Record<string, Ref<HTMLElement | null>>` to `Record<string, Ref<{ focus(): void } | null>>` — a real `HTMLElement` still structurally satisfies that type, so no other caller changes.
5. **Per-field `flex: 1` growth is NOT uniform across the 7 `.inline-form`-based screens** (verified by reading every view's `<style>` block): School, Campus, Section, Class, Teacher, Parent, and Student all have `.inline-form input { flex: 1; }` (selects never grow). `AcademicSessionManagementView.vue` has no such rule at all — none of its fields grow. To preserve this exactly without fighting Vue's scoped-CSS child-component boundary, `FormField` takes its own `grow?: boolean` prop (default `false`) that the migrating view sets explicitly per field, matching that field's pre-migration behavior one-for-one. This keeps all sizing self-contained inside `FormField.vue` — no `:deep()` selectors needed anywhere.

Also, since `onDelete` moves from `window.confirm` to `useConfirm()` on **all 8** CRUD screens (not just Timetable/Leave, which get a guard added where none existed), every migrated screen's spec needs its confirm-mocking updated from `vi.spyOn(window, 'confirm')` to mocking the `useConfirm` module. The pattern is identical everywhere (see Task 7), so it's spelled out once there and then repeated verbatim (with only the entity noun changing) in Tasks 8–14 and Tasks 15–16.

---

### Task 1: `Button.vue`

**Files:**
- Create: `src/components/Button.vue`
- Test: `src/components/Button.spec.ts`

**Interfaces:**
- Produces: `Button.vue` default export, props `{ variant?: 'primary' | 'secondary'; disabled?: boolean }` (default `variant: 'primary'`, `disabled: false`), default slot for label content, native `click` DOM event passthrough (default Vue attribute/listener fallthrough — no `inheritAttrs: false` needed since it has one root element), `data-testid`/other attrs passthrough via default fallthrough onto the root `<button>`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/Button.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import Button from './Button.vue';

describe('Button', () => {
  it('renders slot content and defaults to the primary variant', () => {
    const wrapper = mount(Button, { slots: { default: 'Save' } });
    expect(wrapper.text()).toBe('Save');
    expect(wrapper.classes()).toContain('primary');
    expect(wrapper.classes()).not.toContain('secondary');
    expect(wrapper.attributes('type')).toBe('button');
  });

  it('applies the secondary variant class', () => {
    const wrapper = mount(Button, { props: { variant: 'secondary' }, slots: { default: 'Delete' } });
    expect(wrapper.classes()).toContain('secondary');
    expect(wrapper.classes()).not.toContain('primary');
  });

  it('forwards the disabled prop to the native button', () => {
    const wrapper = mount(Button, { props: { disabled: true }, slots: { default: 'Add' } });
    expect(wrapper.attributes('disabled')).toBeDefined();
  });

  it('is not disabled by default', () => {
    const wrapper = mount(Button, { slots: { default: 'Add' } });
    expect(wrapper.attributes('disabled')).toBeUndefined();
  });

  it('forwards passthrough attributes like data-testid onto the root button', () => {
    const wrapper = mount(Button, {
      attrs: { 'data-testid': 'add-submit' },
      slots: { default: 'Add' },
    });
    expect(wrapper.attributes('data-testid')).toBe('add-submit');
  });

  it('forwards click events via native attribute passthrough', async () => {
    const onClick = vi.fn();
    const wrapper = mount(Button, {
      attrs: { onClick },
      slots: { default: 'Add' },
    });
    await wrapper.trigger('click');
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/Button.spec.ts`
Expected: FAIL — `Failed to resolve import "./Button.vue"` (file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

```vue
<!-- src/components/Button.vue -->
<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary';
    disabled?: boolean;
  }>(),
  { variant: 'primary', disabled: false },
);
</script>

<template>
  <button type="button" class="btn" :class="variant" :disabled="disabled">
    <slot />
  </button>
</template>

<style scoped>
.btn {
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-on-primary);
  font-weight: 600;
  cursor: pointer;
}
.btn.secondary {
  background: transparent;
  color: var(--color-destructive);
  border: 1px solid var(--color-destructive);
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/Button.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add staff-console/src/components/Button.vue staff-console/src/components/Button.spec.ts
git commit -m "feat(staff-console): add shared Button component"
```

---

### Task 2: `FormField.vue`

**Files:**
- Create: `src/components/FormField.vue`
- Test: `src/components/FormField.spec.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `FormField.vue` default export, props `{ modelValue: string | boolean; label: string; type: 'text' | 'password' | 'date' | 'select' | 'checkbox'; options?: { value: string; label: string }[]; placeholder?: string; error?: string; grow?: boolean }` (default `grow: false`), `update:modelValue` event, default-fallthrough-disabled (`inheritAttrs: false`) with `v-bind="$attrs"` forwarded onto the inner native control only, `defineExpose({ focus: () => void })` — a later task (Task 3) widens `useFocusTarget`'s type to accept this exposed shape.

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/FormField.spec.ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import FormField from './FormField.vue';

describe('FormField', () => {
  it('renders a text input and emits update:modelValue on input', async () => {
    const wrapper = mount(FormField, {
      props: { modelValue: '', label: 'Full name', type: 'text', placeholder: 'Full name' },
    });
    const input = wrapper.find('input');
    expect(input.attributes('type')).toBe('text');
    expect(input.attributes('placeholder')).toBe('Full name');
    await input.setValue('Ali Khan');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['Ali Khan']);
  });

  it('renders a password input', () => {
    const wrapper = mount(FormField, {
      props: { modelValue: '', label: 'Password', type: 'password' },
    });
    expect(wrapper.find('input').attributes('type')).toBe('password');
  });

  it('renders a date input', () => {
    const wrapper = mount(FormField, {
      props: { modelValue: '', label: 'Start', type: 'date' },
    });
    expect(wrapper.find('input').attributes('type')).toBe('date');
  });

  it('renders a select with a disabled placeholder option and the given options, emitting on change', async () => {
    const wrapper = mount(FormField, {
      props: {
        modelValue: '',
        label: 'Section',
        type: 'select',
        placeholder: 'Choose a section',
        options: [
          { value: 'sec-1', label: '3B (Main Campus)' },
          { value: 'sec-2', label: '4A (Main Campus)' },
        ],
      },
    });
    const select = wrapper.find('select');
    const opts = select.findAll('option');
    expect(opts).toHaveLength(3);
    expect(opts[0]!.attributes('disabled')).toBeDefined();
    expect(opts[0]!.text()).toBe('Choose a section');
    await select.setValue('sec-2');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['sec-2']);
  });

  it('renders a checkbox with the label shown after the control, using a boolean model', async () => {
    const wrapper = mount(FormField, {
      props: { modelValue: false, label: 'Active', type: 'checkbox' },
    });
    const checkbox = wrapper.find('input[type="checkbox"]');
    expect((checkbox.element as HTMLInputElement).checked).toBe(false);
    expect(wrapper.find('label').text()).toBe('Active');
    await checkbox.setValue(true);
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true]);
  });

  it('does not render the label visibly for non-checkbox types (sr-only only)', () => {
    const wrapper = mount(FormField, {
      props: { modelValue: '', label: 'Full name', type: 'text' },
    });
    const label = wrapper.find('label');
    expect(label.exists()).toBe(true);
    expect(label.classes()).toContain('sr-only');
  });

  it('forwards passthrough attributes like data-testid onto the inner control', () => {
    const wrapper = mount(FormField, {
      props: { modelValue: '', label: 'Full name', type: 'text' },
      attrs: { 'data-testid': 'add-name' },
    });
    expect(wrapper.find('input').attributes('data-testid')).toBe('add-name');
    expect(wrapper.attributes('data-testid')).toBeUndefined();
  });

  it('renders provided error text, and nothing when unset', () => {
    const withError = mount(FormField, {
      props: { modelValue: '', label: 'Full name', type: 'text', error: 'Required' },
    });
    expect(withError.text()).toContain('Required');

    const withoutError = mount(FormField, {
      props: { modelValue: '', label: 'Full name', type: 'text' },
    });
    expect(withoutError.find('.field-error').exists()).toBe(false);
  });

  it('applies the grow class only when the grow prop is set', () => {
    const grown = mount(FormField, {
      props: { modelValue: '', label: 'Full name', type: 'text', grow: true },
    });
    expect(grown.find('.form-field').classes()).toContain('grow');

    const notGrown = mount(FormField, {
      props: { modelValue: '', label: 'Full name', type: 'text' },
    });
    expect(notGrown.find('.form-field').classes()).not.toContain('grow');
  });

  it('exposes a focus() method that focuses the inner control', () => {
    const wrapper = mount(FormField, {
      props: { modelValue: '', label: 'GR number', type: 'text' },
      attachTo: document.body,
    });
    (wrapper.vm as unknown as { focus: () => void }).focus();
    expect(document.activeElement).toBe(wrapper.find('input').element);
    wrapper.unmount();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/FormField.spec.ts`
Expected: FAIL — `Failed to resolve import "./FormField.vue"`.

- [ ] **Step 3: Write minimal implementation**

```vue
<!-- src/components/FormField.vue -->
<script setup lang="ts">
import { ref } from 'vue';

interface FieldOption {
  value: string;
  label: string;
}

withDefaults(
  defineProps<{
    modelValue: string | boolean;
    label: string;
    type: 'text' | 'password' | 'date' | 'select' | 'checkbox';
    options?: FieldOption[];
    placeholder?: string;
    error?: string;
    grow?: boolean;
  }>(),
  { grow: false },
);
defineEmits<{ 'update:modelValue': [value: string | boolean] }>();
defineOptions({ inheritAttrs: false });

const inputRef = ref<HTMLInputElement | HTMLSelectElement | null>(null);
defineExpose({ focus: () => inputRef.value?.focus() });
</script>

<template>
  <label v-if="type === 'checkbox'" class="checkbox-row">
    <input
      ref="inputRef"
      type="checkbox"
      v-bind="$attrs"
      :checked="modelValue as boolean"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    {{ label }}
  </label>
  <div v-else class="form-field" :class="{ grow }">
    <label class="sr-only">{{ label }}</label>
    <select
      v-if="type === 'select'"
      ref="inputRef"
      v-bind="$attrs"
      :value="modelValue"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option v-for="opt in options ?? []" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
    </select>
    <input
      v-else
      ref="inputRef"
      :type="type"
      v-bind="$attrs"
      :value="modelValue"
      :placeholder="placeholder"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <p v-if="error" class="field-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.form-field.grow {
  flex: 1;
}
.form-field input,
.form-field select {
  width: 100%;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
}
.checkbox-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.field-error {
  color: var(--color-destructive);
  font-size: var(--font-size-xs);
  margin-top: 0.2rem;
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/FormField.spec.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add staff-console/src/components/FormField.vue staff-console/src/components/FormField.spec.ts
git commit -m "feat(staff-console): add shared FormField component"
```

---

### Task 3: Widen `useFocusTarget`'s type to accept exposed component instances

**Files:**
- Modify: `src/lib/useFocusTarget.ts`
- Modify: `src/lib/useFocusTarget.spec.ts`

**Interfaces:**
- Consumes: nothing new (this just widens an existing type so `FormField`'s exposed `{ focus(): void }` — Task 2 — satisfies it structurally; a real `HTMLElement` still satisfies the new type too, so no existing caller needs a code change).
- Produces: `useFocusTarget(targets: Record<string, Ref<{ focus(): void } | null>>): void` (was `Record<string, Ref<HTMLElement | null>>`).

- [ ] **Step 1: Write the failing test**

Add this case to the existing spec file (append inside the `describe('useFocusTarget', ...)` block):

```typescript
  it('focuses a non-HTMLElement target that only exposes a focus() method', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/target', name: 'target', component: { template: '<div />' } }],
    });

    const focusSpy = vi.fn();
    const TestComponent = defineComponent({
      setup() {
        const fakeTarget = ref<{ focus(): void } | null>({ focus: focusSpy });
        useFocusTarget({ 'gr-number': fakeTarget });
        return () => h('div');
      },
    });

    await router.push('/target?focus=gr-number');
    await router.isReady();
    const wrapper = mount(TestComponent, { global: { plugins: [router] } });
    await wrapper.vm.$nextTick();

    expect(focusSpy).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run type-check`
Expected: FAIL — TS error, `Ref<{ focus(): void } | null>` is not assignable to `Ref<HTMLElement | null>` parameter of `useFocusTarget`.

(The test itself would actually pass at runtime since JS doesn't enforce the type, but `type-check` must fail first per this project's own `npm run build` gate — verify the TS error before widening the signature.)

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/useFocusTarget.ts
import { onMounted, type Ref } from 'vue';
import { useRoute } from 'vue-router';

interface Focusable {
  focus(): void;
}

// The command palette's "Actions" deep-link into a specific input via a `?focus=<id>` query
// param — the same low-tech convention MessagesView.vue already uses for `?conversationId=`.
// Call this once per view with a map of focus-id -> template ref; on mount, if the current
// route's `focus` query matches a key, that element is focused. Does nothing on a normal,
// non-deep-linked page load, and does nothing if the id doesn't match (e.g. the ref hasn't
// rendered yet because a v-if guards it). Targets may be raw HTMLElements or anything that
// exposes a focus() method (e.g. a FormField instance via defineExpose).
export function useFocusTarget(targets: Record<string, Ref<Focusable | null>>): void {
  const route = useRoute();

  onMounted(() => {
    const focusId = route.query.focus;
    if (typeof focusId !== 'string') return;
    targets[focusId]?.value?.focus();
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run type-check && npm run test -- src/lib/useFocusTarget.spec.ts`
Expected: PASS (type-check clean, 4 tests pass)

- [ ] **Step 5: Commit**

```bash
git add staff-console/src/lib/useFocusTarget.ts staff-console/src/lib/useFocusTarget.spec.ts
git commit -m "refactor(staff-console): widen useFocusTarget to accept exposed component instances"
```

---

### Task 4: `EntityTable.vue`

**Files:**
- Create: `src/components/EntityTable.vue`
- Test: `src/components/EntityTable.spec.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `EntityTable.vue` default export (generic `<script setup lang="ts" generic="T extends Record<string, unknown>">`), props `{ items: T[]; columns: { key: string; label: string }[]; rowKey: keyof T; editingId: unknown }`, scoped slots `#cell-<key>` and `#actions`, each receiving `{ item: T; editing: boolean }`, default cell fallback `{{ item[column.key] }}`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/EntityTable.spec.ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import EntityTable from './EntityTable.vue';

interface Row {
  id: string;
  name: string;
}

const items: Row[] = [
  { id: 'r1', name: 'Alpha' },
  { id: 'r2', name: 'Beta' },
];
const columns = [{ key: 'name', label: 'Name' }];

describe('EntityTable', () => {
  it('renders column headers from the columns prop', () => {
    const wrapper = mount(EntityTable, {
      props: { items, columns, rowKey: 'id', editingId: null },
    });
    const headers = wrapper.findAll('thead th');
    expect(headers[0]!.text()).toBe('Name');
  });

  it('renders default cell content from item[column.key] when no matching slot is provided', () => {
    const wrapper = mount(EntityTable, {
      props: { items, columns, rowKey: 'id', editingId: null },
    });
    expect(wrapper.text()).toContain('Alpha');
    expect(wrapper.text()).toContain('Beta');
  });

  it('renders a custom cell slot, receiving { item, editing }', () => {
    const wrapper = mount(EntityTable, {
      props: { items, columns, rowKey: 'id', editingId: 'r2' },
      slots: {
        'cell-name': `<template #cell-name="{ item, editing }">
          <span :data-testid="'cell-' + item.id">{{ editing ? 'EDITING:' : '' }}{{ item.name }}</span>
        </template>`,
      },
    });
    expect(wrapper.find('[data-testid="cell-r1"]').text()).toBe('Alpha');
    expect(wrapper.find('[data-testid="cell-r2"]').text()).toBe('EDITING:Beta');
  });

  it('renders the actions slot per row, receiving { item, editing }', () => {
    const wrapper = mount(EntityTable, {
      props: { items, columns, rowKey: 'id', editingId: null },
      slots: {
        actions: `<template #actions="{ item }">
          <button :data-testid="'delete-' + item.id">Delete</button>
        </template>`,
      },
    });
    expect(wrapper.find('[data-testid="delete-r1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="delete-r2"]').exists()).toBe(true);
  });

  it('computes editing as true only for the row matching editingId', () => {
    const wrapper = mount(EntityTable, {
      props: { items, columns, rowKey: 'id', editingId: 'r1' },
      slots: {
        'cell-name': `<template #cell-name="{ item, editing }">
          <span :data-testid="'flag-' + item.id">{{ editing }}</span>
        </template>`,
      },
    });
    expect(wrapper.find('[data-testid="flag-r1"]').text()).toBe('true');
    expect(wrapper.find('[data-testid="flag-r2"]').text()).toBe('false');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/EntityTable.spec.ts`
Expected: FAIL — `Failed to resolve import "./EntityTable.vue"`.

- [ ] **Step 3: Write minimal implementation**

```vue
<!-- src/components/EntityTable.vue -->
<script setup lang="ts" generic="T extends Record<string, unknown>">
interface Column {
  key: string;
  label: string;
}

defineProps<{
  items: T[];
  columns: Column[];
  rowKey: keyof T;
  editingId: unknown;
}>();
</script>

<template>
  <table class="entity-table">
    <thead>
      <tr>
        <th v-for="col in columns" :key="col.key">{{ col.label }}</th>
        <th class="actions-col"></th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="item in items" :key="String(item[rowKey])">
        <td v-for="col in columns" :key="col.key">
          <slot :name="`cell-${col.key}`" :item="item" :editing="editingId === item[rowKey]">
            {{ item[col.key] }}
          </slot>
        </td>
        <td class="actions-col">
          <slot name="actions" :item="item" :editing="editingId === item[rowKey]" />
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.entity-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: var(--space-4);
}
.entity-table th,
.entity-table td {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
}
.actions-col {
  width: 1%;
  white-space: nowrap;
  display: flex;
  gap: var(--space-2);
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/EntityTable.spec.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add staff-console/src/components/EntityTable.vue staff-console/src/components/EntityTable.spec.ts
git commit -m "feat(staff-console): add shared EntityTable component"
```

---

### Task 5: `useConfirm.ts`

**Files:**
- Create: `src/lib/useConfirm.ts`
- Test: `src/lib/useConfirm.spec.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `useConfirm(): { confirm(opts: ConfirmOptions): Promise<boolean> }` for call sites; `useConfirmQueue(): { queue: Ref<PendingConfirm[]>; resolveActive(result: boolean): void }` for `ConfirmDialog.vue` (Task 6) to consume. `ConfirmOptions = { title: string; message: string; confirmLabel?: string; danger?: boolean }`. `queue` is true module-level singleton state (not per-component), so any component can call `confirm()` without prop-drilling, and only the head of the queue is ever "active" — a second concurrent `confirm()` call queues behind the first.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/useConfirm.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useConfirm, useConfirmQueue } from './useConfirm';

describe('useConfirm', () => {
  beforeEach(() => {
    useConfirmQueue().queue.value = [];
  });

  it('resolves true when the active confirm is accepted', async () => {
    const { confirm } = useConfirm();
    const { queue, resolveActive } = useConfirmQueue();

    const promise = confirm({ title: 'Delete this school?', message: 'This cannot be undone.', danger: true });
    expect(queue.value).toHaveLength(1);
    expect(queue.value[0]!.title).toBe('Delete this school?');

    resolveActive(true);
    await expect(promise).resolves.toBe(true);
    expect(queue.value).toHaveLength(0);
  });

  it('resolves false when the active confirm is declined', async () => {
    const { confirm } = useConfirm();
    const { resolveActive } = useConfirmQueue();

    const promise = confirm({ title: 'Delete this school?', message: 'This cannot be undone.' });
    resolveActive(false);
    await expect(promise).resolves.toBe(false);
  });

  it('queues a second confirm behind the first, resolving each independently in order', async () => {
    const { confirm } = useConfirm();
    const { queue, resolveActive } = useConfirmQueue();

    const first = confirm({ title: 'First', message: 'm1' });
    const second = confirm({ title: 'Second', message: 'm2' });
    expect(queue.value).toHaveLength(2);
    expect(queue.value[0]!.title).toBe('First');

    resolveActive(true);
    await expect(first).resolves.toBe(true);
    expect(queue.value).toHaveLength(1);
    expect(queue.value[0]!.title).toBe('Second');

    resolveActive(false);
    await expect(second).resolves.toBe(false);
    expect(queue.value).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/useConfirm.spec.ts`
Expected: FAIL — `Failed to resolve import "./useConfirm"`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/useConfirm.ts
import { ref } from 'vue';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

export interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

// Module-level singleton — shared by every component that calls useConfirm(), so a confirmation
// can be requested from any component without prop-drilling a shared instance down to it. Only
// one <ConfirmDialog> is ever mounted (in AppShell.vue), reading this same queue.
const queue = ref<PendingConfirm[]>([]);

function confirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    queue.value = [...queue.value, { ...opts, resolve }];
  });
}

function resolveActive(result: boolean): void {
  const [active, ...rest] = queue.value;
  queue.value = rest;
  active?.resolve(result);
}

export function useConfirm() {
  return { confirm };
}

// Internal — consumed only by ConfirmDialog.vue to render/resolve the head of the queue.
export function useConfirmQueue() {
  return { queue, resolveActive };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/useConfirm.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add staff-console/src/lib/useConfirm.ts staff-console/src/lib/useConfirm.spec.ts
git commit -m "feat(staff-console): add useConfirm singleton confirmation queue"
```

---

### Task 6: `ConfirmDialog.vue` + mount in `AppShell.vue`

**Files:**
- Create: `src/components/ConfirmDialog.vue`
- Test: `src/components/ConfirmDialog.spec.ts`
- Modify: `src/components/AppShell.vue`

**Interfaces:**
- Consumes: `useConfirmQueue()` from `src/lib/useConfirm.ts` (Task 5).
- Produces: `ConfirmDialog.vue` default export, no props (self-contained via the singleton queue), renders nothing when the queue is empty.

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/ConfirmDialog.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ConfirmDialog from './ConfirmDialog.vue';
import { useConfirm, useConfirmQueue } from '../lib/useConfirm';

describe('ConfirmDialog', () => {
  beforeEach(() => {
    useConfirmQueue().queue.value = [];
  });

  it('renders nothing when no confirmation is pending', () => {
    const wrapper = mount(ConfirmDialog);
    expect(wrapper.find('[data-testid="confirm-overlay"]').exists()).toBe(false);
  });

  it('shows the title/message and resolves true when Accept is clicked', async () => {
    const wrapper = mount(ConfirmDialog, { attachTo: document.body });
    const { confirm } = useConfirm();
    const promise = confirm({ title: 'Delete this school?', message: 'This cannot be undone.', danger: true });
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Delete this school?');
    expect(wrapper.text()).toContain('This cannot be undone.');

    await wrapper.find('[data-testid="confirm-accept"]').trigger('click');
    await expect(promise).resolves.toBe(true);
    wrapper.unmount();
  });

  it('resolves false when Cancel is clicked', async () => {
    const wrapper = mount(ConfirmDialog, { attachTo: document.body });
    const { confirm } = useConfirm();
    const promise = confirm({ title: 'Delete this school?', message: 'This cannot be undone.' });
    await wrapper.vm.$nextTick();

    await wrapper.find('[data-testid="confirm-cancel"]').trigger('click');
    await expect(promise).resolves.toBe(false);
    wrapper.unmount();
  });

  it('resolves false on Escape', async () => {
    const wrapper = mount(ConfirmDialog, { attachTo: document.body });
    const { confirm } = useConfirm();
    const promise = confirm({ title: 'Delete this school?', message: 'This cannot be undone.' });
    await wrapper.vm.$nextTick();

    await wrapper.find('[data-testid="confirm-overlay"]').trigger('keydown', { key: 'Escape' });
    await expect(promise).resolves.toBe(false);
    wrapper.unmount();
  });

  it('resolves false on click outside the dialog box', async () => {
    const wrapper = mount(ConfirmDialog, { attachTo: document.body });
    const { confirm } = useConfirm();
    const promise = confirm({ title: 'Delete this school?', message: 'This cannot be undone.' });
    await wrapper.vm.$nextTick();

    await wrapper.find('[data-testid="confirm-overlay"]').trigger('click');
    await expect(promise).resolves.toBe(false);
    wrapper.unmount();
  });

  it('applies a danger class to the accept button when danger is true, and not when omitted', async () => {
    const wrapper = mount(ConfirmDialog, { attachTo: document.body });
    const { confirm } = useConfirm();
    const { resolveActive } = useConfirmQueue();

    confirm({ title: 'Delete this school?', message: 'm', danger: true });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="confirm-accept"]').classes()).toContain('danger');
    resolveActive(false);
    await wrapper.vm.$nextTick();

    confirm({ title: 'Publish this circular?', message: 'm' });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="confirm-accept"]').classes()).not.toContain('danger');
    resolveActive(true);
    wrapper.unmount();
  });

  it('moves focus to Cancel on open and returns it to the previously-focused element on close', async () => {
    document.body.innerHTML = '<button id="trigger">Delete</button>';
    const trigger = document.getElementById('trigger') as HTMLButtonElement;
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const wrapper = mount(ConfirmDialog, { attachTo: document.body });
    const { confirm } = useConfirm();
    const promise = confirm({ title: 'Delete this school?', message: 'm' });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(document.activeElement).toBe(wrapper.find('[data-testid="confirm-cancel"]').element);

    await wrapper.find('[data-testid="confirm-cancel"]').trigger('click');
    await promise;
    await wrapper.vm.$nextTick();

    expect(document.activeElement).toBe(trigger);
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('queues a second pending confirm behind the first', async () => {
    const wrapper = mount(ConfirmDialog, { attachTo: document.body });
    const { confirm } = useConfirm();

    const first = confirm({ title: 'First', message: 'm1' });
    confirm({ title: 'Second', message: 'm2' });
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('First');
    expect(wrapper.text()).not.toContain('Second');

    await wrapper.find('[data-testid="confirm-accept"]').trigger('click');
    await first;
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Second');
    wrapper.unmount();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/ConfirmDialog.spec.ts`
Expected: FAIL — `Failed to resolve import "./ConfirmDialog.vue"`.

- [ ] **Step 3: Write minimal implementation**

```vue
<!-- src/components/ConfirmDialog.vue -->
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useConfirmQueue } from '../lib/useConfirm';

const { queue, resolveActive } = useConfirmQueue();
const active = computed(() => queue.value[0] ?? null);

const cancelRef = ref<HTMLButtonElement | null>(null);
let previouslyFocused: HTMLElement | null = null;

watch(
  active,
  async (current, previous) => {
    if (current && !previous) {
      previouslyFocused = document.activeElement as HTMLElement | null;
      await nextTick();
      cancelRef.value?.focus();
    } else if (!current && previous) {
      previouslyFocused?.focus();
      previouslyFocused = null;
    }
  },
  { flush: 'post' },
);

function onConfirm() {
  resolveActive(true);
}
function onCancel() {
  resolveActive(false);
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') onCancel();
}
</script>

<template>
  <div
    v-if="active"
    class="confirm-overlay"
    data-testid="confirm-overlay"
    @click.self="onCancel"
    @keydown="onKeydown"
  >
    <div class="confirm-dialog" role="dialog" aria-modal="true" :aria-label="active.title">
      <h2>{{ active.title }}</h2>
      <p>{{ active.message }}</p>
      <div class="confirm-actions">
        <button ref="cancelRef" type="button" class="cancel" data-testid="confirm-cancel" @click="onCancel">
          Cancel
        </button>
        <button
          type="button"
          class="accept"
          :class="{ danger: active.danger }"
          data-testid="confirm-accept"
          @click="onConfirm"
        >
          {{ active.confirmLabel ?? 'Confirm' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 12, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}
.confirm-dialog {
  width: min(420px, 92vw);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: 0 20px 60px -12px rgba(15, 23, 42, 0.35);
  padding: var(--space-4);
}
.confirm-dialog h2 {
  font-size: var(--font-size-lg);
  margin-bottom: var(--space-2);
}
.confirm-dialog p {
  color: var(--color-muted);
  margin-bottom: var(--space-4);
}
.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
.confirm-actions button {
  padding: 0.4rem 0.8rem;
  border-radius: var(--radius-sm);
  font-weight: 600;
  cursor: pointer;
}
.confirm-actions .cancel {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text);
}
.confirm-actions .accept {
  border: none;
  background: var(--color-accent);
  color: var(--color-on-primary);
}
.confirm-actions .accept.danger {
  background: var(--color-destructive);
}
</style>
```

Now mount it in `AppShell.vue` alongside `<CommandPalette>`:

```typescript
// src/components/AppShell.vue — add to the existing <script setup> imports
import ConfirmDialog from './ConfirmDialog.vue';
```

```html
<!-- src/components/AppShell.vue — add right after the existing <CommandPalette ... /> block -->
    <ConfirmDialog />
  </div>
</template>
```

(This replaces the closing `</div>` that currently follows `<CommandPalette ... />` at the end of the template — `<ConfirmDialog />` is added as the new last child of `.shell`, no props needed.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/ConfirmDialog.spec.ts src/components/AppShell.spec.ts`
Expected: PASS (8 `ConfirmDialog` tests; all pre-existing `AppShell` tests still pass since `<ConfirmDialog />` renders nothing while its queue is empty)

- [ ] **Step 5: Commit**

```bash
git add staff-console/src/components/ConfirmDialog.vue staff-console/src/components/ConfirmDialog.spec.ts staff-console/src/components/AppShell.vue
git commit -m "feat(staff-console): add ConfirmDialog and mount it in AppShell"
```

---

### Task 7: Migrate `SchoolManagementView.vue` (reference migration)

This is the pattern every later CRUD-screen task repeats verbatim, substituting only the entity-specific details. Read this task in full even when doing a later one — it isn't re-explained there.

**Files:**
- Modify: `src/views/SchoolManagementView.vue`
- Modify: `src/views/SchoolManagementView.spec.ts`

**Interfaces:**
- Consumes: `EntityTable.vue` (Task 4), `FormField.vue` (Task 2), `Button.vue` (Task 1), `useConfirm()` (Task 5).

- [ ] **Step 1: Update the spec's confirm mocking, and rewrite the delete tests**

Replace the whole file:

```typescript
// src/views/SchoolManagementView.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SchoolManagementView from './SchoolManagementView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';
import { useConfirm } from '../lib/useConfirm';

vi.mock('../lib/api', () => ({
  api: {
    listSchools: vi.fn(),
    createSchool: vi.fn(),
    updateSchool: vi.fn(),
    deleteSchool: vi.fn(),
  },
}));
vi.mock('../lib/useConfirm', () => ({
  useConfirm: vi.fn(),
}));

describe('SchoolManagementView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listSchools).mockResolvedValue([{ id: 's1', name: 'The Seeds School' }]);
    vi.mocked(useConfirm).mockReturnValue({ confirm: vi.fn().mockResolvedValue(true) });
  });

  it('lists schools and creates a new one', async () => {
    vi.mocked(api.createSchool).mockResolvedValue(undefined);

    const wrapper = mount(SchoolManagementView);
    await flushPromises();

    expect(wrapper.text()).toContain('The Seeds School');

    await wrapper.find('[data-testid="add-name"]').setValue('Second School');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createSchool).toHaveBeenCalledWith('token-1', { name: 'Second School' });
    expect(api.listSchools).toHaveBeenCalledTimes(2);
  });

  it('edits a school in place', async () => {
    vi.mocked(api.updateSchool).mockResolvedValue(undefined);

    const wrapper = mount(SchoolManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="edit-s1"]').trigger('click');
    await wrapper.find('[data-testid="edit-name-s1"]').setValue('Renamed School');
    await wrapper.find('[data-testid="save-s1"]').trigger('click');
    await flushPromises();

    expect(api.updateSchool).toHaveBeenCalledWith('token-1', 's1', { name: 'Renamed School' });
  });

  it('deletes a school after confirmation, and does nothing if the confirmation is declined', async () => {
    vi.mocked(api.deleteSchool).mockResolvedValue(undefined);
    const confirmFn = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.mocked(useConfirm).mockReturnValue({ confirm: confirmFn });

    const wrapper = mount(SchoolManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-s1"]').trigger('click');
    await flushPromises();
    expect(api.deleteSchool).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="delete-s1"]').trigger('click');
    await flushPromises();
    expect(api.deleteSchool).toHaveBeenCalledWith('token-1', 's1');
    expect(confirmFn).toHaveBeenCalledWith({
      title: 'Delete this school?',
      message: 'This cannot be undone.',
      danger: true,
    });
  });

  it('shows the backend error when delete is blocked by dependent records', async () => {
    vi.mocked(api.deleteSchool).mockRejectedValue(new Error('Cannot delete this School: other records still reference it.'));

    const wrapper = mount(SchoolManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-s1"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Cannot delete this School');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/views/SchoolManagementView.spec.ts`
Expected: FAIL — the mocked `useConfirm` never gets called because `SchoolManagementView.vue` still calls `window.confirm` directly, so `api.deleteSchool` is never invoked and the first assertion in the delete test fails (`toHaveBeenCalledWith` on an uncalled mock).

- [ ] **Step 3: Migrate the view**

```vue
<!-- src/views/SchoolManagementView.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type SchoolSummary } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import { useConfirm } from '../lib/useConfirm';

const auth = useAuthStore();
const { confirm } = useConfirm();

const schools = ref<SchoolSummary[]>([]);
const errorMessage = ref<string | null>(null);

const newName = ref('');
const isSaving = ref(false);

const editingId = ref<string | null>(null);
const editName = ref('');

async function load() {
  if (!auth.accessToken) return;
  try {
    schools.value = await api.listSchools(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load schools.';
  }
}
load();

async function onAdd() {
  if (!auth.accessToken || !newName.value.trim()) return;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createSchool(auth.accessToken, { name: newName.value.trim() });
    newName.value = '';
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not create this school.';
  } finally {
    isSaving.value = false;
  }
}

function startEdit(school: SchoolSummary) {
  editingId.value = school.id;
  editName.value = school.name;
}

function cancelEdit() {
  editingId.value = null;
}

async function onSaveEdit(id: string) {
  if (!auth.accessToken || !editName.value.trim()) return;
  errorMessage.value = null;
  try {
    await api.updateSchool(auth.accessToken, id, { name: editName.value.trim() });
    editingId.value = null;
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this school.';
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!(await confirm({ title: 'Delete this school?', message: 'This cannot be undone.', danger: true }))) return;
  errorMessage.value = null;
  try {
    await api.deleteSchool(auth.accessToken, id);
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this school.';
  }
}
</script>

<template>
  <div class="org-entity">
    <h1>Schools</h1>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <EntityTable :items="schools" :columns="[{ key: 'name', label: 'Name' }]" row-key="id" :editing-id="editingId">
      <template #cell-name="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-name-${item.id}`" v-model="editName" type="text" />
        <span v-else>{{ item.name }}</span>
      </template>
      <template #actions="{ item, editing }">
        <template v-if="editing">
          <Button :data-testid="`save-${item.id}`" @click="onSaveEdit(item.id)">Save</Button>
          <Button variant="secondary" @click="cancelEdit">Cancel</Button>
        </template>
        <template v-else>
          <Button :data-testid="`edit-${item.id}`" @click="startEdit(item)">Edit</Button>
          <Button variant="secondary" :data-testid="`delete-${item.id}`" @click="onDelete(item.id)">
            Delete
          </Button>
        </template>
      </template>
    </EntityTable>

    <div class="inline-form">
      <FormField v-model="newName" label="School name" type="text" data-testid="add-name" placeholder="School name" grow />
      <Button data-testid="add-submit" :disabled="isSaving" @click="onAdd">Add</Button>
    </div>
  </div>
</template>

<style scoped>
.org-entity {
  max-width: 720px;
}
.error {
  color: var(--color-destructive);
  margin-bottom: var(--space-3);
}
.inline-form {
  display: flex;
  gap: var(--space-2);
  align-items: flex-end;
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/views/SchoolManagementView.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add staff-console/src/views/SchoolManagementView.vue staff-console/src/views/SchoolManagementView.spec.ts
git commit -m "refactor(staff-console): migrate SchoolManagementView onto shared components"
```

---

### Task 8: Migrate `CampusManagementView.vue`

**Files:**
- Modify: `src/views/CampusManagementView.vue`
- Modify: `src/views/CampusManagementView.spec.ts`

**Interfaces:**
- Consumes: `EntityTable.vue`, `FormField.vue`, `Button.vue`, `useConfirm()` — same as Task 7.

- [ ] **Step 1: Update the spec's confirm mocking and delete test**

Find the existing `vi.mock('../lib/api', ...)` block at the top of `src/views/CampusManagementView.spec.ts` and add a `useConfirm` mock and import right after it:

```typescript
import { useConfirm } from '../lib/useConfirm';
// ...(after the existing vi.mock('../lib/api', ...) call)
vi.mock('../lib/useConfirm', () => ({
  useConfirm: vi.fn(),
}));
```

In the file's `beforeEach`, add (alongside the existing `api` mock resets):

```typescript
    vi.mocked(useConfirm).mockReturnValue({ confirm: vi.fn().mockResolvedValue(true) });
```

Find the existing delete test (it currently does `vi.spyOn(window, 'confirm')...`) and replace its confirm setup with:

```typescript
  it('deletes a campus after confirmation, and does nothing if the confirmation is declined', async () => {
    vi.mocked(api.deleteCampus).mockResolvedValue(undefined);
    const confirmFn = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.mocked(useConfirm).mockReturnValue({ confirm: confirmFn });

    const wrapper = mount(CampusManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-c1"]').trigger('click');
    await flushPromises();
    expect(api.deleteCampus).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="delete-c1"]').trigger('click');
    await flushPromises();
    expect(api.deleteCampus).toHaveBeenCalledWith('token-1', 'c1');
    expect(confirmFn).toHaveBeenCalledWith({
      title: 'Delete this campus?',
      message: 'This cannot be undone.',
      danger: true,
    });
  });
```

(Keep the actual row id used — match whatever fixture id the existing spec file already uses in its `listCampuses` mock; adjust `c1` above to that id if different.)

Also remove `vi.spyOn(window, 'confirm')...` from any other test in the file that relies on delete succeeding (e.g. a "shows the backend error" test) and replace it with the same `vi.mocked(useConfirm).mockReturnValue({ confirm: vi.fn().mockResolvedValue(true) })` pattern (already the `beforeEach` default, so such tests likely need no per-test override at all — just delete the `window.confirm` spy line).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/views/CampusManagementView.spec.ts`
Expected: FAIL — same shape of failure as Task 7 Step 2 (view still calls `window.confirm` directly).

- [ ] **Step 3: Migrate the view**

```vue
<!-- src/views/CampusManagementView.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type CampusSummary, type SchoolSummary } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import { useConfirm } from '../lib/useConfirm';

const auth = useAuthStore();
const { confirm } = useConfirm();

const schools = ref<SchoolSummary[]>([]);
const campuses = ref<CampusSummary[]>([]);
const errorMessage = ref<string | null>(null);

const newSchoolId = ref('');
const newName = ref('');
const isSaving = ref(false);

const editingId = ref<string | null>(null);
const editName = ref('');

async function load() {
  if (!auth.accessToken) return;
  try {
    [schools.value, campuses.value] = await Promise.all([
      api.listSchools(auth.accessToken),
      api.listCampuses(auth.accessToken),
    ]);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load campuses.';
  }
}
load();

async function onAdd() {
  if (!auth.accessToken || !newSchoolId.value || !newName.value.trim()) return;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createCampus(auth.accessToken, { schoolId: newSchoolId.value, name: newName.value.trim() });
    newName.value = '';
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not create this campus.';
  } finally {
    isSaving.value = false;
  }
}

function startEdit(campus: CampusSummary) {
  editingId.value = campus.id;
  editName.value = campus.name;
}

function cancelEdit() {
  editingId.value = null;
}

async function onSaveEdit(id: string) {
  if (!auth.accessToken || !editName.value.trim()) return;
  errorMessage.value = null;
  try {
    await api.updateCampus(auth.accessToken, id, { name: editName.value.trim() });
    editingId.value = null;
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this campus.';
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!(await confirm({ title: 'Delete this campus?', message: 'This cannot be undone.', danger: true }))) return;
  errorMessage.value = null;
  try {
    await api.deleteCampus(auth.accessToken, id);
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this campus.';
  }
}
</script>

<template>
  <div class="org-entity">
    <h1>Campuses</h1>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <EntityTable
      :items="campuses"
      :columns="[{ key: 'name', label: 'Name' }, { key: 'schoolName', label: 'School' }]"
      row-key="id"
      :editing-id="editingId"
    >
      <template #cell-name="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-name-${item.id}`" v-model="editName" type="text" />
        <span v-else>{{ item.name }}</span>
      </template>
      <template #actions="{ item, editing }">
        <template v-if="editing">
          <Button :data-testid="`save-${item.id}`" @click="onSaveEdit(item.id)">Save</Button>
          <Button variant="secondary" @click="cancelEdit">Cancel</Button>
        </template>
        <template v-else>
          <Button :data-testid="`edit-${item.id}`" @click="startEdit(item)">Edit</Button>
          <Button variant="secondary" :data-testid="`delete-${item.id}`" @click="onDelete(item.id)">
            Delete
          </Button>
        </template>
      </template>
    </EntityTable>

    <div class="inline-form">
      <FormField
        v-model="newSchoolId"
        label="School"
        type="select"
        data-testid="add-school"
        placeholder="Choose a school"
        :options="schools.map((s) => ({ value: s.id, label: s.name }))"
      />
      <FormField v-model="newName" label="Campus name" type="text" data-testid="add-name" placeholder="Campus name" grow />
      <Button data-testid="add-submit" :disabled="isSaving" @click="onAdd">Add</Button>
    </div>
  </div>
</template>

<style scoped>
.org-entity {
  max-width: 720px;
}
.error {
  color: var(--color-destructive);
  margin-bottom: var(--space-3);
}
.inline-form {
  display: flex;
  gap: var(--space-2);
  align-items: flex-end;
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/views/CampusManagementView.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add staff-console/src/views/CampusManagementView.vue staff-console/src/views/CampusManagementView.spec.ts
git commit -m "refactor(staff-console): migrate CampusManagementView onto shared components"
```

---

### Task 9: Migrate `AcademicSessionManagementView.vue`

**Files:**
- Modify: `src/views/AcademicSessionManagementView.vue`
- Modify: `src/views/AcademicSessionManagementView.spec.ts`

**Interfaces:**
- Consumes: `EntityTable.vue`, `FormField.vue` (`type="date"` from Task 2's Resolved Spec Gap #1), `Button.vue`, `useConfirm()`.

- [ ] **Step 1: Update the spec's confirm mocking and delete test**

Same pattern as Task 8 Step 1: add `import { useConfirm } from '../lib/useConfirm';` and `vi.mock('../lib/useConfirm', () => ({ useConfirm: vi.fn() }));`, add the default mock to `beforeEach`, and rewrite the delete test:

```typescript
  it('deletes an academic session after confirmation, and does nothing if the confirmation is declined', async () => {
    vi.mocked(api.deleteAcademicSession).mockResolvedValue(undefined);
    const confirmFn = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.mocked(useConfirm).mockReturnValue({ confirm: confirmFn });

    const wrapper = mount(AcademicSessionManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-as1"]').trigger('click');
    await flushPromises();
    expect(api.deleteAcademicSession).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="delete-as1"]').trigger('click');
    await flushPromises();
    expect(api.deleteAcademicSession).toHaveBeenCalledWith('token-1', 'as1');
    expect(confirmFn).toHaveBeenCalledWith({
      title: 'Delete this academic session?',
      message: 'This cannot be undone.',
      danger: true,
    });
  });
```

(Match `as1` to whatever fixture id the existing spec already uses.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/views/AcademicSessionManagementView.spec.ts`
Expected: FAIL (view still calls `window.confirm`)

- [ ] **Step 3: Migrate the view**

```vue
<!-- src/views/AcademicSessionManagementView.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type AcademicSessionSummary } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import { useConfirm } from '../lib/useConfirm';

const auth = useAuthStore();
const { confirm } = useConfirm();

const sessions = ref<AcademicSessionSummary[]>([]);
const errorMessage = ref<string | null>(null);

const newLabel = ref('');
const newStart = ref('');
const newEnd = ref('');
const newActive = ref(false);
const isSaving = ref(false);

const editingId = ref<string | null>(null);
const editLabel = ref('');
const editStart = ref('');
const editEnd = ref('');
const editActive = ref(false);

async function load() {
  if (!auth.accessToken) return;
  try {
    sessions.value = await api.listAcademicSessions(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load academic sessions.';
  }
}
load();

async function onAdd() {
  if (!auth.accessToken || !newLabel.value.trim() || !newStart.value || !newEnd.value) return;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createAcademicSession(auth.accessToken, {
      label: newLabel.value.trim(),
      startDate: newStart.value,
      endDate: newEnd.value,
      isActive: newActive.value,
    });
    newLabel.value = '';
    newStart.value = '';
    newEnd.value = '';
    newActive.value = false;
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not create this academic session.';
  } finally {
    isSaving.value = false;
  }
}

function startEdit(session: AcademicSessionSummary) {
  editingId.value = session.id;
  editLabel.value = session.label;
  editStart.value = session.startDate;
  editEnd.value = session.endDate;
  editActive.value = session.isActive;
}

function cancelEdit() {
  editingId.value = null;
}

async function onSaveEdit(id: string) {
  if (!auth.accessToken || !editLabel.value.trim() || !editStart.value || !editEnd.value) return;
  errorMessage.value = null;
  try {
    await api.updateAcademicSession(auth.accessToken, id, {
      label: editLabel.value.trim(),
      startDate: editStart.value,
      endDate: editEnd.value,
      isActive: editActive.value,
    });
    editingId.value = null;
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this academic session.';
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (
    !(await confirm({ title: 'Delete this academic session?', message: 'This cannot be undone.', danger: true }))
  )
    return;
  errorMessage.value = null;
  try {
    await api.deleteAcademicSession(auth.accessToken, id);
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this academic session.';
  }
}
</script>

<template>
  <div class="org-entity">
    <h1>Academic Sessions</h1>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <EntityTable
      :items="sessions"
      :columns="[
        { key: 'label', label: 'Label' },
        { key: 'startDate', label: 'Start' },
        { key: 'endDate', label: 'End' },
        { key: 'isActive', label: 'Active' },
      ]"
      row-key="id"
      :editing-id="editingId"
    >
      <template #cell-label="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-label-${item.id}`" v-model="editLabel" type="text" />
        <span v-else>{{ item.label }}</span>
      </template>
      <template #cell-startDate="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-start-${item.id}`" v-model="editStart" type="date" />
        <span v-else>{{ item.startDate }}</span>
      </template>
      <template #cell-endDate="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-end-${item.id}`" v-model="editEnd" type="date" />
        <span v-else>{{ item.endDate }}</span>
      </template>
      <template #cell-isActive="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-active-${item.id}`" v-model="editActive" type="checkbox" />
        <span v-else>{{ item.isActive ? 'Active' : '—' }}</span>
      </template>
      <template #actions="{ item, editing }">
        <template v-if="editing">
          <Button :data-testid="`save-${item.id}`" @click="onSaveEdit(item.id)">Save</Button>
          <Button variant="secondary" @click="cancelEdit">Cancel</Button>
        </template>
        <template v-else>
          <Button :data-testid="`edit-${item.id}`" @click="startEdit(item)">Edit</Button>
          <Button variant="secondary" :data-testid="`delete-${item.id}`" @click="onDelete(item.id)">
            Delete
          </Button>
        </template>
      </template>
    </EntityTable>

    <div class="inline-form">
      <FormField v-model="newLabel" label="Session label" type="text" data-testid="add-label" placeholder="e.g. 2027-2028" />
      <FormField v-model="newStart" label="Start date" type="date" data-testid="add-start" />
      <FormField v-model="newEnd" label="End date" type="date" data-testid="add-end" />
      <FormField v-model="newActive" label="Active" type="checkbox" data-testid="add-active" />
      <Button data-testid="add-submit" :disabled="isSaving" @click="onAdd">Add</Button>
    </div>
  </div>
</template>

<style scoped>
.org-entity {
  max-width: 900px;
}
.error {
  color: var(--color-destructive);
  margin-bottom: var(--space-3);
}
.inline-form {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
</style>
```

Note: `grow` is intentionally omitted on every `FormField` here — per Resolved Spec Gap #5, this view's original CSS never had a `flex: 1` rule on any field.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/views/AcademicSessionManagementView.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add staff-console/src/views/AcademicSessionManagementView.vue staff-console/src/views/AcademicSessionManagementView.spec.ts
git commit -m "refactor(staff-console): migrate AcademicSessionManagementView onto shared components"
```

---

### Task 10: Migrate `SectionManagementView.vue`

**Files:**
- Modify: `src/views/SectionManagementView.vue`
- Modify: `src/views/SectionManagementView.spec.ts`

**Interfaces:**
- Consumes: `EntityTable.vue`, `FormField.vue`, `Button.vue`, `useConfirm()`.

- [ ] **Step 1: Update the spec's confirm mocking and delete test**

Same pattern as Task 8 Step 1, entity noun "section":

```typescript
  it('deletes a section after confirmation, and does nothing if the confirmation is declined', async () => {
    vi.mocked(api.deleteSection).mockResolvedValue(undefined);
    const confirmFn = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.mocked(useConfirm).mockReturnValue({ confirm: confirmFn });

    const wrapper = mount(SectionManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-sec1"]').trigger('click');
    await flushPromises();
    expect(api.deleteSection).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="delete-sec1"]').trigger('click');
    await flushPromises();
    expect(api.deleteSection).toHaveBeenCalledWith('token-1', 'sec1');
    expect(confirmFn).toHaveBeenCalledWith({
      title: 'Delete this section?',
      message: 'This cannot be undone.',
      danger: true,
    });
  });
```

(Match the row id to whatever fixture the existing spec uses.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/views/SectionManagementView.spec.ts`
Expected: FAIL (view still calls `window.confirm`)

- [ ] **Step 3: Migrate the view**

```vue
<!-- src/views/SectionManagementView.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type SectionSummary, type ClassSummary, type TeacherSummary } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import { useConfirm } from '../lib/useConfirm';

const auth = useAuthStore();
const { confirm } = useConfirm();

const classes = ref<ClassSummary[]>([]);
const teachers = ref<TeacherSummary[]>([]);
const sections = ref<SectionSummary[]>([]);
const errorMessage = ref<string | null>(null);

const newClassId = ref('');
const newName = ref('');
const newTeacherId = ref('');
const isSaving = ref(false);

const editingId = ref<string | null>(null);
const editName = ref('');
const editTeacherId = ref('');

async function load() {
  if (!auth.accessToken) return;
  try {
    [classes.value, teachers.value, sections.value] = await Promise.all([
      api.listClasses(auth.accessToken),
      api.listTeachers(auth.accessToken),
      api.listSections(auth.accessToken),
    ]);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load sections.';
  }
}
load();

async function onAdd() {
  if (!auth.accessToken || !newClassId.value || !newName.value.trim()) return;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createSection(auth.accessToken, {
      classId: newClassId.value,
      name: newName.value.trim(),
      classTeacherId: newTeacherId.value || undefined,
    });
    newName.value = '';
    newTeacherId.value = '';
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not create this section.';
  } finally {
    isSaving.value = false;
  }
}

function startEdit(section: SectionSummary) {
  editingId.value = section.id;
  editName.value = section.name;
  editTeacherId.value = section.classTeacherId ?? '';
}

function cancelEdit() {
  editingId.value = null;
}

async function onSaveEdit(id: string) {
  if (!auth.accessToken || !editName.value.trim()) return;
  errorMessage.value = null;
  try {
    await api.updateSection(auth.accessToken, id, {
      name: editName.value.trim(),
      classTeacherId: editTeacherId.value || null,
    });
    editingId.value = null;
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this section.';
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!(await confirm({ title: 'Delete this section?', message: 'This cannot be undone.', danger: true }))) return;
  errorMessage.value = null;
  try {
    await api.deleteSection(auth.accessToken, id);
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this section.';
  }
}
</script>

<template>
  <div class="org-entity">
    <h1>Sections</h1>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <EntityTable
      :items="sections"
      :columns="[
        { key: 'name', label: 'Name' },
        { key: 'className', label: 'Class' },
        { key: 'campusName', label: 'Campus' },
        { key: 'classTeacherName', label: 'Class Teacher' },
      ]"
      row-key="id"
      :editing-id="editingId"
    >
      <template #cell-name="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-name-${item.id}`" v-model="editName" type="text" />
        <span v-else>{{ item.name }}</span>
      </template>
      <template #cell-classTeacherName="{ item, editing }">
        <select v-if="editing" :data-testid="`edit-teacher-${item.id}`" v-model="editTeacherId">
          <option value="">— None —</option>
          <option v-for="t in teachers" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
        <span v-else>{{ item.classTeacherName ?? '— None —' }}</span>
      </template>
      <template #actions="{ item, editing }">
        <template v-if="editing">
          <Button :data-testid="`save-${item.id}`" @click="onSaveEdit(item.id)">Save</Button>
          <Button variant="secondary" @click="cancelEdit">Cancel</Button>
        </template>
        <template v-else>
          <Button :data-testid="`edit-${item.id}`" @click="startEdit(item)">Edit</Button>
          <Button variant="secondary" :data-testid="`delete-${item.id}`" @click="onDelete(item.id)">
            Delete
          </Button>
        </template>
      </template>
    </EntityTable>

    <div class="inline-form">
      <FormField
        v-model="newClassId"
        label="Class"
        type="select"
        data-testid="add-class"
        placeholder="Choose a class"
        :options="classes.map((c) => ({ value: c.id, label: `${c.name} (${c.campusName})` }))"
      />
      <FormField v-model="newName" label="Section name" type="text" data-testid="add-name" placeholder="e.g. 3B" grow />
      <FormField
        v-model="newTeacherId"
        label="Class teacher"
        type="select"
        data-testid="add-teacher"
        :options="[{ value: '', label: '— No class teacher —' }, ...teachers.map((t) => ({ value: t.id, label: t.name }))]"
      />
      <Button data-testid="add-submit" :disabled="isSaving" @click="onAdd">Add</Button>
    </div>
  </div>
</template>

<style scoped>
.org-entity {
  max-width: 960px;
}
.error {
  color: var(--color-destructive);
  margin-bottom: var(--space-3);
}
.inline-form {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  flex-wrap: wrap;
}
</style>
```

Note the `add-teacher` field: the original markup has no `placeholder` (its first `<option value="">` is a real, selectable "— No class teacher —" default, not a disabled placeholder). `FormField`'s `placeholder` prop always renders as `disabled`, so it can't represent this selectable empty option — it's passed as a real first entry in `options` instead (`{ value: '', label: '— No class teacher —' }`), with no `placeholder` prop set. This preserves the exact original behavior (empty string is a valid, selectable value here) without needing any FormField change.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/views/SectionManagementView.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add staff-console/src/views/SectionManagementView.vue staff-console/src/views/SectionManagementView.spec.ts
git commit -m "refactor(staff-console): migrate SectionManagementView onto shared components"
```

---

### Task 11: Migrate `ClassManagementView.vue`

**Files:**
- Modify: `src/views/ClassManagementView.vue`
- Modify: `src/views/ClassManagementView.spec.ts`

**Interfaces:**
- Consumes: `EntityTable.vue`, `FormField.vue`, `Button.vue`, `useConfirm()`.

- [ ] **Step 1: Update the spec's confirm mocking and delete test**

Same pattern, entity noun "class":

```typescript
  it('deletes a class after confirmation, and does nothing if the confirmation is declined', async () => {
    vi.mocked(api.deleteClass).mockResolvedValue(undefined);
    const confirmFn = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.mocked(useConfirm).mockReturnValue({ confirm: confirmFn });

    const wrapper = mount(ClassManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-c1"]').trigger('click');
    await flushPromises();
    expect(api.deleteClass).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="delete-c1"]').trigger('click');
    await flushPromises();
    expect(api.deleteClass).toHaveBeenCalledWith('token-1', 'c1');
    expect(confirmFn).toHaveBeenCalledWith({
      title: 'Delete this class?',
      message: 'This cannot be undone.',
      danger: true,
    });
  });
```

(Match the row id to the existing fixture; plus the `useConfirm` import/mock/`beforeEach` wiring shown in Task 8 Step 1.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/views/ClassManagementView.spec.ts`
Expected: FAIL (view still calls `window.confirm`)

- [ ] **Step 3: Migrate the view**

```vue
<!-- src/views/ClassManagementView.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type ClassSummary, type CampusSummary, type AcademicSessionSummary } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import { useConfirm } from '../lib/useConfirm';

const auth = useAuthStore();
const { confirm } = useConfirm();

const campuses = ref<CampusSummary[]>([]);
const academicSessions = ref<AcademicSessionSummary[]>([]);
const classes = ref<ClassSummary[]>([]);
const errorMessage = ref<string | null>(null);

const newCampusId = ref('');
const newAcademicSessionId = ref('');
const newName = ref('');
const isSaving = ref(false);

const editingId = ref<string | null>(null);
const editName = ref('');

async function load() {
  if (!auth.accessToken) return;
  try {
    [campuses.value, academicSessions.value, classes.value] = await Promise.all([
      api.listCampuses(auth.accessToken),
      api.listAcademicSessions(auth.accessToken),
      api.listClasses(auth.accessToken),
    ]);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load classes.';
  }
}
load();

async function onAdd() {
  if (!auth.accessToken || !newCampusId.value || !newAcademicSessionId.value || !newName.value.trim()) return;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createClass(auth.accessToken, {
      campusId: newCampusId.value,
      academicSessionId: newAcademicSessionId.value,
      name: newName.value.trim(),
    });
    newName.value = '';
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not create this class.';
  } finally {
    isSaving.value = false;
  }
}

function startEdit(klass: ClassSummary) {
  editingId.value = klass.id;
  editName.value = klass.name;
}

function cancelEdit() {
  editingId.value = null;
}

async function onSaveEdit(id: string) {
  if (!auth.accessToken || !editName.value.trim()) return;
  errorMessage.value = null;
  try {
    await api.updateClass(auth.accessToken, id, { name: editName.value.trim() });
    editingId.value = null;
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this class.';
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!(await confirm({ title: 'Delete this class?', message: 'This cannot be undone.', danger: true }))) return;
  errorMessage.value = null;
  try {
    await api.deleteClass(auth.accessToken, id);
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this class.';
  }
}
</script>

<template>
  <div class="org-entity">
    <h1>Classes</h1>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <EntityTable
      :items="classes"
      :columns="[
        { key: 'name', label: 'Name' },
        { key: 'campusName', label: 'Campus' },
        { key: 'academicSessionLabel', label: 'Academic Session' },
      ]"
      row-key="id"
      :editing-id="editingId"
    >
      <template #cell-name="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-name-${item.id}`" v-model="editName" type="text" />
        <span v-else>{{ item.name }}</span>
      </template>
      <template #actions="{ item, editing }">
        <template v-if="editing">
          <Button :data-testid="`save-${item.id}`" @click="onSaveEdit(item.id)">Save</Button>
          <Button variant="secondary" @click="cancelEdit">Cancel</Button>
        </template>
        <template v-else>
          <Button :data-testid="`edit-${item.id}`" @click="startEdit(item)">Edit</Button>
          <Button variant="secondary" :data-testid="`delete-${item.id}`" @click="onDelete(item.id)">
            Delete
          </Button>
        </template>
      </template>
    </EntityTable>

    <div class="inline-form">
      <FormField
        v-model="newCampusId"
        label="Campus"
        type="select"
        data-testid="add-campus"
        placeholder="Choose a campus"
        :options="campuses.map((c) => ({ value: c.id, label: c.name }))"
      />
      <FormField
        v-model="newAcademicSessionId"
        label="Academic session"
        type="select"
        data-testid="add-session"
        placeholder="Choose an academic session"
        :options="academicSessions.map((s) => ({ value: s.id, label: s.label }))"
      />
      <FormField v-model="newName" label="Class name" type="text" data-testid="add-name" placeholder="e.g. Grade 4" grow />
      <Button data-testid="add-submit" :disabled="isSaving" @click="onAdd">Add</Button>
    </div>
  </div>
</template>

<style scoped>
.org-entity {
  max-width: 900px;
}
.error {
  color: var(--color-destructive);
  margin-bottom: var(--space-3);
}
.inline-form {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  flex-wrap: wrap;
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/views/ClassManagementView.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add staff-console/src/views/ClassManagementView.vue staff-console/src/views/ClassManagementView.spec.ts
git commit -m "refactor(staff-console): migrate ClassManagementView onto shared components"
```

---

### Task 12: Migrate `TeacherManagementView.vue`

**Files:**
- Modify: `src/views/TeacherManagementView.vue`
- Modify: `src/views/TeacherManagementView.spec.ts`

**Interfaces:**
- Consumes: `EntityTable.vue`, `FormField.vue` (`type="password"`), `Button.vue`, `useConfirm()`.

- [ ] **Step 1: Update the spec's confirm mocking and delete test**

Same pattern, entity noun "teacher":

```typescript
  it('deletes a teacher after confirmation, and does nothing if the confirmation is declined', async () => {
    vi.mocked(api.deleteTeacher).mockResolvedValue(undefined);
    const confirmFn = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.mocked(useConfirm).mockReturnValue({ confirm: confirmFn });

    const wrapper = mount(TeacherManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-t1"]').trigger('click');
    await flushPromises();
    expect(api.deleteTeacher).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="delete-t1"]').trigger('click');
    await flushPromises();
    expect(api.deleteTeacher).toHaveBeenCalledWith('token-1', 't1');
    expect(confirmFn).toHaveBeenCalledWith({
      title: 'Delete this teacher?',
      message: 'This cannot be undone.',
      danger: true,
    });
  });
```

(Match the row id to the existing fixture; plus the standard `useConfirm` import/mock/`beforeEach` wiring.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/views/TeacherManagementView.spec.ts`
Expected: FAIL (view still calls `window.confirm`)

- [ ] **Step 3: Migrate the view**

```vue
<!-- src/views/TeacherManagementView.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type TeacherAdminSummary } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import { useConfirm } from '../lib/useConfirm';

const auth = useAuthStore();
const { confirm } = useConfirm();

const teachers = ref<TeacherAdminSummary[]>([]);
const errorMessage = ref<string | null>(null);

const newIdentifier = ref('');
const newPassword = ref('');
const newName = ref('');
const isSaving = ref(false);

const editingId = ref<string | null>(null);
const editName = ref('');
const editPassword = ref('');

async function load() {
  if (!auth.accessToken) return;
  try {
    teachers.value = await api.listAdminTeachers(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load teachers.';
  }
}
load();

async function onAdd() {
  if (!auth.accessToken || !newIdentifier.value.trim() || !newPassword.value || !newName.value.trim()) return;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createTeacher(auth.accessToken, {
      identifier: newIdentifier.value.trim(),
      password: newPassword.value,
      name: newName.value.trim(),
    });
    newIdentifier.value = '';
    newPassword.value = '';
    newName.value = '';
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not create this teacher.';
  } finally {
    isSaving.value = false;
  }
}

function startEdit(teacher: TeacherAdminSummary) {
  editingId.value = teacher.id;
  editName.value = teacher.name;
  editPassword.value = '';
}

function cancelEdit() {
  editingId.value = null;
}

async function onSaveEdit(id: string) {
  if (!auth.accessToken || !editName.value.trim()) return;
  errorMessage.value = null;
  try {
    await api.updateTeacher(auth.accessToken, id, {
      name: editName.value.trim(),
      ...(editPassword.value ? { password: editPassword.value } : {}),
    });
    editingId.value = null;
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this teacher.';
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!(await confirm({ title: 'Delete this teacher?', message: 'This cannot be undone.', danger: true }))) return;
  errorMessage.value = null;
  try {
    await api.deleteTeacher(auth.accessToken, id);
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this teacher.';
  }
}
</script>

<template>
  <div class="org-entity">
    <h1>Teachers</h1>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <EntityTable
      :items="teachers"
      :columns="[{ key: 'name', label: 'Name' }, { key: 'identifier', label: 'Login' }]"
      row-key="id"
      :editing-id="editingId"
    >
      <template #cell-name="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-name-${item.id}`" v-model="editName" type="text" />
        <span v-else>{{ item.name }}</span>
      </template>
      <template #cell-identifier="{ item, editing }">
        {{ item.identifier }}
        <input
          v-if="editing"
          :data-testid="`edit-password-${item.id}`"
          v-model="editPassword"
          type="password"
          placeholder="New password (leave blank to keep)"
        />
      </template>
      <template #actions="{ item, editing }">
        <template v-if="editing">
          <Button :data-testid="`save-${item.id}`" @click="onSaveEdit(item.id)">Save</Button>
          <Button variant="secondary" @click="cancelEdit">Cancel</Button>
        </template>
        <template v-else>
          <Button :data-testid="`edit-${item.id}`" @click="startEdit(item)">Edit</Button>
          <Button variant="secondary" :data-testid="`delete-${item.id}`" @click="onDelete(item.id)">
            Delete
          </Button>
        </template>
      </template>
    </EntityTable>

    <div class="inline-form">
      <FormField v-model="newIdentifier" label="Login email" type="text" data-testid="add-identifier" placeholder="Login email" grow />
      <FormField v-model="newPassword" label="Initial password" type="password" data-testid="add-password" placeholder="Initial password" grow />
      <FormField v-model="newName" label="Full name" type="text" data-testid="add-name" placeholder="Full name" grow />
      <Button data-testid="add-submit" :disabled="isSaving" @click="onAdd">Add</Button>
    </div>
  </div>
</template>

<style scoped>
.org-entity {
  max-width: 900px;
}
.error {
  color: var(--color-destructive);
  margin-bottom: var(--space-3);
}
.inline-form {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  flex-wrap: wrap;
}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/views/TeacherManagementView.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add staff-console/src/views/TeacherManagementView.vue staff-console/src/views/TeacherManagementView.spec.ts
git commit -m "refactor(staff-console): migrate TeacherManagementView onto shared components"
```

---

### Task 13: Migrate `ParentManagementView.vue`

**Files:**
- Modify: `src/views/ParentManagementView.vue`
- Modify: `src/views/ParentManagementView.spec.ts`

**Interfaces:**
- Consumes: `EntityTable.vue`, `FormField.vue`, `Button.vue`, `useConfirm()`.

- [ ] **Step 1: Update the spec's confirm mocking and delete test**

Same pattern, entity noun "parent":

```typescript
  it('deletes a parent after confirmation, and does nothing if the confirmation is declined', async () => {
    vi.mocked(api.deleteParent).mockResolvedValue(undefined);
    const confirmFn = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.mocked(useConfirm).mockReturnValue({ confirm: confirmFn });

    const wrapper = mount(ParentManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-p1"]').trigger('click');
    await flushPromises();
    expect(api.deleteParent).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="delete-p1"]').trigger('click');
    await flushPromises();
    expect(api.deleteParent).toHaveBeenCalledWith('token-1', 'p1');
    expect(confirmFn).toHaveBeenCalledWith({
      title: 'Delete this parent?',
      message: 'This cannot be undone.',
      danger: true,
    });
  });
```

(Match the row id to the existing fixture; plus the standard `useConfirm` import/mock/`beforeEach` wiring.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/views/ParentManagementView.spec.ts`
Expected: FAIL (view still calls `window.confirm`)

- [ ] **Step 3: Migrate the view**

```vue
<!-- src/views/ParentManagementView.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type ParentSummary } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import { useConfirm } from '../lib/useConfirm';

const auth = useAuthStore();
const { confirm } = useConfirm();

const parents = ref<ParentSummary[]>([]);
const errorMessage = ref<string | null>(null);

const newIdentifier = ref('');
const newPassword = ref('');
const newName = ref('');
const newPhone = ref('');
const isSaving = ref(false);

const editingId = ref<string | null>(null);
const editName = ref('');
const editPhone = ref('');
const editPassword = ref('');

async function load() {
  if (!auth.accessToken) return;
  try {
    parents.value = await api.listAdminParents(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load parents.';
  }
}
load();

async function onAdd() {
  if (!auth.accessToken || !newIdentifier.value.trim() || !newPassword.value || !newName.value.trim()) return;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createParent(auth.accessToken, {
      identifier: newIdentifier.value.trim(),
      password: newPassword.value,
      name: newName.value.trim(),
      phone: newPhone.value.trim() || undefined,
    });
    newIdentifier.value = '';
    newPassword.value = '';
    newName.value = '';
    newPhone.value = '';
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not create this parent.';
  } finally {
    isSaving.value = false;
  }
}

function startEdit(parent: ParentSummary) {
  editingId.value = parent.id;
  editName.value = parent.name;
  editPhone.value = parent.phone ?? '';
  editPassword.value = '';
}

function cancelEdit() {
  editingId.value = null;
}

async function onSaveEdit(id: string) {
  if (!auth.accessToken || !editName.value.trim()) return;
  errorMessage.value = null;
  try {
    await api.updateParent(auth.accessToken, id, {
      name: editName.value.trim(),
      phone: editPhone.value.trim() || undefined,
      ...(editPassword.value ? { password: editPassword.value } : {}),
    });
    editingId.value = null;
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this parent.';
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!(await confirm({ title: 'Delete this parent?', message: 'This cannot be undone.', danger: true }))) return;
  errorMessage.value = null;
  try {
    await api.deleteParent(auth.accessToken, id);
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this parent.';
  }
}
</script>

<template>
  <div class="org-entity">
    <h1>Parents</h1>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <EntityTable
      :items="parents"
      :columns="[
        { key: 'name', label: 'Name' },
        { key: 'identifier', label: 'Login' },
        { key: 'phone', label: 'Phone' },
        { key: 'childrenCount', label: 'Children' },
      ]"
      row-key="id"
      :editing-id="editingId"
    >
      <template #cell-name="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-name-${item.id}`" v-model="editName" type="text" />
        <span v-else>{{ item.name }}</span>
      </template>
      <template #cell-phone="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-phone-${item.id}`" v-model="editPhone" type="text" />
        <span v-else>{{ item.phone ?? '—' }}</span>
      </template>
      <template #actions="{ item, editing }">
        <template v-if="editing">
          <input
            :data-testid="`edit-password-${item.id}`"
            v-model="editPassword"
            type="password"
            placeholder="New password"
          />
          <Button :data-testid="`save-${item.id}`" @click="onSaveEdit(item.id)">Save</Button>
          <Button variant="secondary" @click="cancelEdit">Cancel</Button>
        </template>
        <template v-else>
          <Button :data-testid="`edit-${item.id}`" @click="startEdit(item)">Edit</Button>
          <Button variant="secondary" :data-testid="`delete-${item.id}`" @click="onDelete(item.id)">
            Delete
          </Button>
        </template>
      </template>
    </EntityTable>

    <div class="inline-form">
      <FormField v-model="newIdentifier" label="Login email" type="text" data-testid="add-identifier" placeholder="Login email" grow />
      <FormField v-model="newPassword" label="Initial password" type="password" data-testid="add-password" placeholder="Initial password" grow />
      <FormField v-model="newName" label="Full name" type="text" data-testid="add-name" placeholder="Full name" grow />
      <FormField v-model="newPhone" label="Phone" type="text" data-testid="add-phone" placeholder="Phone (optional)" grow />
      <Button data-testid="add-submit" :disabled="isSaving" @click="onAdd">Add</Button>
    </div>
  </div>
</template>

<style scoped>
.org-entity {
  max-width: 960px;
}
.error {
  color: var(--color-destructive);
  margin-bottom: var(--space-3);
}
.inline-form {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  flex-wrap: wrap;
}
</style>
```

Note: the password `<input>` in the `#actions` slot stays a raw `<input>` (not a `FormField`), matching the original markup exactly — it lives in the actions cell, not the name/phone columns, and the design doc's component boundary is per-field, not per-row, so this one field is simplest left as-is here since it's not part of an `.inline-form`/add-form row that `FormField`'s `grow`/sr-only-label design was built around. This preserves pixel-equivalent output with zero risk.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/views/ParentManagementView.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add staff-console/src/views/ParentManagementView.vue staff-console/src/views/ParentManagementView.spec.ts
git commit -m "refactor(staff-console): migrate ParentManagementView onto shared components"
```

---

### Task 14: Migrate `StudentManagementView.vue`

**Files:**
- Modify: `src/views/StudentManagementView.vue`
- Modify: `src/views/StudentManagementView.spec.ts`

**Interfaces:**
- Consumes: `EntityTable.vue`, `FormField.vue`, `Button.vue`, `useConfirm()`, widened `useFocusTarget()` (Task 3).

- [ ] **Step 1: Update the spec's confirm mocking and delete test**

Same pattern, entity noun "student":

```typescript
  it('deletes a student after confirmation, and does nothing if the confirmation is declined', async () => {
    vi.mocked(api.deleteStudent).mockResolvedValue(undefined);
    const confirmFn = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.mocked(useConfirm).mockReturnValue({ confirm: confirmFn });

    const wrapper = mount(StudentManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-st1"]').trigger('click');
    await flushPromises();
    expect(api.deleteStudent).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="delete-st1"]').trigger('click');
    await flushPromises();
    expect(api.deleteStudent).toHaveBeenCalledWith('token-1', 'st1');
    expect(confirmFn).toHaveBeenCalledWith({
      title: 'Delete this student?',
      message: 'This cannot be undone.',
      danger: true,
    });
  });
```

(Match the row id to the existing fixture; plus the standard `useConfirm` import/mock/`beforeEach` wiring — `StudentManagementView.spec.ts` already mounts with a router, since `useFocusTarget` needs one; keep that setup unchanged.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/views/StudentManagementView.spec.ts`
Expected: FAIL (view still calls `window.confirm`)

- [ ] **Step 3: Migrate the view**

```vue
<!-- src/views/StudentManagementView.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type SectionSummary, type ParentSummary, type StudentAdminSummary } from '../lib/api';
import { useFocusTarget } from '../lib/useFocusTarget';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import { useConfirm } from '../lib/useConfirm';

const auth = useAuthStore();
const { confirm } = useConfirm();

const sections = ref<SectionSummary[]>([]);
const parents = ref<ParentSummary[]>([]);
const students = ref<StudentAdminSummary[]>([]);
const errorMessage = ref<string | null>(null);

const newGrNumber = ref('');
const newName = ref('');
const newSectionId = ref('');
const useNewParent = ref(false);
const newParentProfileId = ref('');
const newParentIdentifier = ref('');
const newParentPassword = ref('');
const newParentName = ref('');
const newParentPhone = ref('');
const isSaving = ref(false);

const grNumberFieldRef = ref<{ focus(): void } | null>(null);
useFocusTarget({ 'gr-number': grNumberFieldRef });

const editingId = ref<string | null>(null);
const editGrNumber = ref('');
const editName = ref('');

async function load() {
  if (!auth.accessToken) return;
  try {
    [sections.value, parents.value, students.value] = await Promise.all([
      api.listSections(auth.accessToken),
      api.listAdminParents(auth.accessToken),
      api.listAdminStudents(auth.accessToken),
    ]);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load students.';
  }
}
load();

function resetAddForm() {
  newGrNumber.value = '';
  newName.value = '';
  newSectionId.value = '';
  useNewParent.value = false;
  newParentProfileId.value = '';
  newParentIdentifier.value = '';
  newParentPassword.value = '';
  newParentName.value = '';
  newParentPhone.value = '';
}

async function onAdd() {
  if (!auth.accessToken || !newGrNumber.value.trim() || !newName.value.trim() || !newSectionId.value) return;
  if (useNewParent.value) {
    if (!newParentIdentifier.value.trim() || !newParentPassword.value || !newParentName.value.trim()) return;
  } else if (!newParentProfileId.value) {
    return;
  }
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createStudent(auth.accessToken, {
      grNumber: newGrNumber.value.trim(),
      name: newName.value.trim(),
      sectionId: newSectionId.value,
      ...(useNewParent.value
        ? {
            newParent: {
              identifier: newParentIdentifier.value.trim(),
              password: newParentPassword.value,
              name: newParentName.value.trim(),
              phone: newParentPhone.value.trim() || undefined,
            },
          }
        : { parentProfileId: newParentProfileId.value }),
    });
    resetAddForm();
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not create this student.';
  } finally {
    isSaving.value = false;
  }
}

function startEdit(student: StudentAdminSummary) {
  editingId.value = student.id;
  editGrNumber.value = student.grNumber;
  editName.value = student.name;
}

function cancelEdit() {
  editingId.value = null;
}

async function onSaveEdit(id: string) {
  if (!auth.accessToken || !editGrNumber.value.trim() || !editName.value.trim()) return;
  errorMessage.value = null;
  try {
    await api.updateStudent(auth.accessToken, id, {
      grNumber: editGrNumber.value.trim(),
      name: editName.value.trim(),
    });
    editingId.value = null;
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this student.';
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!(await confirm({ title: 'Delete this student?', message: 'This cannot be undone.', danger: true }))) return;
  errorMessage.value = null;
  try {
    await api.deleteStudent(auth.accessToken, id);
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this student.';
  }
}
</script>

<template>
  <div class="org-entity">
    <h1>Students</h1>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <EntityTable
      :items="students"
      :columns="[
        { key: 'grNumber', label: 'GR Number' },
        { key: 'name', label: 'Name' },
        { key: 'sectionName', label: 'Section' },
        { key: 'parentNames', label: 'Parents' },
      ]"
      row-key="id"
      :editing-id="editingId"
    >
      <template #cell-grNumber="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-gr-${item.id}`" v-model="editGrNumber" type="text" />
        <span v-else>{{ item.grNumber }}</span>
      </template>
      <template #cell-name="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-name-${item.id}`" v-model="editName" type="text" />
        <span v-else>{{ item.name }}</span>
      </template>
      <template #cell-sectionName="{ item }">
        {{ item.sectionName ?? '—' }}
      </template>
      <template #cell-parentNames="{ item }">
        {{ item.parentNames.join(', ') || '—' }}
      </template>
      <template #actions="{ item, editing }">
        <template v-if="editing">
          <Button :data-testid="`save-${item.id}`" @click="onSaveEdit(item.id)">Save</Button>
          <Button variant="secondary" @click="cancelEdit">Cancel</Button>
        </template>
        <template v-else>
          <Button :data-testid="`edit-${item.id}`" @click="startEdit(item)">Edit</Button>
          <Button variant="secondary" :data-testid="`delete-${item.id}`" @click="onDelete(item.id)">
            Delete
          </Button>
        </template>
      </template>
    </EntityTable>

    <div class="add-form">
      <div class="inline-form">
        <FormField
          ref="grNumberFieldRef"
          v-model="newGrNumber"
          label="GR number"
          type="text"
          data-testid="add-gr-number"
          placeholder="GR number"
          grow
        />
        <FormField v-model="newName" label="Full name" type="text" data-testid="add-name" placeholder="Full name" grow />
        <FormField
          v-model="newSectionId"
          label="Section"
          type="select"
          data-testid="add-section"
          placeholder="Choose a section"
          :options="sections.map((sec) => ({ value: sec.id, label: `${sec.className} ${sec.name} (${sec.campusName})` }))"
        />
      </div>

      <FormField v-model="useNewParent" label="+ New Parent (instead of picking an existing one)" type="checkbox" data-testid="toggle-new-parent" />

      <div v-if="!useNewParent" class="inline-form">
        <FormField
          v-model="newParentProfileId"
          label="Parent"
          type="select"
          data-testid="add-parent-select"
          placeholder="Choose a parent"
          :options="parents.map((p) => ({ value: p.id, label: `${p.name} (${p.identifier})` }))"
        />
      </div>
      <div v-else class="inline-form">
        <FormField v-model="newParentIdentifier" label="Parent login email" type="text" data-testid="new-parent-identifier" placeholder="Parent login email" grow />
        <FormField v-model="newParentPassword" label="Initial password" type="password" data-testid="new-parent-password" placeholder="Initial password" grow />
        <FormField v-model="newParentName" label="Parent full name" type="text" data-testid="new-parent-name" placeholder="Parent full name" grow />
        <FormField v-model="newParentPhone" label="Phone" type="text" data-testid="new-parent-phone" placeholder="Phone (optional)" grow />
      </div>

      <Button data-testid="add-submit" :disabled="isSaving" @click="onAdd">Add Student</Button>
    </div>
  </div>
</template>

<style scoped>
.org-entity {
  max-width: 1100px;
}
.error {
  color: var(--color-destructive);
  margin-bottom: var(--space-3);
}
.add-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}
.inline-form {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  flex-wrap: wrap;
}
</style>
```

Note: `grNumberFieldRef` is typed `Ref<{ focus(): void } | null>`, matching `FormField`'s `defineExpose({ focus })` (Task 2) and the widened `useFocusTarget` signature (Task 3) — this is the resolution to Resolved Spec Gap #4.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/views/StudentManagementView.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add staff-console/src/views/StudentManagementView.vue staff-console/src/views/StudentManagementView.spec.ts
git commit -m "refactor(staff-console): migrate StudentManagementView onto shared components"
```

---

### Task 15: Add `useConfirm()` guards to `TimetableView.vue`

**Files:**
- Modify: `src/views/TimetableView.vue`
- Modify: `src/views/TimetableView.spec.ts`

`TimetableView.vue` is explicitly **out of scope** for `EntityTable`/`FormField` (its markup isn't `.entity-table`-shaped — it has a grid composer). Only `onDelete` and `onSaveBulk` (bulk-replace) get `useConfirm()` guards added, where none exist today.

**Interfaces:**
- Consumes: `useConfirm()` (Task 5).

- [ ] **Step 1: Update the spec's confirm mocking**

Add near the top of `src/views/TimetableView.spec.ts` (alongside the existing `vi.mock('../lib/api', ...)`):

```typescript
import { useConfirm } from '../lib/useConfirm';

vi.mock('../lib/useConfirm', () => ({
  useConfirm: vi.fn(),
}));
```

In the file's top-level `beforeEach`, add:

```typescript
    vi.mocked(useConfirm).mockReturnValue({ confirm: vi.fn().mockResolvedValue(true) });
```

Update the existing `'deletes a period'` test to also assert the confirm call:

```typescript
  it('deletes a period after confirmation, and does nothing if declined', async () => {
    vi.mocked(api.sectionTimetable).mockResolvedValue([
      {
        id: 't1',
        dayOfWeek: 1,
        period: 1,
        startTime: '08:00',
        endTime: '08:40',
        subject: 'Mathematics',
        teacher: 'Mr. Second Teacher',
        room: '4B',
      },
    ]);
    vi.mocked(api.deleteTimetableEntry).mockResolvedValue(undefined);
    const confirmFn = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.mocked(useConfirm).mockReturnValue({ confirm: confirmFn });

    const wrapper = mount(TimetableView);
    await flushPromises();
    await wrapper.find('[data-testid="section-select"]').setValue('sec-1');
    await flushPromises();

    await wrapper.find('[data-testid="delete-t1"]').trigger('click');
    await flushPromises();
    expect(api.deleteTimetableEntry).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="delete-t1"]').trigger('click');
    await flushPromises();

    expect(api.deleteTimetableEntry).toHaveBeenCalledWith('token-1', 't1');
    expect(wrapper.text()).toContain('Period removed.');
    expect(confirmFn).toHaveBeenCalledWith({
      title: 'Remove this period?',
      message: 'This cannot be undone.',
      danger: true,
    });
  });
```

For each existing bulk-composer test that calls `save-bulk` (the three shown in the file around the "fills one cell and saves..." and "unchecking a day..." tests, plus any others), no change is needed as long as the default `beforeEach` mock (`confirm` resolving `true`) is in place — they'll keep passing once the guard is added, since a resolved-`true` confirm behaves as if the guard weren't there.

Add one new test asserting the bulk-replace confirmation itself:

```typescript
  it('asks for confirmation before replacing the timetable, and does nothing if declined', async () => {
    vi.mocked(api.sectionTimetable).mockResolvedValue([]);
    vi.mocked(api.replaceSectionTimetable).mockResolvedValue(undefined);
    const confirmFn = vi.fn().mockResolvedValueOnce(false);
    vi.mocked(useConfirm).mockReturnValue({ confirm: confirmFn });

    const wrapper = mount(TimetableView);
    await flushPromises();
    await wrapper.find('[data-testid="section-select"]').setValue('sec-1');
    await flushPromises();
    await wrapper.find('[data-testid="open-bulk"]').trigger('click');
    await flushPromises();

    await wrapper.find('[data-testid="bulk-start-1"]').setValue('08:00');
    await wrapper.find('[data-testid="bulk-end-1"]').setValue('08:40');
    await wrapper.find('[data-testid="bulk-subject-1-1"]').setValue('sub-1');

    await wrapper.find('[data-testid="save-bulk"]').trigger('click');
    await flushPromises();

    expect(confirmFn).toHaveBeenCalledWith({
      title: 'Replace this timetable?',
      message: 'This will overwrite every period currently scheduled for this section. This cannot be undone.',
      danger: true,
    });
    expect(api.replaceSectionTimetable).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/views/TimetableView.spec.ts`
Expected: FAIL — `confirmFn` is never called (view doesn't call `confirm()` yet), and the declined-delete assertion fails since delete still proceeds unconditionally today.

- [ ] **Step 3: Add the guards**

In `src/views/TimetableView.vue`, add the import near the top of `<script setup>`:

```typescript
import { useConfirm } from '../lib/useConfirm';
```

and instantiate it alongside `auth`:

```typescript
const auth = useAuthStore();
const { confirm } = useConfirm();
```

Update `onDelete` (currently the unguarded function around line 161):

```typescript
async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!(await confirm({ title: 'Remove this period?', message: 'This cannot be undone.', danger: true }))) return;
  message.value = null;
  errorMessage.value = null;
  try {
    await api.deleteTimetableEntry(auth.accessToken, id);
    message.value = 'Period removed.';
    await reloadEntries();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not remove this period.';
  }
}
```

Update `onSaveBulk` (add the guard as the first check inside the function, right after the existing early-return):

```typescript
async function onSaveBulk() {
  if (!auth.accessToken || !selectedSectionId.value || !isBulkValid()) return;
  if (
    !(await confirm({
      title: 'Replace this timetable?',
      message: 'This will overwrite every period currently scheduled for this section. This cannot be undone.',
      danger: true,
    }))
  )
    return;
  message.value = null;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    const bulkEntries: TimetableEntryInput[] = [];
    for (const day of bulkDays.value) {
      for (let period = 1; period <= bulkPeriodCount.value; period++) {
        const c = grid.value[cellKey(period, day)];
        if (!c?.subjectId) continue;
        const times = effectiveTime(period, day);
        if (!times.startTime || !times.endTime) continue;
        bulkEntries.push({
          subjectId: c.subjectId,
          teacherId: c.teacherId || undefined,
          dayOfWeek: day,
          period,
          startTime: times.startTime,
          endTime: times.endTime,
          room: defaultRoom.value || undefined,
        });
      }
    }
    await api.replaceSectionTimetable(auth.accessToken, selectedSectionId.value, bulkEntries);
    isBulkMode.value = false;
    message.value = `Timetable saved (${bulkEntries.length} period${bulkEntries.length === 1 ? '' : 's'}).`;
    await reloadEntries();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not save the timetable.';
  } finally {
    isSaving.value = false;
  }
}
```

(Every other line of `TimetableView.vue` — the grid composer, the read-only weekly view, `onAdd`, `onSaveEdit`, styles — is unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/views/TimetableView.spec.ts`
Expected: PASS (all pre-existing tests plus the new/updated ones)

- [ ] **Step 5: Commit**

```bash
git add staff-console/src/views/TimetableView.vue staff-console/src/views/TimetableView.spec.ts
git commit -m "feat(staff-console): guard TimetableView delete and bulk-replace with useConfirm"
```

---

### Task 16: Add a `useConfirm()` guard to `LeaveManagementView.vue`'s reject action

**Files:**
- Modify: `src/views/LeaveManagementView.vue`
- Modify: `src/views/LeaveManagementView.spec.ts`

`LeaveManagementView.vue` is out of scope for `EntityTable`/`FormField` (its markup is a list, not a `.entity-table`). Only `onReject` gets a `useConfirm()` guard, where none exists today. `onApprove` is unaffected (the design doc scopes the guard to reject only).

**Interfaces:**
- Consumes: `useConfirm()` (Task 5).

- [ ] **Step 1: Update the spec's confirm mocking and reject test**

Add near the top of `src/views/LeaveManagementView.spec.ts`:

```typescript
import { useConfirm } from '../lib/useConfirm';

vi.mock('../lib/useConfirm', () => ({
  useConfirm: vi.fn(),
}));
```

In the file's `beforeEach`, add:

```typescript
    vi.mocked(useConfirm).mockReturnValue({ confirm: vi.fn().mockResolvedValue(true) });
```

Update the existing `'rejects a request'` test:

```typescript
  it('rejects a request after confirmation, and does nothing if declined', async () => {
    // (keep whatever listLeaveRequests mock setup already exists above this point in the file)
    vi.mocked(api.rejectLeaveRequest).mockResolvedValue(undefined);
    const confirmFn = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.mocked(useConfirm).mockReturnValue({ confirm: confirmFn });

    const wrapper = mount(LeaveManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="reject-lr-2"]').trigger('click');
    await flushPromises();
    expect(api.rejectLeaveRequest).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="reject-lr-2"]').trigger('click');
    await flushPromises();

    expect(api.rejectLeaveRequest).toHaveBeenCalledWith('token-1', 'lr-2');
    expect(confirmFn).toHaveBeenCalledWith({
      title: 'Reject this leave request?',
      message: 'This cannot be undone.',
      danger: true,
    });
  });
```

(Keep the existing fixture/mock setup that precedes this test in the file — only the confirm mechanics and assertions change.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/views/LeaveManagementView.spec.ts`
Expected: FAIL (`confirmFn` never called; declined-reject assertion fails since reject still proceeds unconditionally today)

- [ ] **Step 3: Add the guard**

In `src/views/LeaveManagementView.vue`, add the import:

```typescript
import { useConfirm } from '../lib/useConfirm';
```

and instantiate it alongside `auth`:

```typescript
const auth = useAuthStore();
const { confirm } = useConfirm();
```

Update `onReject`:

```typescript
async function onReject(id: string) {
  if (!auth.accessToken) return;
  if (!(await confirm({ title: 'Reject this leave request?', message: 'This cannot be undone.', danger: true })))
    return;
  busyId.value = id;
  try {
    await api.rejectLeaveRequest(auth.accessToken, id);
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not reject this request.';
  } finally {
    busyId.value = null;
  }
}
```

(`onApprove` and everything else in the file is unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/views/LeaveManagementView.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add staff-console/src/views/LeaveManagementView.vue staff-console/src/views/LeaveManagementView.spec.ts
git commit -m "feat(staff-console): guard LeaveManagementView reject with useConfirm"
```

---

### Task 17: Remove the dead teacher Timetable nav link, rename the breadcrumb `aria-label`

**Files:**
- Modify: `src/components/AppShell.vue`
- Modify: `src/components/AppShell.spec.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks — independent of Phases 1–4.

- [ ] **Step 1: Update the spec**

In `src/components/AppShell.spec.ts`, find the test `'shows only Teacher nav items for a TEACHER role, with no admin items in the DOM at all'` (around line 71) and replace its `Timetable`-related assertion:

```typescript
  it('shows only Teacher nav items for a TEACHER role, with no admin items in the DOM at all', async () => {
    const wrapper = await mountAsRole('TEACHER');

    expect(wrapper.text()).toContain('Attendance');
    expect(wrapper.text()).toContain('Diary');
    expect(wrapper.text()).toContain('Messages');
    // The teacher Timetable nav link was removed as dead (it pointed to href="#" with no route) —
    // Sprint I will re-add a real RouterLink once a teacher-facing timetable view exists.
    expect(wrapper.find('[data-testid="nav-timetable"]').exists()).toBe(false);

    // Not CSS-hidden — absent from the DOM entirely.
    expect(wrapper.text()).not.toContain('Students');
    expect(wrapper.text()).not.toContain('Fees');
    expect(wrapper.find('[data-testid="nav-students"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-fees"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-dashboard"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="nav-leave"]').exists()).toBe(false);
  });
```

Then, in the `describe('AppShell (breadcrumb)', ...)` block, add an assertion for the renamed `aria-label` to the existing test:

```typescript
describe('AppShell (breadcrumb)', () => {
  it("renders the current route's meta.title in the breadcrumb, with a Page title aria-label", async () => {
    const wrapper = await mountAsRole('SCHOOL_ADMIN');
    await wrapper.vm.$router.push('/admin');
    await flushPromises();

    expect(wrapper.find('[data-testid="breadcrumb"]').text()).toBe('Dashboard');
    expect(wrapper.find('[data-testid="breadcrumb"]').attributes('aria-label')).toBe('Page title');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/AppShell.spec.ts`
Expected: FAIL — the TEACHER-role test's `nav-timetable` existence assertion fails (link is still present today), and the breadcrumb test's `aria-label` assertion fails (still `"Breadcrumb"` today).

- [ ] **Step 3: Make the two markup changes**

In `src/components/AppShell.vue`, remove the dead teacher Timetable link entirely (currently the line `<a data-testid="nav-timetable" href="#"><Icon name="clock" />Timetable</a>` inside the `v-if="isTeacher"` block, around line 328):

```html
        <template v-if="isTeacher">
          <RouterLink data-testid="nav-attendance" to="/teacher"><Icon name="calendar" />Attendance</RouterLink>
          <RouterLink data-testid="nav-diary" to="/teacher/diary"><Icon name="notebook" />Diary</RouterLink>
          <RouterLink data-testid="nav-messages" to="/teacher/messages"><Icon name="chat" />Messages</RouterLink>
        </template>
```

(No replacement link — Sprint I re-adds a real `RouterLink` once its thin read-only teacher-timetable view ships.)

Rename the breadcrumb `aria-label` (currently around line 248):

```html
      <nav class="crumbs" aria-label="Page title" data-testid="breadcrumb">
        <b>{{ breadcrumbTitle }}</b>
      </nav>
```

(`breadcrumbTitle`/`<b>{{ breadcrumbTitle }}</b>` rendering is unchanged — only the `aria-label` string moves.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/AppShell.spec.ts`
Expected: PASS (all pre-existing AppShell tests plus the two updated ones)

- [ ] **Step 5: Commit**

```bash
git add staff-console/src/components/AppShell.vue staff-console/src/components/AppShell.spec.ts
git commit -m "fix(staff-console): remove dead teacher Timetable nav link, rename breadcrumb aria-label"
```

---

### Task 18: Regression spec — zero `window.confirm` references remain in `src/`

**Files:**
- Create: `src/noWindowConfirm.spec.ts`

**Interfaces:**
- Consumes: nothing — a static scan of the `src/` tree, independent of every other task, but only meaningful once Tasks 7–16 have actually removed every `window.confirm` call site (run this task last among the functional tasks, before the final full-suite verification).

- [ ] **Step 1: Write the failing test**

```typescript
// src/noWindowConfirm.spec.ts
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = fileURLToPath(new URL('.', import.meta.url));
const thisFile = fileURLToPath(new URL(import.meta.url));

function collectFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else if (/\.(vue|ts)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('no window.confirm usage', () => {
  it('does not reference window.confirm anywhere in src/', () => {
    const offenders: string[] = [];
    for (const file of collectFiles(srcDir)) {
      if (file === thisFile) continue;
      const content = readFileSync(file, 'utf-8');
      if (content.includes('window.confirm')) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails (if any task above hasn't landed yet) or passes (if this is run after Tasks 7–16)**

Run: `npm run test -- src/noWindowConfirm.spec.ts`
Expected: at this point in the plan (after Tasks 1–17), PASS immediately, since every `window.confirm` call site has already been migrated in Tasks 7–16. (If run standalone against the pre-Sprint-D codebase, it would FAIL listing all 8 CRUD view files.)

- [ ] **Step 3: No implementation needed**

This task is the test itself — its only job is to fail loudly if a future screen reintroduces `window.confirm`.

- [ ] **Step 4: Confirm it passes**

Run: `npm run test -- src/noWindowConfirm.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add staff-console/src/noWindowConfirm.spec.ts
git commit -m "test(staff-console): add regression spec banning window.confirm"
```

---

### Task 19: Final full-suite verification

**Files:** none (verification only).

**Interfaces:** none — this task exercises everything built in Tasks 1–18 together.

- [ ] **Step 1: Run the full test suite**

Run (from `staff-console/`): `npm run test`
Expected: PASS — every spec file in `src/` (new component specs, all 8 migrated CRUD-screen specs, `TimetableView.spec.ts`, `LeaveManagementView.spec.ts`, `AppShell.spec.ts`, `useFocusTarget.spec.ts`, `useConfirm.spec.ts`, `noWindowConfirm.spec.ts`, and every untouched spec elsewhere in the app) passes with zero failures.

- [ ] **Step 2: Run the type checker**

Run: `npm run type-check`
Expected: PASS — no TypeScript errors, including in the generic `EntityTable.vue` component and the widened `useFocusTarget` signature.

- [ ] **Step 3: Run the linters**

Run: `npm run lint`
Expected: PASS — `oxlint` and `eslint` both clean.

- [ ] **Step 4: Spot-check pixel-equivalence in a real browser**

Run: `npm run dev` (from `staff-console/`), then in a browser sign in as a `SUPER_ADMIN` (or whatever seeded admin credentials the dev environment uses) and open each of the 8 migrated CRUD screens (`/admin/schools`, `/admin/campuses`, `/admin/academic-sessions`, `/admin/classes`, `/admin/sections`, `/admin/teachers`, `/admin/parents`, `/admin/students`) plus `/admin/timetable` and `/admin/leave`. For each: confirm the table/add-form renders identically to before (same colors, spacing, no visible label text appearing above add-form fields), exercise one add/edit/delete cycle per screen and confirm the new `ConfirmDialog` appears in place of the old native browser confirm on delete (and on Timetable's bulk-replace / Leave's reject), and confirm Escape/click-outside/Cancel all decline correctly. Also open the sidebar as a `TEACHER` role and confirm the Timetable link is gone with no dead space left behind.

- [ ] **Step 5: No commit for this task**

This is a verification-only task; nothing changes. If Steps 1–4 all pass, Sprint D is complete.

---

## Non-goals (carried over from the spec — do not attempt these in this plan)

- No visual redesign of any migrated screen — pixel-equivalent only.
- No API contract, Prisma schema, or business logic changes.
- No real breadcrumb trail (only the `aria-label` rename, Task 17).
- No teacher-facing timetable view build-out (Sprint I).
