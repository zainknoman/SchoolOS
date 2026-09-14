import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import EntityTable from './EntityTable.vue';

interface Row extends Record<string, unknown> {
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

  describe('search', () => {
    it('renders a search box', () => {
      const wrapper = mount(EntityTable, {
        props: { items, columns, rowKey: 'id', editingId: null },
      });
      expect(wrapper.find('[data-testid="entity-search"]').exists()).toBe(true);
    });

    it('filters rows to those whose column values match the search text, case-insensitively', async () => {
      const wrapper = mount(EntityTable, {
        props: { items, columns, rowKey: 'id', editingId: null },
      });

      await wrapper.find('[data-testid="entity-search"]').setValue('beta');

      expect(wrapper.text()).toContain('Beta');
      expect(wrapper.text()).not.toContain('Alpha');
    });

    it('shows a "no results" message when nothing matches', async () => {
      const wrapper = mount(EntityTable, {
        props: { items, columns, rowKey: 'id', editingId: null },
      });

      await wrapper.find('[data-testid="entity-search"]').setValue('nonexistent');

      expect(wrapper.find('[data-testid="entity-no-results"]').exists()).toBe(true);
    });
  });

  describe('pagination', () => {
    const manyItems: Row[] = [
      { id: 'r1', name: 'Alpha' },
      { id: 'r2', name: 'Beta' },
      { id: 'r3', name: 'Gamma' },
      { id: 'r4', name: 'Delta' },
    ];

    it('does not show pagination controls when everything fits on one page', () => {
      const wrapper = mount(EntityTable, {
        props: { items, columns, rowKey: 'id', editingId: null, pageSize: 10 },
      });
      expect(wrapper.find('[data-testid="entity-pagination-info"]').exists()).toBe(false);
    });

    it('shows only the first page of rows and paginates via next/prev', async () => {
      const wrapper = mount(EntityTable, {
        props: { items: manyItems, columns, rowKey: 'id', editingId: null, pageSize: 2 },
      });

      expect(wrapper.text()).toContain('Alpha');
      expect(wrapper.text()).toContain('Beta');
      expect(wrapper.text()).not.toContain('Gamma');
      expect(wrapper.find('[data-testid="entity-pagination-info"]').text()).toBe('Page 1 of 2');
      expect(wrapper.find('[data-testid="entity-pagination-prev"]').attributes('disabled')).toBeDefined();

      await wrapper.find('[data-testid="entity-pagination-next"]').trigger('click');

      expect(wrapper.text()).not.toContain('Alpha');
      expect(wrapper.text()).toContain('Gamma');
      expect(wrapper.text()).toContain('Delta');
      expect(wrapper.find('[data-testid="entity-pagination-next"]').attributes('disabled')).toBeDefined();

      await wrapper.find('[data-testid="entity-pagination-prev"]').trigger('click');

      expect(wrapper.text()).toContain('Alpha');
      expect(wrapper.text()).not.toContain('Gamma');
    });

    it('jumps back to page 1 when a search narrows the results below the current page', async () => {
      const wrapper = mount(EntityTable, {
        props: { items: manyItems, columns, rowKey: 'id', editingId: null, pageSize: 2 },
      });

      await wrapper.find('[data-testid="entity-pagination-next"]').trigger('click');
      expect(wrapper.text()).toContain('Gamma');

      await wrapper.find('[data-testid="entity-search"]').setValue('alpha');

      expect(wrapper.find('[data-testid="entity-pagination-info"]').exists()).toBe(false);
      expect(wrapper.text()).toContain('Alpha');
    });

    it('resets to page 1 (not just clamps to the last valid page) when search still leaves more than one page', async () => {
      // 6 items at pageSize 2 = 3 pages. Start on page 3, then filter down to 4 matches (2 pages).
      // A page-clamp with no reset would land on page 2 (min(3, 2)); a real reset lands on page 1.
      const sixItems: Row[] = [
        { id: 'r1', name: 'Match One' },
        { id: 'r2', name: 'Match Two' },
        { id: 'r3', name: 'Match Three' },
        { id: 'r4', name: 'Match Four' },
        { id: 'r5', name: 'Other Five' },
        { id: 'r6', name: 'Other Six' },
      ];
      const wrapper = mount(EntityTable, {
        props: { items: sixItems, columns, rowKey: 'id', editingId: null, pageSize: 2 },
      });

      await wrapper.find('[data-testid="entity-pagination-next"]').trigger('click');
      await wrapper.find('[data-testid="entity-pagination-next"]').trigger('click');
      expect(wrapper.find('[data-testid="entity-pagination-info"]').text()).toBe('Page 3 of 3');

      await wrapper.find('[data-testid="entity-search"]').setValue('match');

      expect(wrapper.find('[data-testid="entity-pagination-info"]').text()).toBe('Page 1 of 2');
      expect(wrapper.text()).toContain('Match One');
      expect(wrapper.text()).toContain('Match Two');
      expect(wrapper.text()).not.toContain('Match Three');
    });

    it('paginates at the default page size of 10 when pageSize is not passed', () => {
      const elevenItems: Row[] = Array.from({ length: 11 }, (_, i) => ({ id: `r${i + 1}`, name: `Item ${i + 1}` }));
      const wrapper = mount(EntityTable, {
        props: { items: elevenItems, columns, rowKey: 'id', editingId: null },
      });

      expect(wrapper.text()).toContain('Item 1');
      expect(wrapper.text()).toContain('Item 10');
      expect(wrapper.text()).not.toContain('Item 11');
      expect(wrapper.find('[data-testid="entity-pagination-info"]').text()).toBe('Page 1 of 2');
    });

    it('shows an empty table with no pagination controls when items is empty', () => {
      const wrapper = mount(EntityTable, {
        props: { items: [], columns, rowKey: 'id', editingId: null },
      });

      expect(wrapper.find('[data-testid="entity-no-results"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="entity-pagination-info"]').exists()).toBe(false);
    });
  });

  describe('search across non-string column values', () => {
    it('matches inside an object-valued column (e.g. a file field rendered via a custom slot)', async () => {
      interface DocRow extends Record<string, unknown> {
        id: string;
        file: { originalName: string };
      }
      const docItems: DocRow[] = [
        { id: 'd1', file: { originalName: 'passport.pdf' } },
        { id: 'd2', file: { originalName: 'birth-certificate.pdf' } },
      ];
      const docColumns = [{ key: 'file', label: 'File' }];
      const wrapper = mount(EntityTable, {
        props: { items: docItems, columns: docColumns, rowKey: 'id', editingId: null },
        slots: {
          'cell-file': `<template #cell-file="{ item }">{{ item.file.originalName }}</template>`,
        },
      });

      await wrapper.find('[data-testid="entity-search"]').setValue('passport');

      expect(wrapper.text()).toContain('passport.pdf');
      expect(wrapper.text()).not.toContain('birth-certificate.pdf');
    });

    it('matches inside an array-valued column across more than one search-relevant column', async () => {
      interface StudentRow extends Record<string, unknown> {
        id: string;
        name: string;
        parentNames: string[];
      }
      const studentItems: StudentRow[] = [
        { id: 's1', name: 'Eshaal Sample', parentNames: ['Existing Parent'] },
        { id: 's2', name: 'Zoya Khan', parentNames: ['Another Parent'] },
      ];
      const studentColumns = [
        { key: 'name', label: 'Name' },
        { key: 'parentNames', label: 'Parents' },
      ];
      const wrapper = mount(EntityTable, {
        props: { items: studentItems, columns: studentColumns, rowKey: 'id', editingId: null },
      });

      await wrapper.find('[data-testid="entity-search"]').setValue('another parent');

      expect(wrapper.text()).toContain('Zoya Khan');
      expect(wrapper.text()).not.toContain('Eshaal Sample');
    });
  });

  describe('accessibility', () => {
    it('gives the search input an accessible name', () => {
      const wrapper = mount(EntityTable, {
        props: { items, columns, rowKey: 'id', editingId: null },
      });
      expect(wrapper.find('[data-testid="entity-search"]').attributes('aria-label')).toBeTruthy();
    });
  });
});
