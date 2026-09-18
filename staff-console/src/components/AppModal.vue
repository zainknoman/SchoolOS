<script setup lang="ts">
defineProps<{
  modelValue: boolean;
  title: string;
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
        <h2>{{ title }}</h2>
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
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}
.modal-header h2 {
  font-size: var(--font-size-lg);
}
.modal-close {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  color: var(--color-muted);
}
</style>
