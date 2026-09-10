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
