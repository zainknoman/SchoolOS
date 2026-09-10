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
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-on-primary);
  font-weight: 600;
  cursor: pointer;
}
.btn.secondary {
  background: transparent;
  color: var(--color-destructive);
  border: 1px solid var(--color-destructive);
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
