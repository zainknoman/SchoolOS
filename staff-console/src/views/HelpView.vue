<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import ListPageCard from '../components/ListPageCard.vue';
import FormField from '../components/FormField.vue';
import EmptyState from '../components/EmptyState.vue';
import { HELP_GROUPS, helpEntriesFor, type HelpEntry } from '../lib/help-content';

// The Help Document (header profile menu → Help Document): every screen and header control the
// signed-in user can use, grouped as in the side menu, with what it is for and how to use it.
const auth = useAuthStore();
const isTeacher = computed(() => auth.role === 'TEACHER');

const query = ref('');
const group = ref('');

const entries = computed(() =>
  helpEntriesFor({ role: auth.role, isPrincipal: auth.isPrincipal, hasModule: auth.hasModule }),
);

const groupOptions = computed(() => [
  { value: '', label: 'All groups' },
  ...HELP_GROUPS.filter((g) => entries.value.some((e) => e.group === g)).map((g) => ({ value: g, label: g })),
]);

function matches(e: HelpEntry, q: string): boolean {
  return [e.group, e.name, e.description, ...e.steps].some((text) => text.toLowerCase().includes(q));
}

const sections = computed(() => {
  const q = query.value.trim().toLowerCase();
  const shown = entries.value.filter((e) => (!group.value || e.group === group.value) && (!q || matches(e, q)));
  return HELP_GROUPS.map((g) => ({ group: g, items: shown.filter((e) => e.group === g) })).filter(
    (s) => s.items.length > 0,
  );
});

function linkFor(e: HelpEntry): string | undefined {
  return isTeacher.value ? e.to?.teacher : e.to?.admin;
}
</script>

<template>
  <ListPageCard icon="help" title="Help Document" subtitle="What each screen is for and how to use it">
    <template #toolbar>
      <FormField
        v-model="query"
        label="Search help"
        hide-label
        type="text"
        placeholder="Search, e.g. syllabus or vouchers"
        data-testid="help-search"
      />
      <FormField
        v-model="group"
        label="Group"
        hide-label
        type="select"
        :options="groupOptions"
        data-testid="help-group"
      />
    </template>

    <EmptyState
      v-if="sections.length === 0"
      icon="help"
      title="Nothing matches"
      message="Try another word, or choose All groups."
    />

    <section v-for="s in sections" :key="s.group" class="help-group" :data-testid="`help-group-${s.group}`">
      <h2>{{ s.group }}</h2>
      <article v-for="e in s.items" :key="e.id" class="help-entry" lang="en" dir="ltr" :data-testid="`help-entry-${e.id}`">
        <header class="help-entry-head">
          <div>
            <span class="help-entry-group">{{ e.group }}</span>
            <h3>{{ e.name }}</h3>
          </div>
          <RouterLink v-if="linkFor(e)" :to="linkFor(e)!" class="help-open" :data-testid="`help-open-${e.id}`"
            >Open screen</RouterLink
          >
        </header>
        <p class="help-description">{{ e.description }}</p>
        <h4>How to use it</h4>
        <ol class="help-steps">
          <li v-for="(step, i) in e.steps" :key="i">{{ step }}</li>
        </ol>
      </article>
    </section>
  </ListPageCard>
</template>

<style scoped>
.help-group + .help-group {
  margin-top: var(--space-5);
}
.help-group h2 {
  font-size: var(--font-size-sm);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-muted);
  margin: 0 0 var(--space-2);
}
.help-entry {
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}
.help-entry + .help-entry {
  margin-top: var(--space-2);
}
.help-entry-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}
.help-entry-group {
  font-size: var(--font-size-2xs);
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.help-entry h3 {
  margin: 0;
  font-size: var(--font-size-base);
}
.help-open {
  font-size: var(--font-size-sm);
  color: var(--color-accent);
  white-space: nowrap;
}
.help-description {
  margin: var(--space-1) 0 var(--space-2);
}
.help-entry h4 {
  margin: 0 0 var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--color-muted);
}
.help-steps {
  margin: 0;
  padding-inline-start: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: var(--space-0-5);
  font-size: var(--font-size-sm);
}
</style>
