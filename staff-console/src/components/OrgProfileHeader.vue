<!-- staff-console/src/components/OrgProfileHeader.vue -->
<!-- Identity strip for organisation profile pages (School, Campus): back link, initials badge,
     name + status, a few tag chips and a quick-facts row. Deliberately lighter than
     ProfileIdentityCard, which is built around person photos, age and tenure. -->
<script setup lang="ts">
import { RouterLink } from 'vue-router';
import StatusPill from './StatusPill.vue';

defineProps<{
  name: string;
  statusLabel: string;
  statusTone: 'success' | 'warning' | 'critical' | 'info' | 'neutral';
  backTo: string;
  backLabel: string;
  chips?: string[];
  stats?: Array<{ label: string; value: string | number }>;
}>();

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
</script>

<template>
  <div class="org-header">
    <RouterLink class="back-link" :to="backTo" data-testid="profile-back">← {{ backLabel }}</RouterLink>
    <div class="org-identity">
      <span class="org-avatar" aria-hidden="true">{{ initials(name) }}</span>
      <div class="org-titles">
        <div class="org-name-row">
          <h1 data-testid="profile-name">{{ name }}</h1>
          <StatusPill :tone="statusTone" :label="statusLabel" />
        </div>
        <div v-if="chips?.length" class="org-chips">
          <span v-for="chip in chips" :key="chip" class="org-chip">{{ chip }}</span>
        </div>
      </div>
      <slot name="actions" />
    </div>
    <dl v-if="stats?.length" class="org-stats">
      <div v-for="stat in stats" :key="stat.label" class="org-stat">
        <dt>{{ stat.label }}</dt>
        <dd class="mono">{{ stat.value }}</dd>
      </div>
    </dl>
  </div>
</template>

<style scoped>
.org-header {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  padding: var(--space-4) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.back-link {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-muted);
  text-decoration: none;
  width: fit-content;
}
.back-link:hover {
  color: var(--color-accent);
}
.org-identity {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}
.org-avatar {
  width: 56px;
  height: 56px;
  border-radius: var(--radius);
  background: var(--color-accent-tint, var(--color-status-info-tint));
  color: var(--color-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: var(--font-size-lg);
  flex-shrink: 0;
}
.org-titles {
  flex-grow: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.org-name-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.org-name-row h1 {
  margin: 0;
  font-size: var(--font-size-xl);
}
.org-chips {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.org-chip {
  font-size: var(--font-size-xs);
  color: var(--color-muted);
  border: 1px solid var(--color-border);
  border-radius: 9999px;
  padding: 0.1rem 0.6rem;
}
.org-stats {
  display: flex;
  gap: var(--space-5);
  margin: 0;
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
  flex-wrap: wrap;
}
.org-stat dt {
  font-size: var(--font-size-2xs);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-muted);
}
.org-stat dd {
  margin: 0.15rem 0 0;
  font-size: var(--font-size-lg);
  font-weight: 700;
}
</style>
