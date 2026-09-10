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
