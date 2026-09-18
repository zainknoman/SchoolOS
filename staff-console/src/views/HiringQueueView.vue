<script setup lang="ts">
import { ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api, type CampusSummary, type HiringApplicationSummary } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import AppModal from '../components/AppModal.vue';
import ErrorRetry from '../components/ErrorRetry.vue';
import ListPageCard from '../components/ListPageCard.vue';
import StatusPill from '../components/StatusPill.vue';
import HiringCandidateIntakeView from './HiringCandidateIntakeView.vue';
import { useToast } from '../lib/useToast';

const STATUS_OPTIONS = [
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'SHORTLISTED', label: 'Shortlisted' },
  { value: 'INTERVIEWED', label: 'Interviewed' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

const STATUS_TONES: Record<string, 'success' | 'warning' | 'critical' | 'info' | 'neutral'> = {
  SUBMITTED: 'neutral',
  SHORTLISTED: 'info',
  INTERVIEWED: 'warning',
  APPROVED: 'success',
  REJECTED: 'critical',
};

function statusLabel(status: string): string {
  return STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}
function statusTone(status: string): 'success' | 'warning' | 'critical' | 'info' | 'neutral' {
  return STATUS_TONES[status] ?? 'neutral';
}

const auth = useAuthStore();
const toast = useToast();

const campuses = ref<CampusSummary[]>([]);
const applications = ref<HiringApplicationSummary[]>([]);
const errorMessage = ref<string | null>(null);
const isLoading = ref(false);

const selectedCampusId = ref('');
const selectedStatus = ref('');

async function loadCampuses() {
  if (!auth.accessToken) return;
  try {
    campuses.value = await api.listCampuses(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load campuses.';
  }
}

async function loadApplications() {
  if (!auth.accessToken) return;
  errorMessage.value = null;
  isLoading.value = true;
  try {
    applications.value = await api.listHiringApplications(auth.accessToken, {
      campusId: selectedCampusId.value || undefined,
      status: selectedStatus.value || undefined,
    });
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load hiring applications.';
  } finally {
    isLoading.value = false;
  }
}

async function init() {
  await loadCampuses();
  await loadApplications();
}
init();

const showAddModal = ref(false);
watch(showAddModal, (isOpen) => {
  if (!isOpen) loadApplications();
});

function onCandidateCreated() {
  toast.success('Hiring candidate added.');
}
</script>

<template>
  <ListPageCard icon="users" title="Hiring" subtitle="Candidate applications">
    <template #actions>
      <Button data-testid="open-add-form" @click="showAddModal = true">+ Add New</Button>
    </template>
    <template #toolbar>
      <FormField
        v-model="selectedCampusId"
        label="Campus"
        type="select"
        data-testid="filter-campus"
        placeholder="All campuses"
        :options="campuses.map((c) => ({ value: c.id, label: c.name }))"
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
    </template>

    <ErrorRetry v-if="errorMessage" :message="errorMessage" @retry="loadApplications" />

    <EntityTable
      :items="applications"
      :columns="[
        { key: 'candidateName', label: 'Candidate' },
        { key: 'employeeType', label: 'Employee Type' },
        { key: 'status', label: 'Status' },
      ]"
      row-key="id"
      :editing-id="null"
      :loading="isLoading"
      empty-icon="users"
      empty-title="No hiring applications yet"
      empty-message="Applications will show up here once you add a candidate."
      empty-cta-label="+ Add New"
      @empty-cta="showAddModal = true"
    >
      <template #cell-status="{ item }">
        <StatusPill :tone="statusTone(item.status)" :label="statusLabel(item.status)" />
      </template>
      <template #actions="{ item }">
        <RouterLink :data-testid="`view-application-${item.id}`" :to="`/admin/hiring/${item.id}`">
          View
        </RouterLink>
      </template>
    </EntityTable>

    <AppModal v-model="showAddModal" title="Add Hiring Candidate">
      <HiringCandidateIntakeView @created="onCandidateCreated" />
    </AppModal>
  </ListPageCard>
</template>