<!-- staff-console/src/components/ListPageCard.vue -->
<!-- Page-level shell for list/CRUD pages: icon+title header (with an optional subtitle), a
     right-aligned actions slot ("+ Add New"), an optional toolbar slot (search/filter chips,
     a section/class picker), and a body slot for the table or card grid underneath. A
     generalization of ProfileSectionCard.vue for list-page chrome rather than a profile-page
     panel — see the design-system rollout plan, Section 4.2 (open decision 11.2 on whether this
     stays a separate component or folds into ProfileSectionCard). -->
<script setup lang="ts">
import AppIcon, { type IconName } from './AppIcon.vue';

defineProps<{
  icon: IconName;
  title: string;
  subtitle?: string;
}>();
</script>

<template>
  <section class="list-page-card">
    <header class="list-page-card-header">
      <div class="list-page-card-title">
        <span class="list-page-card-icon"><AppIcon :name="icon" :size="16" /></span>
        <div>
          <h1>{{ title }}</h1>
          <p v-if="subtitle" class="list-page-card-subtitle">{{ subtitle }}</p>
        </div>
      </div>
      <div class="list-page-card-actions">
        <slot name="actions" />
      </div>
    </header>
    <div v-if="$slots.toolbar" class="list-page-card-toolbar">
      <slot name="toolbar" />
    </div>
    <div class="list-page-card-body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.list-page-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.list-page-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.list-page-card-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.list-page-card-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  background: var(--color-status-info-tint);
  color: var(--color-accent);
}
.list-page-card-title h1 {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: 800;
  color: var(--color-primary);
}
.list-page-card-subtitle {
  margin: 0.2rem 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-muted);
}
.list-page-card-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}
.list-page-card-toolbar {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-3) var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.list-page-card-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

@media (max-width: 768px) {
  .list-page-card-header {
    flex-direction: column;
    align-items: flex-start;
  }
  .list-page-card-actions {
    width: 100%;
  }
}
</style>
