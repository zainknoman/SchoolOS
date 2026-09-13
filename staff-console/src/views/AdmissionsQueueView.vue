<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type ApplicationSummary, type AcademicSessionSummary } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';

const STATUS_OPTIONS = [
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
];

const auth = useAuthStore();

const sessions = ref<AcademicSessionSummary[]>([]);
const applications = ref<ApplicationSummary[]>([]);
const errorMessage = ref<string | null>(null);

const selectedSessionId = ref('');
const selectedStatus = ref('');

async function loadSessions() {
  if (!auth.accessToken) return;
  try {
    sessions.value = await api.listAcademicSessions(auth.accessToken);
    const active = sessions.value.find((s) => s.isActive);
    if (active) selectedSessionId.value = active.id;
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load academic sessions.';
  }
}

async function loadApplications() {
  if (!auth.accessToken) return;
  errorMessage.value = null;
  try {
    applications.value = await api.listApplications(auth.accessToken, {
      academicSessionId: selectedSessionId.value || undefined,
      status: selectedStatus.value || undefined,
    });
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load applications.';
  }
}

async function init() {
  await loadSessions();
  await loadApplications();
}
init();
</script>

<template>
  <div class="admissions-queue">
    <h1>Admissions</h1>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <div class="filter-row">
      <FormField
        v-model="selectedSessionId"
        label="Academic session"
        type="select"
        data-testid="filter-session"
        placeholder="All sessions"
        :options="sessions.map((s) => ({ value: s.id, label: s.label }))"
        @update:model-value="loadApplications"
      />
      <FormField
        v-model="selectedStatus"
        label="Status"
        type="select"
        data-testid="filter-status"
        placeholder="All statuses"
        :options="STATUS_OPTIONS"
        @update:model-value="loadApplications"
      />
    </div>

    <EntityTable
      :items="applications"
      :columns="[
        { key: 'applicantName', label: 'Applicant' },
        { key: 'status', label: 'Status' },
      ]"
      row-key="id"
      :editing-id="null"
    >
      <template #actions="{ item }">
        <RouterLink :data-testid="`view-application-${item.id}`" :to="`/admin/admissions/${item.id}`">
          View
        </RouterLink>
      </template>
    </EntityTable>
  </div>
</template>

<style scoped>
.admissions-queue {
  max-width: 900px;
}
.error {
  color: var(--color-destructive);
  margin-bottom: var(--space-3);
}
.filter-row {
  display: flex;
  gap: var(--space-2);
  align-items: flex-end;
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}
</style>
