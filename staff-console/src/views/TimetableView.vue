<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import {
  api,
  type SectionSummary,
  type SubjectSummary,
  type TeacherSummary,
  type TimetableEntrySummary,
  type TimetableEntryInput,
} from '../lib/api';

const DAY_OPTIONS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];
const DAY_LABELS: Record<number, string> = Object.fromEntries(DAY_OPTIONS.map((d) => [d.value, d.label]));

interface EntryForm {
  subjectId: string;
  teacherId: string;
  dayOfWeek: number;
  period: number;
  startTime: string;
  endTime: string;
  room: string;
}

function blankForm(): EntryForm {
  return { subjectId: '', teacherId: '', dayOfWeek: 1, period: 1, startTime: '', endTime: '', room: '' };
}

const auth = useAuthStore();

const sections = ref<SectionSummary[]>([]);
const subjects = ref<SubjectSummary[]>([]);
const teachers = ref<TeacherSummary[]>([]);
const selectedSectionId = ref('');
const entries = ref<TimetableEntrySummary[]>([]);

const addForm = ref<EntryForm>(blankForm());
const editingId = ref<string | null>(null);
const editForm = ref<EntryForm>(blankForm());

const isSaving = ref(false);
const message = ref<string | null>(null);
const errorMessage = ref<string | null>(null);

async function loadLookups() {
  if (!auth.accessToken) return;
  try {
    [sections.value, subjects.value, teachers.value] = await Promise.all([
      api.listSections(auth.accessToken),
      api.listSubjects(auth.accessToken),
      api.listTeachers(auth.accessToken),
    ]);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load sections/subjects/teachers.';
  }
}
loadLookups();

const sortedEntries = computed(() =>
  [...entries.value].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.period - b.period),
);

async function reloadEntries() {
  if (!selectedSectionId.value || !auth.accessToken) return;
  try {
    entries.value = await api.sectionTimetable(auth.accessToken, selectedSectionId.value);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load the timetable.';
  }
}

async function onSectionChange() {
  message.value = null;
  errorMessage.value = null;
  entries.value = [];
  editingId.value = null;
  await reloadEntries();
}

function isFormValid(form: EntryForm): boolean {
  return Boolean(form.subjectId && form.startTime && form.endTime && form.period >= 1);
}

async function onAdd() {
  if (!auth.accessToken || !selectedSectionId.value || !isFormValid(addForm.value)) return;
  message.value = null;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createTimetableEntry(auth.accessToken, {
      sectionId: selectedSectionId.value,
      subjectId: addForm.value.subjectId,
      teacherId: addForm.value.teacherId || undefined,
      dayOfWeek: addForm.value.dayOfWeek,
      period: addForm.value.period,
      startTime: addForm.value.startTime,
      endTime: addForm.value.endTime,
      room: addForm.value.room || undefined,
    });
    addForm.value = blankForm();
    message.value = 'Period added.';
    await reloadEntries();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not add this period.';
  } finally {
    isSaving.value = false;
  }
}

function startEdit(entry: TimetableEntrySummary) {
  editingId.value = entry.id;
  editForm.value = {
    subjectId: subjects.value.find((s) => s.name === entry.subject)?.id ?? '',
    teacherId: teachers.value.find((t) => t.name === entry.teacher)?.id ?? '',
    dayOfWeek: entry.dayOfWeek,
    period: entry.period,
    startTime: entry.startTime,
    endTime: entry.endTime,
    room: entry.room ?? '',
  };
}

function cancelEdit() {
  editingId.value = null;
}

async function onSaveEdit(id: string) {
  if (!auth.accessToken || !isFormValid(editForm.value)) return;
  message.value = null;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.updateTimetableEntry(auth.accessToken, id, {
      subjectId: editForm.value.subjectId,
      teacherId: editForm.value.teacherId || undefined,
      dayOfWeek: editForm.value.dayOfWeek,
      period: editForm.value.period,
      startTime: editForm.value.startTime,
      endTime: editForm.value.endTime,
      room: editForm.value.room || undefined,
    });
    editingId.value = null;
    message.value = 'Period updated.';
    await reloadEntries();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this period.';
  } finally {
    isSaving.value = false;
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  message.value = null;
  errorMessage.value = null;
  try {
    await api.deleteTimetableEntry(auth.accessToken, id);
    message.value = 'Period removed.';
    await reloadEntries();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not remove this period.';
  }
}

// --- Grid composer: bulk-define a section's whole week at once, instead of one Add per period ---

interface GridCell {
  subjectId: string;
  teacherId: string;
}

interface PeriodTime {
  startTime: string;
  endTime: string;
}

type GridColumn = { type: 'period'; period: number } | { type: 'break'; afterPeriod: number };

const isBulkMode = ref(false);
const bulkDays = ref<number[]>([1, 2, 3, 4, 5, 6]);
const bulkPeriodCount = ref(6);
const defaultRoom = ref('');
// Week-default times, per period — used by every day EXCEPT ones in customDays.
const periodTimes = ref<PeriodTime[]>([]);
// Per-day overrides, keyed "${period}-${day}" — only read for days in customDays. Lets a day
// like Friday run a shorter schedule (earlier finish, different break lengths) without changing
// every other day.
const dayPeriodTimes = ref<Record<string, PeriodTime>>({});
const customDays = ref<Set<number>>(new Set());
const grid = ref<Record<string, GridCell>>({});

const orderedDayOptions = DAY_OPTIONS.filter((d) => d.value !== 0).concat(
  DAY_OPTIONS.filter((d) => d.value === 0),
); // Mon..Sat, then Sun last — matches the school week, not JS's Sun-first Date.getDay() order

const visibleDayOptions = computed(() => orderedDayOptions.filter((d) => bulkDays.value.includes(d.value)));
const periodsRange = computed(() => Array.from({ length: bulkPeriodCount.value }, (_, i) => i + 1));

// Interleaves a "break" column after every period except the last, so the gap between two
// periods is a real, visible cell instead of something an admin has to infer from two time
// inputs — matches how the parent app's own Calendar tab already auto-detects break columns.
const gridColumns = computed<GridColumn[]>(() => {
  const cols: GridColumn[] = [];
  for (let period = 1; period <= bulkPeriodCount.value; period++) {
    cols.push({ type: 'period', period });
    if (period < bulkPeriodCount.value) cols.push({ type: 'break', afterPeriod: period });
  }
  return cols;
});

function columnKey(col: GridColumn): string {
  return col.type === 'period' ? `p${col.period}` : `b${col.afterPeriod}`;
}

function cellKey(period: number, day: number): string {
  return `${period}-${day}`;
}

function cell(period: number, day: number): GridCell {
  const key = cellKey(period, day);
  return grid.value[key] ?? { subjectId: '', teacherId: '' };
}

function periodTime(period: number): PeriodTime {
  return periodTimes.value[period - 1] ?? { startTime: '', endTime: '' };
}

function dayPeriodTime(period: number, day: number): PeriodTime {
  return dayPeriodTimes.value[cellKey(period, day)] ?? { startTime: '', endTime: '' };
}

function isCustomDay(day: number): boolean {
  return customDays.value.has(day);
}

// The time that actually applies to this (period, day): the day's own override if it's opted
// into custom times, otherwise the week's shared default.
function effectiveTime(period: number, day: number): PeriodTime {
  return isCustomDay(day) ? dayPeriodTime(period, day) : periodTime(period);
}

function minutesBetween(startTime: string, endTime: string): number | null {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => n === undefined || Number.isNaN(n))) return null;
  return eh! * 60 + em! - (sh! * 60 + sm!);
}

// Read-only — shown so a break's length is visible at a glance; adjust it by editing the
// adjacent periods' end/start times (the shared ones, or that day's own custom ones).
function breakLabel(afterPeriod: number, day: number): string {
  const end = effectiveTime(afterPeriod, day).endTime;
  const start = effectiveTime(afterPeriod + 1, day).startTime;
  if (!end || !start) return '—';
  const mins = minutesBetween(end, start);
  if (mins === null) return '—';
  if (mins <= 0) return 'No gap';
  return `${mins} min`;
}

function toggleCustomDay(day: number) {
  const next = new Set(customDays.value);
  if (next.has(day)) {
    next.delete(day);
  } else {
    next.add(day);
    // Seed this day's overrides from the CURRENT shared defaults, so the admin only has to
    // change what's actually different (Friday's early finish) instead of re-entering every
    // period's time from scratch.
    for (let period = 1; period <= bulkPeriodCount.value; period++) {
      dayPeriodTimes.value[cellKey(period, day)] = { ...periodTime(period) };
    }
  }
  customDays.value = next;
}

function regenerateGrid() {
  const newGrid: Record<string, GridCell> = {};
  for (let period = 1; period <= bulkPeriodCount.value; period++) {
    for (const day of bulkDays.value) {
      const key = cellKey(period, day);
      newGrid[key] = grid.value[key] ?? { subjectId: '', teacherId: '' };
    }
  }
  grid.value = newGrid;

  const newTimes: PeriodTime[] = [];
  for (let period = 1; period <= bulkPeriodCount.value; period++) {
    newTimes.push(periodTimes.value[period - 1] ?? { startTime: '', endTime: '' });
  }
  periodTimes.value = newTimes;

  // Prune per-day overrides for periods/days no longer in range, so a later period-count
  // increase doesn't resurrect stale times from an earlier, unrelated edit.
  const prunedDayTimes: Record<string, PeriodTime> = {};
  for (const day of bulkDays.value) {
    for (let period = 1; period <= bulkPeriodCount.value; period++) {
      const key = cellKey(period, day);
      if (dayPeriodTimes.value[key]) prunedDayTimes[key] = dayPeriodTimes.value[key];
    }
  }
  dayPeriodTimes.value = prunedDayTimes;
}

// A native number input only fires 'change' on blur, not on every keystroke or spinner click —
// watching the value directly (rather than binding regenerateGrid to @change) means the grid
// resizes the moment bulkPeriodCount actually changes, regardless of which DOM event got there.
watch(bulkPeriodCount, regenerateGrid);

function toggleBulkDay(day: number) {
  bulkDays.value = bulkDays.value.includes(day)
    ? bulkDays.value.filter((d) => d !== day)
    : [...bulkDays.value, day];
  regenerateGrid();
}

function openBulkComposer() {
  message.value = null;
  errorMessage.value = null;
  customDays.value = new Set();
  dayPeriodTimes.value = {};

  if (entries.value.length) {
    // Pre-fill from what's already scheduled — "Save" then reviews-and-replaces rather than
    // blindly discarding the existing timetable the admin can't currently see in this view.
    const usedPeriods = entries.value.map((e) => e.period);
    const usedDays = [...new Set(entries.value.map((e) => e.dayOfWeek))];
    bulkPeriodCount.value = Math.max(...usedPeriods, 1);
    bulkDays.value = orderedDayOptions.filter((d) => usedDays.includes(d.value)).map((d) => d.value);
    defaultRoom.value = entries.value[0]?.room ?? '';
    regenerateGrid();

    // The first day seen for each period sets the shared default; any later day whose time for
    // that same period disagrees gets flagged custom, so a day that already had different times
    // (e.g. an existing shorter Friday) isn't silently collapsed into the majority's schedule.
    const seenDefault = new Set<number>();
    const newCustomDays = new Set<number>();
    for (const e of entries.value) {
      grid.value[cellKey(e.period, e.dayOfWeek)] = {
        subjectId: subjects.value.find((s) => s.name === e.subject)?.id ?? '',
        teacherId: teachers.value.find((t) => t.name === e.teacher)?.id ?? '',
      };
      const idx = e.period - 1;
      if (!seenDefault.has(e.period)) {
        periodTimes.value[idx] = { startTime: e.startTime, endTime: e.endTime };
        seenDefault.add(e.period);
      } else {
        const shared = periodTimes.value[idx];
        if (shared && (shared.startTime !== e.startTime || shared.endTime !== e.endTime)) {
          newCustomDays.add(e.dayOfWeek);
        }
      }
    }
    customDays.value = newCustomDays;
    for (const day of newCustomDays) {
      for (let period = 1; period <= bulkPeriodCount.value; period++) {
        const match = entries.value.find((e) => e.dayOfWeek === day && e.period === period);
        dayPeriodTimes.value[cellKey(period, day)] = match
          ? { startTime: match.startTime, endTime: match.endTime }
          : { ...periodTime(period) };
      }
    }
  } else {
    bulkPeriodCount.value = 6;
    bulkDays.value = [1, 2, 3, 4, 5, 6];
    defaultRoom.value = '';
    regenerateGrid();
  }
  isBulkMode.value = true;
}

function cancelBulk() {
  isBulkMode.value = false;
}

const filledCellCount = computed(() => {
  let count = 0;
  for (let period = 1; period <= bulkPeriodCount.value; period++) {
    for (const day of bulkDays.value) {
      if (grid.value[cellKey(period, day)]?.subjectId) count++;
    }
  }
  return count;
});

// Every period that has at least one filled cell needs its effective start/end time set (shared
// default, or that day's own custom time) — a period with zero filled cells needs neither.
function isBulkValid(): boolean {
  if (bulkDays.value.length === 0 || bulkPeriodCount.value < 1) return false;
  for (const day of bulkDays.value) {
    for (let period = 1; period <= bulkPeriodCount.value; period++) {
      if (!grid.value[cellKey(period, day)]?.subjectId) continue;
      const times = effectiveTime(period, day);
      if (!times.startTime || !times.endTime) return false;
    }
  }
  return true;
}

async function onSaveBulk() {
  if (!auth.accessToken || !selectedSectionId.value || !isBulkValid()) return;
  message.value = null;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    const bulkEntries: TimetableEntryInput[] = [];
    for (const day of bulkDays.value) {
      for (let period = 1; period <= bulkPeriodCount.value; period++) {
        const c = grid.value[cellKey(period, day)];
        if (!c?.subjectId) continue;
        const times = effectiveTime(period, day);
        if (!times.startTime || !times.endTime) continue;
        bulkEntries.push({
          subjectId: c.subjectId,
          teacherId: c.teacherId || undefined,
          dayOfWeek: day,
          period,
          startTime: times.startTime,
          endTime: times.endTime,
          room: defaultRoom.value || undefined,
        });
      }
    }
    await api.replaceSectionTimetable(auth.accessToken, selectedSectionId.value, bulkEntries);
    isBulkMode.value = false;
    message.value = `Timetable saved (${bulkEntries.length} period${bulkEntries.length === 1 ? '' : 's'}).`;
    await reloadEntries();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not save the timetable.';
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="timetable">
    <h1>Timetable</h1>

    <div class="header-row">
      <label class="field">
        <span>Section</span>
        <select data-testid="section-select" v-model="selectedSectionId" @change="onSectionChange">
          <option value="" disabled>Choose a section</option>
          <option v-for="s in sections" :key="s.id" :value="s.id">
            {{ s.className }} {{ s.name }} — {{ s.campusName }}
          </option>
        </select>
      </label>
      <button
        v-if="selectedSectionId && !isBulkMode"
        type="button"
        data-testid="open-bulk"
        class="bulk-toggle"
        @click="openBulkComposer"
      >
        Bulk edit (grid)
      </button>
    </div>

    <p v-if="message" class="success" data-testid="success">{{ message }}</p>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <template v-if="selectedSectionId && isBulkMode">
      <div class="bulk-config">
        <label class="field">
          <span>Periods per day</span>
          <input
            type="number"
            min="1"
            max="12"
            v-model.number="bulkPeriodCount"
            data-testid="bulk-period-count"
          />
        </label>
        <label class="field">
          <span>Default room</span>
          <input v-model="defaultRoom" data-testid="bulk-default-room" placeholder="Room" />
        </label>
        <fieldset class="bulk-days">
          <legend>Working days</legend>
          <label v-for="d in orderedDayOptions" :key="d.value" class="day-checkbox">
            <input
              type="checkbox"
              :checked="bulkDays.includes(d.value)"
              :data-testid="`bulk-day-${d.value}`"
              @change="toggleBulkDay(d.value)"
            />
            {{ d.label.slice(0, 3) }}
          </label>
        </fieldset>
      </div>

      <p v-if="entries.length" class="bulk-note">
        Pre-filled from this section's existing timetable — saving replaces it entirely.
      </p>

      <div class="grid-scroll">
        <table class="bulk-grid" data-testid="bulk-grid">
          <thead>
            <tr>
              <th>Day</th>
              <template v-for="col in gridColumns" :key="columnKey(col)">
                <th v-if="col.type === 'period'" class="period-header">
                  <div class="period-label">Period {{ col.period }}</div>
                  <div class="time-cell">
                    <input
                      type="time"
                      v-model="periodTime(col.period).startTime"
                      :data-testid="`bulk-start-${col.period}`"
                    />
                    <input
                      type="time"
                      v-model="periodTime(col.period).endTime"
                      :data-testid="`bulk-end-${col.period}`"
                    />
                  </div>
                </th>
                <th v-else class="break-header">Break</th>
              </template>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in visibleDayOptions" :key="d.value">
              <td class="day-label">
                {{ d.label }}
                <label class="custom-toggle">
                  <input
                    type="checkbox"
                    :checked="isCustomDay(d.value)"
                    :data-testid="`bulk-custom-${d.value}`"
                    @change="toggleCustomDay(d.value)"
                  />
                  Custom times
                </label>
              </td>
              <template v-for="col in gridColumns" :key="columnKey(col)">
                <td v-if="col.type === 'period'" class="grid-cell-td">
                  <div class="grid-cell">
                    <div v-if="isCustomDay(d.value)" class="time-cell time-cell-compact">
                      <input
                        type="time"
                        v-model="dayPeriodTime(col.period, d.value).startTime"
                        :data-testid="`bulk-day-start-${col.period}-${d.value}`"
                      />
                      <input
                        type="time"
                        v-model="dayPeriodTime(col.period, d.value).endTime"
                        :data-testid="`bulk-day-end-${col.period}-${d.value}`"
                      />
                    </div>
                    <select
                      v-model="cell(col.period, d.value).subjectId"
                      :data-testid="`bulk-subject-${col.period}-${d.value}`"
                    >
                      <option value="">—</option>
                      <option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.name }}</option>
                    </select>
                    <select
                      v-model="cell(col.period, d.value).teacherId"
                      :data-testid="`bulk-teacher-${col.period}-${d.value}`"
                    >
                      <option value="">(no teacher)</option>
                      <option v-for="t in teachers" :key="t.id" :value="t.id">{{ t.name }}</option>
                    </select>
                  </div>
                </td>
                <td v-else class="break-cell" :data-testid="`bulk-break-${col.afterPeriod}-${d.value}`">
                  {{ breakLabel(col.afterPeriod, d.value) }}
                </td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="bulk-actions">
        <button
          type="button"
          data-testid="save-bulk"
          :disabled="isSaving || !isBulkValid()"
          @click="onSaveBulk"
        >
          {{ isSaving ? 'Saving…' : `Save Timetable (${filledCellCount} period${filledCellCount === 1 ? '' : 's'})` }}
        </button>
        <button type="button" data-testid="cancel-bulk" @click="cancelBulk">Cancel</button>
      </div>
    </template>

    <template v-else-if="selectedSectionId">
      <table v-if="sortedEntries.length" class="entries" data-testid="entries-table">
        <thead>
          <tr>
            <th>Day</th>
            <th>Period</th>
            <th>Time</th>
            <th>Subject</th>
            <th>Teacher</th>
            <th>Room</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in sortedEntries" :key="entry.id" :data-testid="`entry-${entry.id}`">
            <template v-if="editingId === entry.id">
              <td colspan="7">
                <div class="edit-row">
                  <select v-model.number="editForm.dayOfWeek" :data-testid="`edit-day-${entry.id}`">
                    <option v-for="d in DAY_OPTIONS" :key="d.value" :value="d.value">{{ d.label }}</option>
                  </select>
                  <input
                    type="number"
                    min="1"
                    v-model.number="editForm.period"
                    :data-testid="`edit-period-${entry.id}`"
                    placeholder="Period"
                  />
                  <input type="time" v-model="editForm.startTime" :data-testid="`edit-start-${entry.id}`" />
                  <input type="time" v-model="editForm.endTime" :data-testid="`edit-end-${entry.id}`" />
                  <select v-model="editForm.subjectId" :data-testid="`edit-subject-${entry.id}`">
                    <option value="" disabled>Subject</option>
                    <option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.name }}</option>
                  </select>
                  <select v-model="editForm.teacherId" :data-testid="`edit-teacher-${entry.id}`">
                    <option value="">(no teacher)</option>
                    <option v-for="t in teachers" :key="t.id" :value="t.id">{{ t.name }}</option>
                  </select>
                  <input v-model="editForm.room" :data-testid="`edit-room-${entry.id}`" placeholder="Room" />
                  <button
                    type="button"
                    :disabled="isSaving || !isFormValid(editForm)"
                    :data-testid="`save-edit-${entry.id}`"
                    @click="onSaveEdit(entry.id)"
                  >
                    Save
                  </button>
                  <button type="button" :data-testid="`cancel-edit-${entry.id}`" @click="cancelEdit">
                    Cancel
                  </button>
                </div>
              </td>
            </template>
            <template v-else>
              <td>{{ DAY_LABELS[entry.dayOfWeek] }}</td>
              <td>{{ entry.period }}</td>
              <td>{{ entry.startTime }}–{{ entry.endTime }}</td>
              <td>{{ entry.subject }}</td>
              <td>{{ entry.teacher ?? '—' }}</td>
              <td>{{ entry.room ?? '—' }}</td>
              <td class="row-actions">
                <button type="button" :data-testid="`edit-${entry.id}`" @click="startEdit(entry)">Edit</button>
                <button type="button" :data-testid="`delete-${entry.id}`" @click="onDelete(entry.id)">
                  Delete
                </button>
              </td>
            </template>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">No periods scheduled for this section yet.</p>

      <div class="add-form">
        <h2>Add a period</h2>
        <div class="add-row">
          <select v-model.number="addForm.dayOfWeek" data-testid="add-day">
            <option v-for="d in DAY_OPTIONS" :key="d.value" :value="d.value">{{ d.label }}</option>
          </select>
          <input type="number" min="1" v-model.number="addForm.period" data-testid="add-period" placeholder="Period" />
          <input type="time" v-model="addForm.startTime" data-testid="add-start" />
          <input type="time" v-model="addForm.endTime" data-testid="add-end" />
          <select v-model="addForm.subjectId" data-testid="add-subject">
            <option value="" disabled>Subject</option>
            <option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
          <select v-model="addForm.teacherId" data-testid="add-teacher">
            <option value="">(no teacher)</option>
            <option v-for="t in teachers" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
          <input v-model="addForm.room" data-testid="add-room" placeholder="Room" />
          <button
            type="button"
            data-testid="add-submit"
            :disabled="isSaving || !isFormValid(addForm)"
            @click="onAdd"
          >
            {{ isSaving ? 'Saving…' : 'Add' }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.timetable {
  max-width: 960px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-4);
  max-width: 320px;
}
select,
input {
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: var(--font-size-sm);
}
.entries {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: var(--space-4);
}
.entries th,
.entries td {
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  font-size: var(--font-size-sm);
}
.row-actions {
  display: flex;
  gap: var(--space-2);
}
.row-actions button {
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  cursor: pointer;
  font-size: var(--font-size-xs);
}
.edit-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  padding: var(--space-2) 0;
}
.add-form h2 {
  font-size: var(--font-size-base);
  margin-bottom: var(--space-2);
}
.add-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}
.add-row button,
.edit-row button:not([data-testid^='cancel']) {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-on-primary);
  font-weight: 700;
  cursor: pointer;
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.success {
  color: var(--color-accent);
  margin-bottom: var(--space-3);
}
.error {
  color: var(--color-destructive);
  margin-bottom: var(--space-3);
}
.empty {
  color: var(--color-muted);
  margin-bottom: var(--space-4);
}

.header-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
  max-width: 100%;
}
.bulk-toggle {
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-weight: 600;
  cursor: pointer;
  margin-bottom: var(--space-4);
}
.bulk-config {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  align-items: flex-start;
  margin-bottom: var(--space-3);
}
.bulk-days {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  display: flex;
  gap: var(--space-2);
}
.bulk-days legend {
  font-size: var(--font-size-sm);
  padding: 0 0.3rem;
}
.day-checkbox {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  font-size: var(--font-size-sm);
}
.bulk-note {
  color: var(--color-muted);
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-3);
}
.grid-scroll {
  overflow-x: auto;
  margin-bottom: var(--space-4);
}
.bulk-grid {
  border-collapse: collapse;
}
.bulk-grid th,
.bulk-grid td {
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  text-align: left;
  font-size: var(--font-size-sm);
  vertical-align: top;
}
.day-label {
  font-weight: 600;
  white-space: nowrap;
  vertical-align: middle;
}
.custom-toggle {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.4rem;
  font-weight: 400;
  font-size: var(--font-size-xs);
  color: var(--color-muted);
  cursor: pointer;
}
.period-header {
  font-weight: 600;
}
.period-label {
  margin-bottom: 0.3rem;
  white-space: nowrap;
}
.time-cell {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-weight: 400;
}
.time-cell-compact {
  margin-bottom: 0.3rem;
  padding-bottom: 0.3rem;
  border-bottom: 1px dashed var(--color-border);
}
.grid-cell-td {
  min-width: 9.5rem;
}
.grid-cell {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.grid-cell select,
.time-cell input {
  width: 100%;
}
.break-header {
  font-weight: 600;
  color: var(--color-muted);
  font-size: var(--font-size-xs);
  text-align: center;
  white-space: nowrap;
}
.break-cell {
  color: var(--color-muted);
  font-size: var(--font-size-xs);
  text-align: center;
  white-space: nowrap;
  background: var(--color-muted-bg, #f5f5f5);
}
.bulk-actions {
  display: flex;
  gap: var(--space-2);
}
.bulk-actions button[data-testid='save-bulk'] {
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-on-primary);
  font-weight: 700;
  cursor: pointer;
}
.bulk-actions button[data-testid='cancel-bulk'] {
  padding: 0.6rem 1.2rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  cursor: pointer;
}
</style>
