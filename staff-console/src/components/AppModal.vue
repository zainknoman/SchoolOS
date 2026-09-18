<script setup lang="ts">
import AppIcon, { type IconName } from './AppIcon.vue';

defineProps<{
  modelValue: boolean;
  title: string;
  icon?: IconName;
  subtitle?: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

function close() {
  emit('update:modelValue', false);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close();
}
</script>

<template>
  <div
    v-if="modelValue"
    class="modal-overlay"
    data-testid="modal-overlay"
    @click.self="close"
    @keydown="onKeydown"
  >
    <div class="modal-dialog" role="dialog" aria-modal="true" :aria-label="title">
      <div class="modal-header">
        <span v-if="icon" class="modal-icon"><AppIcon :name="icon" :size="19" /></span>
        <div class="modal-heading">
          <h2>{{ title }}</h2>
          <p v-if="subtitle" class="modal-subtitle">{{ subtitle }}</p>
        </div>
        <button type="button" class="modal-close" data-testid="modal-close" aria-label="Close" @click="close">
          &times;
        </button>
      </div>
      <div class="modal-body">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 12, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: var(--space-4);
}
.modal-dialog {
  width: min(720px, 92vw);
  max-height: 90vh;
  overflow-y: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  padding: var(--space-4);
}
.modal-header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}
.modal-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  background: var(--color-status-info-tint);
  color: var(--color-accent);
}
.modal-heading {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.modal-header h2 {
  font-size: var(--font-size-lg);
}
.modal-subtitle {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-muted);
  line-height: 1.5;
}
.modal-close {
  flex-shrink: 0;
  background: transparent;
  border: none;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  color: var(--color-muted);
}
</style>
