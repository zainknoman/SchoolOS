<script setup lang="ts">
import Icon from './AppIcon.vue';

defineProps<{ message: string }>();
defineEmits<{ retry: [] }>();
</script>

<template>
  <div class="error-retry" role="alert" data-testid="error-retry">
    <Icon name="warning" :size="18" />
    <span class="error-retry-message">{{ message }}</span>
    <button type="button" class="error-retry-button" data-testid="error-retry-button" @click="$emit('retry')">
      Retry
    </button>
  </div>
</template>

<style scoped>
.error-retry {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-status-critical-tint);
  border-radius: var(--radius-sm);
  background: var(--color-status-critical-tint);
  color: var(--color-status-critical);
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-3);
}
.error-retry-message {
  flex: 1;
}
.error-retry-button {
  flex-shrink: 0;
  padding: 0.3rem 0.7rem;
  border: 1px solid currentColor;
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  font-weight: 600;
  font: inherit;
  cursor: pointer;
  transition: background var(--transition-fast), transform var(--transition-fast);
}
.error-retry-button:hover {
  background: rgb(0 0 0 / 0.06);
}
.error-retry-button:active {
  transform: scale(0.96);
}
</style>
