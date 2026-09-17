<script setup lang="ts">
import { ref } from 'vue';

interface TabDef {
  id: string;
  label: string;
}

const props = defineProps<{
  tabs: TabDef[];
  modelValue: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const tabRefs = ref<HTMLButtonElement[]>([]);

function select(id: string) {
  emit('update:modelValue', id);
}

function onKeydown(event: KeyboardEvent, index: number) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
  event.preventDefault();
  const delta = event.key === 'ArrowRight' ? 1 : -1;
  const nextIndex = (index + delta + props.tabs.length) % props.tabs.length;
  const next = props.tabs[nextIndex];
  if (!next) return;
  select(next.id);
  tabRefs.value[nextIndex]?.focus();
}
</script>

<template>
  <div class="tabs">
    <div class="tab-list" role="tablist">
      <button
        v-for="(tab, index) in tabs"
        :key="tab.id"
        :ref="(el) => { if (el) tabRefs[index] = el as HTMLButtonElement; }"
        type="button"
        role="tab"
        class="tab-trigger"
        :class="{ active: modelValue === tab.id }"
        :aria-selected="modelValue === tab.id"
        :tabindex="modelValue === tab.id ? 0 : -1"
        :data-testid="`tab-${tab.id}`"
        @click="select(tab.id)"
        @keydown="onKeydown($event, index)"
      >
        {{ tab.label }}
      </button>
    </div>
    <div v-for="tab in tabs" :key="tab.id" v-show="modelValue === tab.id" role="tabpanel" class="tab-panel">
      <slot :name="`tab-${tab.id}`" />
    </div>
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.tab-list {
  display: flex;
  gap: var(--space-1);
  border-bottom: 1px solid var(--color-border);
  overflow-x: auto;
}
.tab-trigger {
  padding: 0.6rem 1rem;
  border: none;
  background: none;
  color: var(--color-muted);
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color var(--transition-fast, 0.15s), border-color var(--transition-fast, 0.15s);
}
.tab-trigger:hover {
  color: var(--color-text);
}
.tab-trigger.active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}
.tab-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
</style>
