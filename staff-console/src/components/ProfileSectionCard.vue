<!-- staff-console/src/components/ProfileSectionCard.vue -->
<!-- A titled panel with an icon badge and an optional right-aligned action slot — replaces the
     ad hoc <div class="profile-section"> pattern with one consistent "paper" card language for
     detail-page panels (Student Profile today; any future profile-style page can reuse it). -->
<script setup lang="ts">
import AppIcon, { type IconName } from './AppIcon.vue';

defineProps<{
  icon: IconName;
  title: string;
}>();
</script>

<template>
  <section class="section-card">
    <header class="section-card-header">
      <div class="section-card-title">
        <span class="section-card-icon"><AppIcon :name="icon" :size="16" /></span>
        <h2>{{ title }}</h2>
      </div>
      <div class="section-card-actions">
        <slot name="actions" />
      </div>
    </header>
    <div class="section-card-body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.section-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  padding: var(--space-4) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.section-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
.section-card-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.section-card-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  background: var(--color-status-info-tint);
  color: var(--color-accent);
}
.section-card-title h2 {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: 700;
}
.section-card-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

@media (max-width: 768px) {
  .section-card {
    padding: var(--space-3) var(--space-4);
  }
}
</style>
