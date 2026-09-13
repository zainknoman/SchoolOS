<script setup lang="ts">
defineProps<{
  tone: 'success' | 'warning' | 'critical' | 'info' | 'neutral';
  label: string;
}>();
</script>

<template>
  <span class="status-pill" :class="`tone-${tone}`" data-testid="status-pill">{{ label }}</span>
</template>

<style scoped>
.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-size: var(--font-size-sm);
  font-weight: 600;
  line-height: 1.4;
}
.tone-success {
  background: var(--color-status-success-tint, #dcfce7);
  color: var(--color-status-success, #166534);
}
.tone-warning {
  background: var(--color-status-warning-tint, #fef9c3);
  color: var(--color-status-warning, #854d0e);
}
.tone-critical {
  background: var(--color-status-critical-tint, #fee2e2);
  color: var(--color-status-critical, #991b1b);
}
.tone-info {
  background: var(--color-status-info-tint, #dbeafe);
  color: var(--color-status-info, #1e40af);
}
.tone-neutral {
  background: var(--color-status-neutral-tint, #f1f5f9);
  color: var(--color-status-neutral, #475569);
}
</style>
