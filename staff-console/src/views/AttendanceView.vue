<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type SectionSummary, type StudentSummary, type AttendanceStatus } from '../lib/api';
import { initialsFromName } from '../lib/format';
import Icon from '../components/AppIcon.vue';

const auth = useAuthStore();
const now = new Date();
const today = now.toISOString().slice(0, 10);
// Formatted from `now` directly, not by re-parsing `today` — that ISO string is UTC-sliced, so
// re-parsing it can roll back a calendar day in negative-UTC-offset timezones near midnight.
const todayDisplay = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(now);

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

function focusAdjacentSegment(studentId: string, currentStatus: 'PRESENT' | 'ABSENT' | 'LATE', direction: 1 | -1) {
  const order: ('PRESENT' | 'ABSENT' | 'LATE')[] = ['PRESENT', 'ABSENT', 'LATE'];
  const nextIndex = (order.indexOf(currentStatus) + direction + order.length) % order.length;
  const next = order[nextIndex]!;
  setStatus(studentId, next);
  const selector = `[data-testid="status-${studentId}-${next.toLowerCase()}"]`;
  (document.querySelector(selector) as HTMLElement | null)?.focus();
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
const progressPercent = computed(() =>
  students.value.length ? Math.round((assignedCount.value / students.value.length) * 100) : 0,
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
    <div class="page-header">
      <div>
        <h1>Attendance</h1>
        <div class="subtitle"><Icon name="calendar" :size="15" /> {{ todayDisplay }}</div>
      </div>

      <label class="field">
        <span>Section</span>
        <select data-testid="section-select" v-model="selectedSectionId" @change="onSectionChange">
          <option value="" disabled>Choose a section</option>
          <option v-for="s in sections" :key="s.id" :value="s.id">
            {{ s.className }} {{ s.name }} — {{ s.campusName }}
          </option>
        </select>
      </label>
    </div>

    <div v-if="students.length" class="progress-card">
      <div class="progress-info">
        <div class="progress-top">
          <span>{{ assignedCount }} of {{ students.length }} marked</span>
          <span class="mono muted">{{ progressPercent }}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: `${progressPercent}%` }"></div>
        </div>
      </div>
      <button type="button" data-testid="default-all-present" class="default-all" @click="markAllPresent">
        <Icon name="check" :size="14" />
        Mark all present
      </button>
    </div>

    <div v-if="students.length" class="roster-card">
      <div class="roster-header">
        <span>Student</span>
        <span>Status</span>
      </div>
      <ul class="roster">
        <li v-for="(student, i) in students" :key="student.id" class="roster-row">
          <div class="roster-student">
            <span class="roster-index mono">{{ i + 1 }}</span>
            <span class="roster-avatar">{{ initialsFromName(student.name) }}</span>
            <span class="roster-name">{{ student.name }}</span>
          </div>

          <div class="status-group">
          <div class="segmented" role="radiogroup" :aria-label="`Attendance for ${student.name}`">
            <button
              type="button"
              role="radio"
              :aria-checked="statuses[student.id] === 'PRESENT'"
              :tabindex="statuses[student.id] === 'PRESENT' || !statuses[student.id] ? 0 : -1"
              :data-testid="`status-${student.id}-present`"
              class="segment segment-present"
              :class="{ active: statuses[student.id] === 'PRESENT' }"
              @click="setStatus(student.id, 'PRESENT')"
              @keydown.right.prevent="focusAdjacentSegment(student.id, 'PRESENT', 1)"
              @keydown.left.prevent="focusAdjacentSegment(student.id, 'PRESENT', -1)"
            >
              P
            </button>
            <button
              type="button"
              role="radio"
              :aria-checked="statuses[student.id] === 'ABSENT'"
              :tabindex="statuses[student.id] === 'ABSENT' ? 0 : -1"
              :data-testid="`status-${student.id}-absent`"
              class="segment segment-absent"
              :class="{ active: statuses[student.id] === 'ABSENT' }"
              @click="setStatus(student.id, 'ABSENT')"
              @keydown.right.prevent="focusAdjacentSegment(student.id, 'ABSENT', 1)"
              @keydown.left.prevent="focusAdjacentSegment(student.id, 'ABSENT', -1)"
            >
              A
            </button>
            <button
              type="button"
              role="radio"
              :aria-checked="statuses[student.id] === 'LATE'"
              :tabindex="statuses[student.id] === 'LATE' ? 0 : -1"
              :data-testid="`status-${student.id}-late`"
              class="segment segment-late"
              :class="{ active: statuses[student.id] === 'LATE' }"
              @click="setStatus(student.id, 'LATE')"
              @keydown.right.prevent="focusAdjacentSegment(student.id, 'LATE', 1)"
              @keydown.left.prevent="focusAdjacentSegment(student.id, 'LATE', -1)"
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
    </div>

    <p v-if="message" class="success" data-testid="success">{{ message }}</p>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <footer v-if="students.length" class="summary-bar">
      <div class="summary-counts">
        <div><span class="dot dot-present"></span><strong class="mono">{{ presentCount }}</strong> Present</div>
        <div><span class="dot dot-absent"></span><strong class="mono">{{ absentCount }}</strong> Absent</div>
        <div><strong class="mono">{{ students.length }}</strong> Total</div>
      </div>
      <button data-testid="save-attendance" :disabled="isSaving" @click="onSave">
        {{ isSaving ? 'Saving…' : `Submit Attendance (${assignedCount}/${students.length})` }}
      </button>
    </footer>
  </div>
</template>

<style scoped>
.attendance {
  max-width: 900px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}
.page-header h1 {
  margin: 0 0 var(--space-1);
}
.subtitle {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-muted);
  font-size: var(--font-size-sm);
}
.field {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.2rem;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-muted);
}
select {
  padding: 0.55rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-weight: 600;
  min-width: 220px;
}

.progress-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  padding: var(--space-3) var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-4);
}
.progress-info {
  flex-grow: 1;
}
.progress-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--font-size-sm);
  font-weight: 600;
  margin-bottom: var(--space-1);
}
.progress-track {
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--color-muted-bg);
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: var(--radius-full);
}
.default-all {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0.55rem 0.9rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font-weight: 600;
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.roster-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.roster-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-size-2xs);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-muted);
}
.roster {
  list-style: none;
  margin: 0;
  padding: 0;
}
.roster-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}
.roster-row:last-child {
  border-bottom: none;
}
.roster-student {
  display: flex;
  align-items: center;
  gap: var(--space-3);
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
  font-weight: 600;
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
  gap: var(--space-1);
}
.segment {
  width: 2.4rem;
  height: 2.4rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-muted);
  font-weight: 700;
  font-size: var(--font-size-sm);
  cursor: pointer;
}
.segment-present.active {
  background: var(--color-present);
  border-color: var(--color-present);
  color: var(--color-on-primary);
}
.segment-absent.active {
  background: var(--color-destructive);
  border-color: var(--color-destructive);
  color: var(--color-on-primary);
}
.segment-late.active {
  background: var(--color-late);
  border-color: var(--color-late);
  color: var(--color-on-primary);
}

.overflow {
  position: relative;
}
.overflow-trigger {
  width: 2.4rem;
  height: 2.4rem;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  font-size: var(--font-size-base);
}
.overflow-menu {
  position: absolute;
  right: 0;
  top: calc(100% + var(--space-1));
  z-index: 1;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  min-width: 8rem;
  padding: var(--space-1);
}
.overflow-menu button {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  text-align: left;
  padding: var(--space-1) var(--space-2);
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
}
.overflow-menu button:hover {
  background: var(--color-muted-bg);
}

.success {
  color: var(--color-accent);
}
.error {
  color: var(--color-destructive);
}

.summary-bar {
  position: sticky;
  bottom: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  padding: var(--space-3) var(--space-4);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}
.summary-counts {
  display: flex;
  gap: var(--space-4);
  font-size: var(--font-size-sm);
  color: var(--color-muted);
}
.summary-counts > div {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.dot-present {
  background: var(--color-present);
}
.dot-absent {
  background: var(--color-destructive);
}
.summary-bar button {
  padding: var(--space-2) var(--space-4);
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-weight: 700;
  cursor: pointer;
}
.summary-bar button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .page-header {
    flex-direction: column;
  }
  .field {
    align-items: flex-start;
    width: 100%;
  }
  select {
    width: 100%;
  }
  .progress-card {
    flex-direction: column;
    align-items: stretch;
  }
  .roster-row {
    flex-wrap: wrap;
  }
}
</style>
