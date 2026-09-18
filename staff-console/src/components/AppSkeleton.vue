<script setup lang="ts">
withDefaults(
  defineProps<{
    width?: string;
    height?: string;
    circle?: boolean;
  }>(),
  { width: '100%', height: '1rem', circle: false },
);
</script>

<template>
  <span
    class="skeleton"
    data-testid="skeleton"
    aria-hidden="true"
    :class="{ circle }"
    :style="{ width, height }"
  />
</template>

<style scoped>
/* Shimmer via a moving gradient, not a spinner — matches the shape of what's loading instead of
   a generic circular indicator. The global `prefers-reduced-motion` rule in base.css already
   forces animation-duration to ~0 for every element, so no local override is needed here. */
.skeleton {
  display: inline-block;
  border-radius: var(--radius-sm);
  background: linear-gradient(
    90deg,
    var(--color-muted-bg) 25%,
    var(--color-border) 37%,
    var(--color-muted-bg) 63%
  );
  background-size: 400% 100%;
  animation: skeleton-shimmer 1.4s ease-in-out infinite;
}
.skeleton.circle {
  border-radius: 50%;
}
@keyframes skeleton-shimmer {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}
</style>
