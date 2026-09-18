<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useConfirmQueue } from '../lib/useConfirm';

const { t } = useI18n();
const { queue, resolveActive } = useConfirmQueue();
const active = computed(() => queue.value[0] ?? null);

const cancelRef = ref<HTMLButtonElement | null>(null);
let previouslyFocused: HTMLElement | null = null;

watch(
  active,
  async (current, previous) => {
    if (current && !previous) {
      previouslyFocused = document.activeElement as HTMLElement | null;
      await nextTick();
      cancelRef.value?.focus();
    } else if (!current && previous) {
      previouslyFocused?.focus();
      previouslyFocused = null;
    }
  },
  { flush: 'post' },
);

function onConfirm() {
  resolveActive(true);
}
function onCancel() {
  resolveActive(false);
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') onCancel();
}
</script>

<template>
  <div
    v-if="active"
    class="confirm-overlay"
    data-testid="confirm-overlay"
    @click.self="onCancel"
    @keydown="onKeydown"
  >
    <div class="confirm-dialog" role="dialog" aria-modal="true" :aria-label="active.title">
      <h2>{{ active.title }}</h2>
      <p>{{ active.message }}</p>
      <div class="confirm-actions">
        <button ref="cancelRef" type="button" class="cancel" data-testid="confirm-cancel" @click="onCancel">
          {{ t('confirm.cancel') }}
        </button>
        <button
          type="button"
          class="accept"
          :class="{ danger: active.danger }"
          data-testid="confirm-accept"
          @click="onConfirm"
        >
          {{ active.confirmLabel ?? t('confirm.confirm') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 12, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}
.confirm-dialog {
  width: min(420px, 92vw);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  padding: var(--space-4);
}
.confirm-dialog h2 {
  font-size: var(--font-size-lg);
  margin-bottom: var(--space-2);
}
.confirm-dialog p {
  color: var(--color-muted);
  margin-bottom: var(--space-4);
}
.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
.confirm-actions button {
  padding: 0.4rem 0.8rem;
  border-radius: var(--radius-sm);
  font-weight: 600;
  cursor: pointer;
}
.confirm-actions .cancel {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text);
}
.confirm-actions .accept {
  border: none;
  background: var(--color-accent);
  color: var(--color-on-primary);
}
.confirm-actions .accept.danger {
  background: var(--color-destructive);
}
</style>
