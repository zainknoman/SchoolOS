<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type TimetableEntrySummary } from '../lib/api';

const DAY_OPTIONS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const auth = useAuthStore();
const entries = ref<TimetableEntrySummary[]>([]);
const errorMessage = ref<string | null>(null);

async function load() {
  if (!auth.accessToken) return;
  try {
    entries.value = await api.teacherTimetable(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load your timetable.';
  }
}
load();

const sortedEntries = computed(() =>
  [...entries.value].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.period - b.period),
);
const periods = computed(() => {
  const set = new Set(sortedEntries.value.map((e) => e.period));
  return Array.from(set).sort((a, b) => a - b);
});

function entryAt(period: number, day: number): TimetableEntrySummary | undefined {
  return sortedEntries.value.find((e) => e.period === period && e.dayOfWeek === day);
}
function periodTimeLabel(period: number): string {
  const match = sortedEntries.value.find((e) => e.period === period);
  return match ? `${match.startTime}–${match.endTime}` : '';
}
</script>

<template>
  <div class="teacher-timetable">
    <h1>My Timetable</h1>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
    <p v-else-if="!sortedEntries.length" class="empty">No periods scheduled for you yet.</p>

    <div v-else class="tt-grid-wrap">
      <table class="tt-grid" data-testid="teacher-timetable-grid">
        <thead>
          <tr>
            <th class="tt-day-col">Day</th>
            <th v-for="p in periods" :key="p" class="tt-period-col">
              P{{ p }}
              <span class="tt-period-time">{{ periodTimeLabel(p) }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in DAY_OPTIONS" :key="d.value">
            <td class="tt-day-label">{{ d.label }}</td>
            <td v-for="p in periods" :key="p">
              <div v-if="entryAt(p, d.value)" class="tt-cell" :data-testid="`teacher-cell-${p}-${d.value}`">
                <b>{{ entryAt(p, d.value)!.subject }}</b>
                <span v-if="entryAt(p, d.value)!.room">Rm {{ entryAt(p, d.value)!.room }}</span>
              </div>
              <div v-else class="tt-empty">—</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.teacher-timetable {
  max-width: 960px;
}
.error {
  color: var(--color-destructive);
  margin-bottom: var(--space-3);
}
.empty {
  color: var(--color-muted);
}
.tt-grid-wrap {
  overflow-x: auto;
}
.tt-grid {
  border-collapse: separate;
  border-spacing: 0;
  min-width: 640px;
  width: 100%;
}
.tt-grid th {
  background: var(--color-muted-bg);
  border: 1px solid var(--color-border);
  padding: var(--space-2);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-muted);
  white-space: nowrap;
}
.tt-period-time {
  display: block;
  font-weight: 400;
  text-transform: none;
  font-variant-numeric: tabular-nums;
  margin-top: 2px;
}
.tt-grid td {
  border: 1px solid var(--color-border);
  padding: var(--space-1);
  vertical-align: top;
  min-width: 7.5rem;
}
.tt-day-label {
  background: var(--color-muted-bg);
  font-weight: 700;
  white-space: nowrap;
  vertical-align: middle !important;
  padding: var(--space-2) var(--space-3) !important;
}
.tt-cell {
  background: var(--color-status-info-tint);
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.55rem;
  font-size: var(--font-size-sm);
}
.tt-cell b {
  display: block;
  font-weight: 700;
}
.tt-cell span {
  display: block;
  color: var(--color-muted);
  font-size: var(--font-size-xs);
  margin-top: 2px;
}
.tt-empty {
  text-align: center;
  color: var(--color-muted);
}
</style>
