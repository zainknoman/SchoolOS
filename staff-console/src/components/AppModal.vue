<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import AppIcon, { type IconName } from './AppIcon.vue';

const props = defineProps<{
  modelValue: boolean;
  title: string;
  icon?: IconName;
  subtitle?: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

// BL-55 (WCAG 2.4.3): focus moves into the dialog when it opens, Tab cycles inside it, and focus
// returns to whatever opened it when it closes.
const dialogRef = ref<HTMLElement | null>(null);
let previouslyFocused: HTMLElement | null = null;
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(): HTMLElement[] {
  return dialogRef.value ? Array.from(dialogRef.value.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];
}

watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      previouslyFocused = document.activeElement as HTMLElement | null;
      await nextTick();
      // First field of the form, not the close button, so keyboard users can start typing.
      const items = focusables();
      (items.find((el) => !el.classList.contains('modal-close')) ?? items[0] ?? dialogRef.value)?.focus();
    } else {
      restoreFocus();
    }
  },
  { immediate: true },
);

onBeforeUnmount(restoreFocus);

function restoreFocus() {
  if (previouslyFocused?.isConnected) previouslyFocused.focus();
  previouslyFocused = null;
}

function close() {
  emit('update:modelValue', false);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    close();
    return;
  }
  if (event.key !== 'Tab') return;
  const items = focusables();
  if (items.length === 0) {
    event.preventDefault();
    return;
  }
  const first = items[0]!;
  const last = items[items.length - 1]!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
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
    <div ref="dialogRef" class="modal-dialog" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1">
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
