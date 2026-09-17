<script setup lang="ts">
import { ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api, type CampusSummary, type HiringApplicationSummary } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import AppModal from '../components/AppModal.vue';
import HiringCandidateIntakeView from './HiringCandidateIntakeView.vue';

const STATUS_OPTIONS = [
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'SHORTLISTED', label: 'Shortlisted' },
  { value: 'INTERVIEWED', label: 'Interviewed' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

const auth = useAuthStore();

const campuses = ref<CampusSummary[]>([]);
const applications = ref<HiringApplicationSummary[]>([]);
const errorMessage = ref<string | null>(null);

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
  try {
    applications.value = await api.listHiringApplications(auth.accessToken, {
      campusId: selectedCampusId.value || undefined,
      status: selectedStatus.value || undefined,
    });
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load hiring applications.';
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
</script>

<template>
  <div class="hiring-queue">
    <div class="page-header">
      <h1>Hiring</h1>
      <Button data-testid="open-add-form" @click="showAddModal = true">+ Add New</Button>
    </div>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <div class="filter-row">
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
    </div>

    <EntityTable
      :items="applications"
      :columns="[
        { key: 'candidateName', label: 'Candidate' },
        { key: 'employeeType', label: 'Employee Type' },
        { key: 'status', label: 'Status' },
      ]"
      row-key="id"
      :editing-id="null"
    >
      <template #actions="{ item }">
        <RouterLink :data-testid="`view-application-${item.id}`" :to="`/admin/hiring/${item.id}`">
          View
        </RouterLink>
      </template>
    </EntityTable>

    <AppModal v-model="showAddModal" title="Add Hiring Candidate">
      <HiringCandidateIntakeView />
    </AppModal>
  </div>
</template>

<style scoped>
.hiring-queue {
  max-width: 900px;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
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