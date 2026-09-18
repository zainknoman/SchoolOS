<script setup lang="ts">
import { ref } from 'vue';
import AppIcon, { type IconName } from './AppIcon.vue';

interface TabDef {
  id: string;
  label: string;
  icon?: IconName;
}

const props = withDefaults(
  defineProps<{
    tabs: TabDef[];
    modelValue: string;
    /** 'pill' is a segmented-control look for identity-heavy detail pages (e.g. Student Profile);
     * 'underline' (default) is the original tab-strip look used elsewhere. */
    variant?: 'underline' | 'pill';
  }>(),
  { variant: 'underline' },
);
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
  <div class="tabs" :class="`variant-${variant}`">
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
        <AppIcon v-if="tab.icon" :name="tab.icon" :size="15" />
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
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
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
  transition: color var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast), box-shadow var(--transition-fast);
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

/* Pill/segmented variant — an opt-in look for identity-heavy detail pages. */
.variant-pill .tab-list {
  display: inline-flex;
  gap: var(--space-0-5);
  background: var(--color-muted-bg);
  padding: 0.3rem;
  border-radius: var(--radius-full);
  border-bottom: none;
  overflow-x: auto;
  max-width: 100%;
}
.variant-pill .tab-trigger {
  border-bottom: none;
  border-radius: var(--radius-full);
  margin-bottom: 0;
  padding: 0.55rem 1rem;
}
.variant-pill .tab-trigger.active {
  background: var(--color-surface);
  color: var(--color-accent);
  box-shadow: var(--shadow-sm);
}
</style>
