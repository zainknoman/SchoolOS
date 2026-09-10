# Sprint D — Staff Console Component Extraction (UI Sprint 2)

Status: draft, approved in chat by product owner 2026-09-10.
Source: `docs/Plan-Ideas/SchoolPortal-PostMVP-Roadmap-2026-09-08.md` §4 Sprint D, informed by
`SchoolPortal-UIUX-Audit-Modernization-Roadmap-2026-09-08.md` (UI Sprint 2 section, breadcrumb
finding).

## Context

Eight CRUD views (`StudentManagementView.vue`, `ParentManagementView.vue`,
`TeacherManagementView.vue`, `ClassManagementView.vue`, `SectionManagementView.vue`,
`SchoolManagementView.vue`, `CampusManagementView.vue`, `AcademicSessionManagementView.vue`) each
hand-roll an identical `.entity-table` (`<table>`/`<thead>`/inline-edit `<tr>`), an `.add-form`
built from raw `<input>`/`<select>` elements, and a `button`/`button.secondary` pair — verified by
direct inspection, not assumed. All 8 also call `window.confirm('Delete this X? This cannot be
undone.')` before delete, with only the noun varying. `TimetableView.vue`'s delete/bulk-replace and
`LeaveManagementView.vue`'s reject have **no** confirmation at all today (verified: neither file
matches `window.confirm`).

This is pure UI-debt cleanup — **zero intended visual change**. A separate, more ambitious
visual-redesign idea was raised and explicitly deferred to its own future brainstorm/spec, sequenced
*after* this sprint (see Non-goals) — restyling 4 shared components later is far less risky than
restyling 8 duplicated screens at once.

**Decision:** build 4 new shared components (`EntityTable.vue`, `FormField.vue`, `Button.vue`,
`ConfirmDialog.vue` + a `useConfirm()` composable) and migrate all 8 CRUD screens onto them in this
sprint, per the roadmap's own Definition of Done ("one shared table component backs all 8 CRUD
screens"). `TimetableView.vue`/`LeaveManagementView.vue` are out of scope for `EntityTable`/
`FormField` (their markup isn't `.entity-table`-shaped) but pick up `useConfirm()` for their
currently-unguarded actions.

**Sequencing** (each phase ships and is verified independently):

| Phase | Scope | Depends on |
|---|---|---|
| 1. Shared components | `EntityTable.vue`, `FormField.vue`, `Button.vue`, `ConfirmDialog.vue`, `useConfirm()`, component specs | — |
| 2. Reference migration | `SchoolManagementView.vue` (simplest screen) migrated + its spec updated | Phase 1 |
| 3. Remaining 7 CRUD screens | Campus, AcademicSession, Section, Class, Teacher, Parent, Student (increasing complexity order) | Phase 2 pattern proven |
| 4. Timetable/Leave confirmations | `useConfirm()` wired into Timetable delete/bulk-replace, Leave reject | Phase 1 |
| 5. Nav + breadcrumb fixes | Remove dead Teacher→Timetable link, rename breadcrumb `aria-label` | Independent, any time |

## 1. `EntityTable.vue`

Owns table scaffolding only; each view keeps its own `editingId` ref and inline-edit logic.

```vue
<EntityTable :items="students" :columns="[{ key: 'grNumber', label: 'GR Number' }, ...]" row-key="id">
  <template #cell-grNumber="{ item, editing }">
    <input v-if="editing" v-model="editGrNumber" :data-testid="`edit-gr-${item.id}`" />
    <span v-else>{{ item.grNumber }}</span>
  </template>
  <template #actions="{ item, editing }">
    <!-- existing Edit/Save/Cancel/Delete buttons, using Button.vue -->
  </template>
</EntityTable>
```

- Props: `items: T[]`, `columns: { key: string; label: string }[]`, `rowKey: keyof T`.
- Renders `<table class="entity-table">` (class name preserved so the existing scoped CSS in
  `base.css`/per-view `<style>` needs no selector rewrite beyond moving the rule to the component),
  `<thead>` from `columns`, one `<tr>` per item exposing a `#cell-<key>` scoped slot per column
  (receiving `{ item, editing }`) and a fixed trailing `#actions` slot (same two args). No slot for
  a column falls back to `{{ item[column.key] }}`.
- Does **not** own the add-form — that stays in each view, built from `FormField`/`Button`.
- Does **not** own `editingId` state — each view still owns "which row is being edited," matching
  current behavior exactly (no behavior change, only markup dedup).

## 2. `FormField.vue`

```vue
<FormField v-model="newName" label="Full name" type="text" data-testid="add-name" placeholder="Full name" />
<FormField v-model="newSectionId" label="Section" type="select"
  :options="sections.map(s => ({ value: s.id, label: `${s.className} ${s.name} (${s.campusName})` }))"
  placeholder="Choose a section" />
<FormField v-model="useNewParent" label="+ New Parent (instead of picking an existing one)" type="checkbox" />
```

- Props: `modelValue`, `label`, `type: 'text' | 'password' | 'select' | 'checkbox'`, `options?`
  (select only), `placeholder?`, `error?`, plus passthrough `data-testid`/other attrs via
  `inheritAttrs: false` + `v-bind="$attrs"` on the inner control (existing `data-testid` values on
  add-form inputs are preserved this way, so per-view specs need no testid renames here).
- `text`/`password` render `<input :type>`; `select` renders `<option value="" disabled>` for
  `placeholder` + `v-for` over `options`; `checkbox` renders the existing `.checkbox-row` label
  layout.
- Layout: label above control for text/password/select (matches current `.inline-form` look),
  label-after-input for checkbox (matches current `.checkbox-row`). No error UI exists in any
  current view, so `error` prop renders nothing when unset — added for future use, not exercised by
  this migration.

## 3. `Button.vue`

```vue
<Button variant="primary" :disabled="isSaving" data-testid="add-submit" @click="onAdd">Add Student</Button>
<Button variant="secondary" data-testid="delete-{id}" @click="onDelete(s.id)">Delete</Button>
```

- Props: `variant: 'primary' | 'secondary'` (default `'primary'`), standard `disabled`.
- Wraps the exact CSS already duplicated 8x (`primary` = accent background/`--color-on-primary`
  text; `secondary` = transparent background/`--color-destructive` text+border). No new visual
  variant introduced.

## 4. `ConfirmDialog.vue` + `useConfirm()`

One `<ConfirmDialog>` instance mounted once in `AppShell.vue` (sibling to the existing
`<CommandPalette>` mount), driven by a small singleton store in `lib/useConfirm.ts` so any
component can call it without prop-drilling.

```ts
// lib/useConfirm.ts
export function useConfirm() {
  function confirm(opts: { title: string; message: string; confirmLabel?: string; danger?: boolean }): Promise<boolean>;
  return { confirm };
}
```

Call sites become:
```ts
async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!(await confirm({ title: 'Delete this student?', message: 'This cannot be undone.', danger: true }))) return;
  ...
}
```
— replacing `if (!window.confirm('Delete this student? This cannot be undone.')) return;` at all 8
CRUD delete sites, and adding equivalent guards (currently absent) to `TimetableView.vue`'s
`onDelete`/bulk-replace action and `LeaveManagementView.vue`'s `onReject`.

- Dialog markup mirrors `CommandPalette.vue`'s existing overlay pattern: `role="dialog"
  aria-modal="true"`, an `aria-label` from `title`, Escape-to-close (resolves the promise `false`),
  click-outside-to-close, focus moves to the dialog's Cancel button on open and returns to the
  triggering element on close (same focus-return discipline already used by CommandPalette's own
  close handling — verify exact mechanism there before implementing, reuse rather than reinvent).
- `danger: true` styles the confirm button with the `--color-destructive` token (matches the
  existing `button.secondary` destructive look); omitted/`false` uses the primary accent button —
  covers the non-destructive case even though none of Sprint D's own call sites need it.
- Only one confirmation can be open at a time (matches every current call site — no view ever
  triggers two `window.confirm()` calls concurrently); a second `confirm()` call while one is
  pending queues behind it rather than overlapping (simplest correct behavior, not expected to be
  exercised in practice this sprint).

## 5. Nav link + breadcrumb fixes

- `AppShell.vue:328` — remove `<a data-testid="nav-timetable" href="#"><Icon name="clock"
  />Timetable</a>` from the teacher `<template v-if="isTeacher">` nav block entirely. No
  replacement link; Sprint I re-adds a real `RouterLink` once its thin read-only teacher-timetable
  view ships against `GET /students/:id/timetable`. Any spec asserting the presence of
  `nav-timetable` under the teacher role must be updated to assert its **absence** instead.
- `AppShell.vue:248` — `<nav class="crumbs" aria-label="Breadcrumb" ...>` → `aria-label="Page
  title"`. `breadcrumbTitle`/`<b>{{ breadcrumbTitle }}</b>` rendering is unchanged; only the
  mislabeled `aria-label` moves, per the audit's own "trivial: rename the label" framing (not the
  "small: build a real trail" alternative — out of scope for this sprint).

## Migration order (all 8 CRUD screens, this sprint)

1. Phase 1 components + specs.
2. `SchoolManagementView.vue` — 1 column, 1 text field; proves the pattern end-to-end.
3. `CampusManagementView.vue`, `AcademicSessionManagementView.vue`, `SectionManagementView.vue`,
   `ClassManagementView.vue` — select-driven add-forms, still single editable column.
4. `TeacherManagementView.vue`, `ParentManagementView.vue` — password fields, more columns
   (Parent adds phone + read-only Children column).
5. `StudentManagementView.vue` — most complex: conditional new-parent sub-form
   (`useNewParent` toggle switching between a `select` and 4 `FormField`s).
6. `TimetableView.vue` / `LeaveManagementView.vue` — `useConfirm()` only, no `EntityTable`/
   `FormField` migration (their markup doesn't match the `.entity-table` shape).
7. Nav-link removal + breadcrumb rename — independent, can land any time after Phase 1.

Each screen's existing `*ManagementView.spec.ts` is updated in the same commit/step as its
migration (not as a separate later pass), so a broken migration is caught immediately per screen
rather than in one large end-of-sprint spec-fixing pass.

## Non-goals

- **No visual redesign.** Every migrated screen must render pixel-equivalent to today (same colors,
  spacing, copy) — this sprint dedupes markup, it does not restyle. A full design-system-driven
  visual overhaul was raised separately and is explicitly deferred to its own future brainstorm/spec
  (scope, target screens, and design-system source all still undecided), sequenced after this
  extraction lands so the redesign restyles 4 shared components instead of 8 duplicated screens.
- No change to any API contract, Prisma schema, or business logic — this is a Vue-layer-only sprint.
- No real breadcrumb trail (that's the audit's "small" option, not taken here).
- No teacher-facing timetable view build-out (Sprint I).
- `ConfirmDialog`'s `danger: false` / non-destructive styling is implemented but not exercised by
  any Sprint D call site — verify it renders correctly via its own component spec, not via a live
  call site.

## Testing expectations

- New component specs: `EntityTable.spec.ts`, `FormField.spec.ts`, `Button.spec.ts`,
  `ConfirmDialog.spec.ts`, `useConfirm.spec.ts` (covering: slot rendering, each `FormField` `type`,
  both `Button` variants, dialog open/confirm/cancel/Escape/focus-return, and the promise resolving
  `true`/`false` correctly).
- Every migrated CRUD screen's existing spec updated to match new markup/testids where they
  legitimately change (most `data-testid` values are preserved via `FormField`/`EntityTable`
  passthrough, so most spec assertions don't need to change) — each screen's full existing test
  coverage (add/edit/save/cancel/delete flows) must still pass after migration, not just compile.
- One new regression spec asserting zero `window.confirm` references remain anywhere in
  `staff-console/src` (grep-style test or lint rule) — prevents a future screen reintroducing the
  pattern.
- `AppShell.spec.ts` updated: assert `nav-timetable` is absent under the teacher role (was
  previously untested as a dead link, per the audit) and assert the breadcrumb nav's `aria-label` is
  `"Page title"`.
