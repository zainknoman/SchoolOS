<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api, type StaffAdminSummary } from '../lib/api';
import { EMPLOYEE_TYPE_OPTIONS } from '../lib/staff-profile.constants.ts';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';

const auth = useAuthStore();

const staff = ref<StaffAdminSummary[]>([]);
const errorMessage = ref<string | null>(null);
const selectedEmployeeType = ref('');

async function load() {
  if (!auth.accessToken) return;
  errorMessage.value = null;
  try {
    staff.value = await api.listAdminStaff(auth.accessToken, selectedEmployeeType.value || undefined);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load staff.';
  }
}
load();
</script>

<template>
  <div class="org-entity">
    <div class="page-header">
      <h1>Staff</h1>
    </div>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <div class="filter-row">
      <FormField
        v-model="selectedEmployeeType"
        label="Employee type"
        type="select"
        data-testid="filter-employee-type"
        placeholder="All employee types"
        :options="EMPLOYEE_TYPE_OPTIONS"
        @update:model-value="load"
      />
    </div>

    <EntityTable
      :items="staff"
      :columns="[
        { key: 'name', label: 'Name' },
        { key: 'employeeType', label: 'Employee Type' },
        { key: 'employmentStatus', label: 'Status' },
        { key: 'campusName', label: 'Campus' },
      ]"
      row-key="id"
      :editing-id="null"
    >
      <template #actions="{ item }">
        <RouterLink :data-testid="`view-profile-${item.id}`" :to="`/admin/staff/${item.id}`">View Profile</RouterLink>
      </template>
    </EntityTable>
  </div>
</template>

<style scoped>
.org-entity {
  max-width: 1100px;
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