<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import {
  api,
  type SectionSummary,
  type SubjectSummary,
  type TeacherSummary,
  type TimetableEntrySummary,
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
</script>

<template>
  <div class="timetable">
    <h1>Timetable</h1>

    <label class="field">
      <span>Section</span>
      <select data-testid="section-select" v-model="selectedSectionId" @change="onSectionChange">
        <option value="" disabled>Choose a section</option>
        <option v-for="s in sections" :key="s.id" :value="s.id">
          {{ s.className }} {{ s.name }} — {{ s.campusName }}
        </option>
      </select>
    </label>

    <p v-if="message" class="success" data-testid="success">{{ message }}</p>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <template v-if="selectedSectionId">
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
</style>
