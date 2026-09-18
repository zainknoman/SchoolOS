<script setup lang="ts">
import Icon, { type IconName } from './AppIcon.vue';

withDefaults(
  defineProps<{
    icon?: IconName;
    title: string;
    message?: string;
    ctaLabel?: string;
  }>(),
  { icon: 'grid' },
);

defineEmits<{ cta: [] }>();
</script>

<template>
  <div class="empty-state" data-testid="empty-state">
    <span class="empty-state-icon"><Icon :name="icon" :size="26" /></span>
    <p class="empty-state-title">{{ title }}</p>
    <p v-if="message" class="empty-state-message">{{ message }}</p>
    <button
      v-if="ctaLabel"
      type="button"
      class="empty-state-cta"
      data-testid="empty-state-cta"
      @click="$emit('cta')"
    >
      {{ ctaLabel }}
    </button>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-1);
  padding: var(--space-6) var(--space-4);
  color: var(--color-muted);
}
.empty-state-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: var(--radius-full);
  background: var(--color-muted-bg);
  color: var(--color-muted);
  margin-bottom: var(--space-2);
}
.empty-state-title {
  font-weight: 600;
  color: var(--color-text);
}
.empty-state-message {
  font-size: var(--font-size-sm);
  max-width: 40ch;
}
.empty-state-cta {
  margin-top: var(--space-2);
  padding: 0.45rem 0.9rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-on-primary);
  font-weight: 600;
  cursor: pointer;
  transition: background var(--transition-fast), transform var(--transition-fast);
}
.empty-state-cta:hover {
  background: var(--color-accent-hover);
}
.empty-state-cta:active {
  transform: scale(0.98);
}
</style>
