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

// Sunday (JS getDay() 0) isn't a working day in DAY_OPTIONS, so it simply matches no row.
const todayDayOfWeek = new Date().getDay();
const todayLabel = computed(() => DAY_OPTIONS.find((d) => d.value === todayDayOfWeek)?.label ?? null);
</script>

<template>
  <div class="teacher-timetable">
    <div class="page-header">
      <div>
        <h1>My Timetable</h1>
      </div>
      <div v-if="todayLabel" class="today-badge">
        <span class="today-dot"></span>
        Today · {{ todayLabel }}
      </div>
    </div>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
    <p v-else-if="!sortedEntries.length" class="empty">No periods scheduled for you yet.</p>

    <div v-else class="tt-grid-wrap">
      <table class="tt-grid" data-testid="teacher-timetable-grid">
        <thead>
          <tr>
            <th class="tt-day-col">Day</th>
            <th v-for="p in periods" :key="p" class="tt-period-col">
              P{{ p }}
              <span class="tt-period-time mono">{{ periodTimeLabel(p) }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in DAY_OPTIONS" :key="d.value" :class="{ 'tt-today-row': d.value === todayDayOfWeek }">
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
  max-width: 1180px;
}
.page-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}
.page-header h1 {
  margin: 0;
}
.today-badge {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--color-muted);
}
.today-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-accent);
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
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
}
.tt-grid {
  border-collapse: separate;
  border-spacing: 0;
  min-width: 640px;
  width: 100%;
}
.tt-grid th {
  background: var(--color-background);
  border-bottom: 1px solid var(--color-border);
  padding: var(--space-3) var(--space-2);
  font-size: var(--font-size-2xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-muted);
  text-align: left;
  white-space: nowrap;
}
.tt-period-time {
  display: block;
  font-weight: 400;
  text-transform: none;
  letter-spacing: normal;
  color: var(--color-muted);
  margin-top: 2px;
}
.tt-grid td {
  border-bottom: 1px solid var(--color-border);
  padding: var(--space-2);
  vertical-align: top;
  min-width: 7.5rem;
}
.tt-grid tbody tr:last-child td {
  border-bottom: none;
}
.tt-day-label {
  background: var(--color-background);
  font-weight: 700;
  white-space: nowrap;
  vertical-align: middle !important;
  padding: var(--space-2) var(--space-3) !important;
}
.tt-today-row {
  background: var(--color-status-info-tint);
}
.tt-today-row .tt-day-label {
  background: var(--color-status-info-tint);
  color: var(--color-accent);
  border-left: 3px solid var(--color-accent);
}
.tt-cell {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.55rem;
  font-size: var(--font-size-sm);
}
.tt-today-row .tt-cell {
  border-color: var(--color-accent);
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
  color: var(--color-border);
}
</style>
