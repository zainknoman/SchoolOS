<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import {
  api,
  DATA_EXPORT_DATASETS,
  type AcademicSessionSummary,
  type DataExportDataset,
  type SchoolSummary,
} from '../lib/api';
import Button from '../components/Button.vue';
import ErrorRetry from '../components/ErrorRetry.vue';
import FormField from '../components/FormField.vue';
import ListPageCard from '../components/ListPageCard.vue';
import { useToast } from '../lib/useToast';

// BL-41 (Q7, Q22): controlled export of one school's records as CSV. Scope, the audit entry and
// whether sensitive columns may be included are all decided by the server; this screen only
// collects the choice.
const auth = useAuthStore();
const toast = useToast();

const LABELS: Record<DataExportDataset, string> = {
  students: 'Students',
  guardians: 'Guardians',
  enrolments: 'Enrolments',
  attendance: 'Attendance',
  results: 'Results (marks)',
  fees: 'Fee vouchers',
};
const datasetOptions = DATA_EXPORT_DATASETS.map((d) => ({ value: d, label: LABELS[d] }));

const isSuperAdmin = computed(() => auth.role === 'SUPER_ADMIN');
const maySeeSensitive = computed(() => isSuperAdmin.value || auth.isPrincipal);

const dataset = ref<string>('students');
const schoolId = ref('');
const sessionId = ref('');
const from = ref('');
const to = ref('');
const includeSensitive = ref(false);

const schools = ref<SchoolSummary[]>([]);
const sessions = ref<AcademicSessionSummary[]>([]);
const errorMessage = ref<string | null>(null);
const busy = ref(false);

const hasSensitive = computed(() => dataset.value === 'students' || dataset.value === 'guardians');
const isAttendance = computed(() => dataset.value === 'attendance');
const schoolOptions = computed(() => schools.value.map((s) => ({ value: s.id, label: s.name })));
const sessionOptions = computed(() => [
  { value: '', label: 'All sessions' },
  ...sessions.value
    .filter((s) => !isSuperAdmin.value || s.schoolId === schoolId.value)
    .map((s) => ({ value: s.id, label: s.label })),
]);
const canExport = computed(() => !busy.value && (!isSuperAdmin.value || !!schoolId.value));

watch(schoolId, () => {
  sessionId.value = '';
});
watch(hasSensitive, (on) => {
  if (!on) includeSensitive.value = false;
});

async function loadOptions() {
  if (!auth.accessToken) return;
  try {
    const [loadedSessions, loadedSchools] = await Promise.all([
      api.listAcademicSessions(auth.accessToken),
      isSuperAdmin.value ? api.listSchools(auth.accessToken) : Promise.resolve([]),
    ]);
    sessions.value = loadedSessions;
    schools.value = loadedSchools;
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load schools and sessions.';
  }
}

async function onExport() {
  if (!auth.accessToken || !canExport.value) return;
  errorMessage.value = null;
  busy.value = true;
  try {
    await api.downloadDataExport(auth.accessToken, dataset.value as DataExportDataset, {
      schoolId: isSuperAdmin.value ? schoolId.value : undefined,
      academicSessionId: isAttendance.value ? undefined : sessionId.value || undefined,
      from: isAttendance.value ? from.value || undefined : undefined,
      to: isAttendance.value ? to.value || undefined : undefined,
      includeSensitive: hasSensitive.value && includeSensitive.value,
    });
    toast.success(`${LABELS[dataset.value as DataExportDataset]} export downloaded.`);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not export.';
  } finally {
    busy.value = false;
  }
}

onMounted(loadOptions);
</script>

<template>
  <ListPageCard icon="grid" title="Data Export" subtitle="Download your school's records as CSV">
    <div class="form">
      <FormField v-model="dataset" label="What to export" type="select" data-testid="export-dataset" :options="datasetOptions" />
      <FormField
        v-if="isSuperAdmin"
        v-model="schoolId"
        label="School"
        type="select"
        data-testid="export-school"
        placeholder="Choose a school"
        :options="schoolOptions"
      />
      <template v-if="isAttendance">
        <FormField v-model="from" label="From" type="date" data-testid="export-from" />
        <FormField v-model="to" label="To" type="date" data-testid="export-to" />
      </template>
      <FormField
        v-else
        v-model="sessionId"
        label="Session"
        type="select"
        data-testid="export-session"
        :options="sessionOptions"
      />
      <FormField
        v-if="hasSensitive"
        v-model="includeSensitive"
        type="checkbox"
        data-testid="export-sensitive"
        :disabled="!maySeeSensitive"
        label="Include sensitive fields"
        :hint="
          maySeeSensitive
            ? 'B-Form, CNIC, religion and medical information. Only include them when the purpose requires it.'
            : 'Only the principal or a super admin may export B-Form, CNIC and medical information.'
        "
      />
    </div>
    <ErrorRetry v-if="errorMessage" :message="errorMessage" @retry="onExport" />
    <div class="actions">
      <Button data-testid="export-submit" :disabled="!canExport" @click="onExport">
        {{ busy ? 'Exporting…' : 'Download CSV' }}
      </Button>
    </div>
    <p class="hint">
      Exports cover one school only (your campus, if your account is campus-level). Every export is recorded in the
      audit log with who ran it and how many rows it contained. Amounts are in paisa.
    </p>
  </ListPageCard>
</template>

<style scoped>
.form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: var(--space-3);
  align-items: end;
}
.actions {
  margin-top: var(--space-4);
}
.hint {
  color: var(--color-muted);
  font-size: var(--font-size-xs);
}
</style>
