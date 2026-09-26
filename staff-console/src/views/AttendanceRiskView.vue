<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type AttendanceRiskSummary, type SchoolSummary } from '../lib/api';
import Button from '../components/Button.vue';
import EmptyState from '../components/EmptyState.vue';
import ErrorRetry from '../components/ErrorRetry.vue';
import FormField from '../components/FormField.vue';
import ListPageCard from '../components/ListPageCard.vue';
import { useToast } from '../lib/useToast';

// BL-28 (Q8): when a student counts as "at risk" (per school) and who is alerted. The nightly job
// applies the saved settings; the list shows who is flagged right now.
const auth = useAuthStore();
const toast = useToast();

const isSuperAdmin = computed(() => auth.role === 'SUPER_ADMIN');
// Settings are school-wide: a campus-level admin sees them but cannot change them.
const canEdit = computed(() => isSuperAdmin.value || (auth.role === 'SCHOOL_ADMIN' && !auth.campusId));

const schools = ref<SchoolSummary[]>([]);
const schoolId = ref('');
const windowDays = ref('30');
const thresholdPercent = ref('25');
const minTrackedDays = ref('5');
const notifyParents = ref(false);
const loaded = ref(false);
const flagged = ref<AttendanceRiskSummary[]>([]);
const errorMessage = ref<string | null>(null);
const busy = ref(false);

const schoolOptions = computed(() => schools.value.map((s) => ({ value: s.id, label: s.name })));

async function loadSettings() {
  if (!auth.accessToken || (isSuperAdmin.value && !schoolId.value)) return;
  errorMessage.value = null;
  try {
    const s = await api.getAttendanceRiskSettings(auth.accessToken, isSuperAdmin.value ? schoolId.value : undefined);
    windowDays.value = String(s.windowDays);
    thresholdPercent.value = String(s.thresholdPercent);
    minTrackedDays.value = String(s.minTrackedDays);
    notifyParents.value = s.notifyParents;
    loaded.value = true;
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load the settings.';
  }
}

async function load() {
  if (!auth.accessToken) return;
  try {
    const [list, loadedSchools] = await Promise.all([
      api.getFlaggedStudents(auth.accessToken),
      isSuperAdmin.value ? api.listSchools(auth.accessToken) : Promise.resolve([]),
    ]);
    flagged.value = list;
    schools.value = loadedSchools;
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load flagged students.';
  }
  await loadSettings();
}

watch(schoolId, loadSettings);

async function onSave() {
  if (!auth.accessToken) return;
  const values = {
    windowDays: Number(windowDays.value),
    thresholdPercent: Number(thresholdPercent.value),
    minTrackedDays: Number(minTrackedDays.value),
  };
  if (Object.values(values).some((v) => !Number.isInteger(v) || v < 1)) {
    errorMessage.value = 'Enter whole numbers for the window, threshold and minimum days.';
    return;
  }
  if (values.minTrackedDays > values.windowDays) {
    errorMessage.value = 'The minimum tracked days cannot be more than the window.';
    return;
  }
  errorMessage.value = null;
  busy.value = true;
  try {
    await api.updateAttendanceRiskSettings(auth.accessToken, {
      ...(isSuperAdmin.value ? { schoolId: schoolId.value } : {}),
      ...values,
      notifyParents: notifyParents.value,
    });
    toast.success('Attendance-risk settings saved. They apply from the next nightly check.');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not save the settings.';
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <ListPageCard icon="calendar" title="Attendance Risk" subtitle="Who is flagged, and when a student counts as at risk">
    <template v-if="isSuperAdmin" #toolbar>
      <FormField
        v-model="schoolId"
        label="School"
        hide-label
        type="select"
        data-testid="risk-school"
        placeholder="Choose a school"
        :options="schoolOptions"
      />
    </template>

    <ErrorRetry v-if="errorMessage" :message="errorMessage" @retry="load" />

    <section v-if="loaded" class="settings" data-testid="risk-settings">
      <h3>Settings</h3>
      <p class="hint">
        A student is flagged when they were absent on at least the threshold share of tracked school days in the window
        (late counts as present; leave days and holidays are not counted), once enough days are tracked. The class
        teacher and the school's administrators are alerted when a student is newly flagged.
      </p>
      <div class="grid">
        <FormField v-model="windowDays" label="Window (days)" type="text" data-testid="risk-window" :disabled="!canEdit" />
        <FormField v-model="thresholdPercent" label="Threshold (% absent)" type="text" data-testid="risk-threshold" :disabled="!canEdit" />
        <FormField v-model="minTrackedDays" label="Minimum tracked days" type="text" data-testid="risk-min-days" :disabled="!canEdit" />
      </div>
      <FormField
        v-model="notifyParents"
        type="checkbox"
        label="Also alert the student's guardians"
        hint="Off by default. Guardians get an in-app notification when their child is newly flagged."
        data-testid="risk-notify-parents"
        :disabled="!canEdit"
      />
      <div v-if="canEdit" class="actions">
        <Button data-testid="risk-save" :disabled="busy" @click="onSave">Save settings</Button>
      </div>
      <p v-else class="hint" data-testid="risk-read-only">Only a school-wide administrator can change these settings.</p>
    </section>

    <section class="flagged">
      <h3>Flagged students</h3>
      <EmptyState v-if="flagged.length === 0" icon="calendar" title="No student is flagged" />
      <table v-else class="table" data-testid="risk-flagged">
        <thead>
          <tr>
            <th>Student</th>
            <th>Absence rate</th>
            <th>Window</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in flagged" :key="r.studentId">
            <td>{{ r.studentName }}</td>
            <td class="mono">{{ Math.round(r.absenceRate * 100) }}%</td>
            <td class="mono">{{ r.windowStart }} – {{ r.windowEnd }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </ListPageCard>
</template>

<style scoped>
.settings,
.flagged {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.flagged {
  margin-top: var(--space-4);
}
h3 {
  margin: 0;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: var(--space-3);
}
.hint {
  margin: 0;
  color: var(--color-muted);
  font-size: var(--font-size-xs);
}
.table {
  width: 100%;
  border-collapse: collapse;
}
.table th,
.table td {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
}
</style>
