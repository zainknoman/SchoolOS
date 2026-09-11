<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type SectionSummary, type StudentSummary, type AttendanceStatus } from '../lib/api';
import { initialsFromName } from '../lib/format';

const auth = useAuthStore();
const today = new Date().toISOString().slice(0, 10);

const sections = ref<SectionSummary[]>([]);
const selectedSectionId = ref('');
const students = ref<StudentSummary[]>([]);
const statuses = ref<Record<string, AttendanceStatus | ''>>({});
const isSaving = ref(false);
const message = ref<string | null>(null);
const errorMessage = ref<string | null>(null);
const openOverflowFor = ref<string | null>(null);

async function loadSections() {
  if (!auth.accessToken) return;
  try {
    sections.value = await api.listSections(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load sections.';
  }
}
loadSections();

async function onSectionChange() {
  message.value = null;
  errorMessage.value = null;
  students.value = [];
  statuses.value = {};
  if (!selectedSectionId.value || !auth.accessToken) return;
  try {
    students.value = await api.sectionStudents(auth.accessToken, selectedSectionId.value);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load students.';
    return;
  }
  try {
    // Best-effort: if this fails, the roster still loaded — the teacher just starts from blank
    // instead of pre-filled, same as before this pre-fill existed.
    const alreadyMarked = await api.sectionAttendance(auth.accessToken, selectedSectionId.value, today);
    statuses.value = { ...alreadyMarked };
  } catch {
    // Convenience only — see comment above.
  }
}

function setStatus(studentId: string, status: AttendanceStatus) {
  statuses.value[studentId] = status;
  openOverflowFor.value = null;
}

function toggleOverflow(studentId: string) {
  openOverflowFor.value = openOverflowFor.value === studentId ? null : studentId;
}

function markAllPresent() {
  for (const student of students.value) {
    statuses.value[student.id] = 'PRESENT';
  }
}

const presentCount = computed(
  () => Object.values(statuses.value).filter((s) => s === 'PRESENT').length,
);
const absentCount = computed(
  () => Object.values(statuses.value).filter((s) => s === 'ABSENT').length,
);
const assignedCount = computed(
  () => Object.values(statuses.value).filter((s) => s !== '').length,
);

async function onSave() {
  if (!auth.accessToken) return;
  message.value = null;
  errorMessage.value = null;
  isSaving.value = true;

  try {
    const entries = Object.entries(statuses.value).filter(([, status]) => status !== '');
    await api.markAttendanceBulk(auth.accessToken, {
      date: today,
      marks: entries.map(([studentId, status]) => ({ studentId, status: status as AttendanceStatus })),
    });
    message.value = `Saved attendance for ${entries.length} student(s).`;
  } catch (err) {
    // A 400 here is most often the new Holiday guard rejecting the whole batch — surface its
    // real message (e.g. "Cannot mark attendance on a declared holiday") instead of a generic one.
    errorMessage.value = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="attendance">
    <h1>Attendance</h1>
    <p class="subtitle">{{ today }}</p>

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
      v-if="students.length"
      type="button"
      data-testid="default-all-present"
      class="default-all"
      @click="markAllPresent"
    >
      Default all present
    </button>

    <ul v-if="students.length" class="roster">
      <li v-for="(student, i) in students" :key="student.id" class="roster-row">
        <div class="roster-student">
          <span class="roster-index">{{ i + 1 }}</span>
          <span class="roster-avatar">{{ initialsFromName(student.name) }}</span>
          <span class="roster-name">{{ student.name }}</span>
        </div>

        <div class="status-group">
          <div class="segmented">
            <button
              type="button"
              :data-testid="`status-${student.id}-present`"
              class="segment segment-present"
              :class="{ active: statuses[student.id] === 'PRESENT' }"
              @click="setStatus(student.id, 'PRESENT')"
            >
              P
            </button>
            <button
              type="button"
              :data-testid="`status-${student.id}-absent`"
              class="segment segment-absent"
              :class="{ active: statuses[student.id] === 'ABSENT' }"
              @click="setStatus(student.id, 'ABSENT')"
            >
              A
            </button>
            <button
              type="button"
              :data-testid="`status-${student.id}-late`"
              class="segment segment-late"
              :class="{ active: statuses[student.id] === 'LATE' }"
              @click="setStatus(student.id, 'LATE')"
            >
              L
            </button>
          </div>
          <div class="overflow">
            <button
              type="button"
              :data-testid="`status-${student.id}-more`"
              class="overflow-trigger"
              aria-haspopup="true"
              :aria-expanded="openOverflowFor === student.id"
              @click="toggleOverflow(student.id)"
            >
              …
            </button>
            <div v-if="openOverflowFor === student.id" class="overflow-menu">
              <button
                type="button"
                :data-testid="`status-${student.id}-leave`"
                @click="setStatus(student.id, 'LEAVE')"
              >
                Leave
              </button>
              <button
                type="button"
                :data-testid="`status-${student.id}-holiday`"
                @click="setStatus(student.id, 'HOLIDAY')"
              >
                Holiday
              </button>
            </div>
          </div>
        </div>
      </li>
    </ul>

    <p v-if="message" class="success" data-testid="success">{{ message }}</p>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <footer v-if="students.length" class="summary-bar">
      <div class="summary-counts">
        <span><strong>{{ presentCount }}</strong> Present</span>
        <span><strong>{{ absentCount }}</strong> Absent</span>
        <span><strong>{{ students.length }}</strong> Total</span>
      </div>
      <button data-testid="save-attendance" :disabled="isSaving" @click="onSave">
        {{ isSaving ? 'Saving…' : `Submit Attendance (${assignedCount}/${students.length})` }}
      </button>
    </footer>
  </div>
</template>

<style scoped>
.attendance {
  max-width: 640px;
}
.subtitle {
  color: var(--color-muted);
  margin-bottom: var(--space-4);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-3);
  max-width: 320px;
}
select {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
}

.default-all {
  display: block;
  width: 100%;
  margin-bottom: var(--space-4);
  padding: 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-muted-bg);
  color: var(--color-primary);
  font-weight: 600;
  cursor: pointer;
}

.roster {
  list-style: none;
  margin-bottom: var(--space-4);
  border-top: 1px solid var(--color-border);
}
.roster-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}
.roster-student {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}
.roster-index {
  color: var(--color-muted);
  font-size: var(--font-size-sm);
  width: 1.2rem;
}
.roster-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 50%;
  background: var(--color-muted-bg);
  color: var(--color-primary);
  font-size: var(--font-size-xs);
  font-weight: 700;
  flex-shrink: 0;
}
.roster-name {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}
.segmented {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.segment {
  min-width: 2.5rem;
  padding: 0.4rem 0;
  border: none;
  border-left: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-muted);
  font-weight: 600;
  font-size: var(--font-size-sm);
  cursor: pointer;
}
.segment:first-child {
  border-left: none;
}
.segment-present.active {
  background: var(--color-present);
  color: var(--color-on-primary);
}
.segment-absent.active {
  background: var(--color-destructive);
  color: var(--color-on-primary);
}
.segment-late.active {
  background: var(--color-late);
  color: var(--color-on-primary);
}

.overflow {
  position: relative;
}
.overflow-trigger {
  border: none;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  font-size: var(--font-size-base);
  padding: 0.2rem 0.4rem;
}
.overflow-menu {
  position: absolute;
  right: 0;
  top: 100%;
  z-index: 1;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
  display: flex;
  flex-direction: column;
  min-width: 6rem;
}
.overflow-menu button {
  border: none;
  background: transparent;
  text-align: left;
  padding: 0.5rem 0.7rem;
  font: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
}
.overflow-menu button:hover {
  background: var(--color-muted-bg);
}

.success {
  color: var(--color-accent);
  margin-bottom: var(--space-3);
}
.error {
  color: var(--color-destructive);
  margin-bottom: var(--space-3);
}

.summary-bar {
  position: sticky;
  bottom: 0;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  padding: var(--space-3) 0;
}
.summary-counts {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--color-muted);
}
.summary-bar button {
  width: 100%;
  padding: 0.8rem;
  border: none;
  border-radius: var(--radius);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-weight: 700;
  cursor: pointer;
}
.summary-bar button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
