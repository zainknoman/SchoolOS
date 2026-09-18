<script setup lang="ts" generic="T extends Record<string, unknown>">
import { computed, ref, watch } from 'vue';
import EmptyState from './EmptyState.vue';
import AppSkeleton from './AppSkeleton.vue';
import type { IconName } from './AppIcon.vue';

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
    /** Shows shape-matched skeleton rows instead of the table while an initial fetch is in flight. */
    loading?: boolean;
    /** Rendered instead of the table when `items` is empty (not to be confused with a search
     * that matches nothing — that still shows the in-table "No matching rows" row below). */
    emptyIcon?: IconName;
    emptyTitle?: string;
    emptyMessage?: string;
    emptyCtaLabel?: string;
  }>(),
  { pageSize: 10, loading: false, emptyTitle: 'Nothing here yet.' },
);

defineEmits<{ 'empty-cta': [] }>();

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
  <template v-if="loading">
    <div class="entity-table-toolbar">
      <AppSkeleton width="220px" height="1.8rem" />
    </div>
    <table class="entity-table" data-testid="entity-table-loading">
      <thead>
        <tr>
          <th v-for="col in columns" :key="col.key">{{ col.label }}</th>
          <th class="actions-col"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="n in 5" :key="n">
          <td v-for="col in columns" :key="col.key"><AppSkeleton height="0.9rem" /></td>
          <td class="actions-col"><AppSkeleton width="4rem" height="0.9rem" /></td>
        </tr>
      </tbody>
    </table>
  </template>

  <EmptyState
    v-else-if="items.length === 0"
    :icon="emptyIcon"
    :title="emptyTitle"
    :message="emptyMessage"
    :cta-label="emptyCtaLabel"
    @cta="$emit('empty-cta')"
  />

  <template v-else>
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
        <tr
          v-for="(item, index) in pagedItems"
          :key="String(item[rowKey])"
          class="entity-row"
          :style="{ '--row-index': index }"
        >
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
  <div v-if="!loading && items.length > 0 && totalPages > 1" class="entity-table-pagination">
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

/* Waterfall reveal on mount — capped so a long page doesn't keep animating rows for seconds;
   `prefers-reduced-motion` is already handled globally in base.css. */
.entity-row {
  animation: entity-row-in var(--duration-base) var(--ease-standard) backwards;
  animation-delay: calc(min(var(--row-index), 10) * 30ms);
}
@keyframes entity-row-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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
