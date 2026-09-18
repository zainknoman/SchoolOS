<script setup lang="ts">
import { useToastQueue } from '../lib/useToast';
import Icon from './AppIcon.vue';

const { toasts, dismiss } = useToastQueue();
</script>

<template>
  <div class="toast-host" data-testid="toast-host" aria-live="polite" role="status">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast"
        :class="toast.tone"
        :data-testid="`toast-${toast.id}`"
      >
        <Icon :name="toast.tone === 'error' ? 'warning' : 'bell'" :size="16" />
        <span class="toast-message">{{ toast.message }}</span>
        <button
          type="button"
          class="toast-dismiss"
          :data-testid="`toast-dismiss-${toast.id}`"
          aria-label="Dismiss"
          @click="dismiss(toast.id)"
        >
          &times;
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  bottom: var(--space-4);
  right: var(--space-4);
  z-index: 300;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: min(360px, calc(100vw - 2 * var(--space-4)));
}
.toast {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
}
.toast.success {
  border-color: var(--color-status-success);
  color: var(--color-status-success);
}
.toast.error {
  border-color: var(--color-status-critical);
  color: var(--color-status-critical);
}
.toast.info {
  border-color: var(--color-status-info);
  color: var(--color-status-info);
}
.toast-message {
  flex: 1;
  font-size: var(--font-size-sm);
  color: var(--color-text);
}
.toast-dismiss {
  flex-shrink: 0;
  border: none;
  background: none;
  color: inherit;
  font-size: var(--font-size-lg);
  line-height: 1;
  cursor: pointer;
  padding: 0 var(--space-1);
  transition: transform var(--transition-fast);
}
.toast-dismiss:active {
  transform: scale(0.9);
}

.toast-enter-active {
  transition: transform var(--duration-base) var(--ease-spring), opacity var(--transition-base);
}
.toast-leave-active {
  transition: transform var(--transition-fast), opacity var(--transition-fast);
  position: absolute;
}
.toast-enter-from {
  transform: translateX(16px);
  opacity: 0;
}
.toast-leave-to {
  transform: translateX(16px);
  opacity: 0;
}
</style>
