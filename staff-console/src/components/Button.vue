<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router';

withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary';
    disabled?: boolean;
    /** Renders a router link styled as a button, for actions that navigate. */
    to?: RouteLocationRaw;
  }>(),
  { variant: 'primary', disabled: false },
);
</script>

<template>
  <RouterLink v-if="to" :to="to" class="btn" :class="variant">
    <slot />
  </RouterLink>
  <button v-else type="button" class="btn" :class="variant" :disabled="disabled">
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
  text-decoration: none;
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
