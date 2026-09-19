<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type ApplicationSummary, type AcademicSessionSummary } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import AppModal from '../components/AppModal.vue';
import ErrorRetry from '../components/ErrorRetry.vue';
import ListPageCard from '../components/ListPageCard.vue';
import StatusPill from '../components/StatusPill.vue';
import ApplicantIntakeView from './ApplicantIntakeView.vue';
import { useToast } from '../lib/useToast';

const STATUS_OPTIONS = [
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
];

const STATUS_TONES: Record<string, 'success' | 'warning' | 'critical' | 'info' | 'neutral'> = {
  SUBMITTED: 'neutral',
  UNDER_REVIEW: 'info',
  APPROVED: 'success',
  REJECTED: 'critical',
  WITHDRAWN: 'warning',
};

function statusLabel(status: string): string {
  return STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}
function statusTone(status: string): 'success' | 'warning' | 'critical' | 'info' | 'neutral' {
  return STATUS_TONES[status] ?? 'neutral';
}

const auth = useAuthStore();
const toast = useToast();

const sessions = ref<AcademicSessionSummary[]>([]);
const applications = ref<ApplicationSummary[]>([]);
const errorMessage = ref<string | null>(null);
const isLoading = ref(false);

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
  isLoading.value = true;
  try {
    applications.value = await api.listApplications(auth.accessToken, {
      academicSessionId: selectedSessionId.value || undefined,
      status: selectedStatus.value || undefined,
    });
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load applications.';
  } finally {
    isLoading.value = false;
  }
}

async function init() {
  await loadSessions();
  await loadApplications();
}
init();

const showAddModal = ref(false);
watch(showAddModal, (isOpen) => {
  if (!isOpen) loadApplications();
});

function onApplicantCreated() {
  toast.success('Applicant added.');
}

const activeSessionLabel = computed(
  () => sessions.value.find((s) => s.id === selectedSessionId.value)?.label ?? '',
);
</script>

<template>
  <ListPageCard icon="users" title="Admissions" :subtitle="activeSessionLabel ? `Application queue · ${activeSessionLabel}` : 'Application queue'">
    <template #actions>
      <Button data-testid="open-add-form" @click="showAddModal = true">+ Add New</Button>
    </template>
    <template #toolbar>
      <FormField
        v-model="selectedSessionId"
        label="Academic session"
        hide-label
        type="select"
        data-testid="filter-session"
        placeholder="All sessions"
        :options="sessions.map((s) => ({ value: s.id, label: s.label }))"
        @update:model-value="loadApplications"
      />
      <FormField
        v-model="selectedStatus"
        label="Status"
        hide-label
        type="select"
        data-testid="filter-status"
        placeholder="All statuses"
        :options="STATUS_OPTIONS"
        @update:model-value="loadApplications"
      />
    </template>

    <ErrorRetry v-if="errorMessage" :message="errorMessage" @retry="loadApplications" />

    <EntityTable
      :items="applications"
      :columns="[
        { key: 'applicantName', label: 'Applicant' },
        { key: 'status', label: 'Status' },
      ]"
      row-key="id"
      :editing-id="null"
      :loading="isLoading"
      empty-icon="users"
      empty-title="No applications yet"
      empty-message="New applications will show up here once a family applies or you add one directly."
      empty-cta-label="+ Add New"
      @empty-cta="showAddModal = true"
    >
      <template #cell-status="{ item }">
        <StatusPill :tone="statusTone(item.status)" :label="statusLabel(item.status)" />
      </template>
      <template #actions="{ item }">
        <RouterLink :data-testid="`view-application-${item.id}`" :to="`/admin/admissions/${item.id}`">
          View
        </RouterLink>
      </template>
    </EntityTable>

    <AppModal v-model="showAddModal" title="Add Applicant">
      <ApplicantIntakeView @created="onApplicantCreated" />
    </AppModal>
  </ListPageCard>
</template>
