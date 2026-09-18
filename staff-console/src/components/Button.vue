<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary';
    disabled?: boolean;
  }>(),
  { variant: 'primary', disabled: false },
);
</script>

<template>
  <button type="button" class="btn" :class="variant" :disabled="disabled">
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-on-primary);
  font-weight: 600;
  cursor: pointer;
  transition: background var(--transition-fast), transform var(--transition-fast);
}
.btn.secondary {
  background: transparent;
  color: var(--color-destructive);
  border: 1px solid var(--color-destructive);
}
.btn:active:not(:disabled) {
  transform: scale(0.97);
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
