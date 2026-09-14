<script setup lang="ts" generic="T extends Record<string, unknown>">
import { computed, ref, watch } from 'vue';

interface Column {
  key: string;
  label: string;
}

const props = withDefaults(
  defineProps<{
    items: T[];
    columns: Column[];
    rowKey: keyof T;
    editingId: unknown;
    pageSize?: number;
  }>(),
  { pageSize: 10 },
);

const searchQuery = ref('');
const currentPage = ref(1);

watch(searchQuery, () => {
  currentPage.value = 1;
});

function stringifyForSearch(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(stringifyForSearch).join(' ');
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).map(stringifyForSearch).join(' ');
  return String(value);
}

const filteredItems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return props.items;
  return props.items.filter((item) =>
    props.columns.some((col) => stringifyForSearch(item[col.key]).toLowerCase().includes(query)),
  );
});

const totalPages = computed(() => Math.max(1, Math.ceil(filteredItems.value.length / props.pageSize)));
const safePage = computed(() => Math.min(currentPage.value, totalPages.value));

const pagedItems = computed(() => {
  const start = (safePage.value - 1) * props.pageSize;
  return filteredItems.value.slice(start, start + props.pageSize);
});
</script>

<template>
  <div class="entity-table-toolbar">
    <input
      v-model="searchQuery"
      type="search"
      class="entity-search"
      data-testid="entity-search"
      placeholder="Search…"
      aria-label="Search"
    />
  </div>
  <table class="entity-table" :class="{ 'has-pagination': totalPages > 1 }">
    <thead>
      <tr>
        <th v-for="col in columns" :key="col.key">{{ col.label }}</th>
        <th class="actions-col"></th>
      </tr>
    </thead>
    <tbody>
      <tr v-if="pagedItems.length === 0">
        <td :colspan="columns.length + 1" data-testid="entity-no-results" class="no-results">No matching rows.</td>
      </tr>
      <tr v-for="item in pagedItems" :key="String(item[rowKey])">
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
  <div v-if="totalPages > 1" class="entity-table-pagination">
    <button
      type="button"
      data-testid="entity-pagination-prev"
      :disabled="safePage === 1"
      @click="currentPage = safePage - 1"
    >
      Prev
    </button>
    <span data-testid="entity-pagination-info">Page {{ safePage }} of {{ totalPages }}</span>
    <button
      type="button"
      data-testid="entity-pagination-next"
      :disabled="safePage === totalPages"
      @click="currentPage = safePage + 1"
    >
      Next
    </button>
  </div>
</template>

<style scoped>
.entity-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: var(--space-4);
}
.entity-table.has-pagination {
  margin-bottom: 0;
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
.entity-table-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-2);
}
.entity-search {
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm, 4px);
  min-width: 220px;
}
.no-results {
  text-align: center;
  color: var(--color-muted);
  padding: var(--space-3);
}
.entity-table-pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-2);
  margin-bottom: var(--space-4);
}
</style>
