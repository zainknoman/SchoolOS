<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api, type SchoolSummary } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import Button from '../components/Button.vue';
import ListPageCard from '../components/ListPageCard.vue';
import StatusPill from '../components/StatusPill.vue';
import { useConfirm } from '../lib/useConfirm';
import { useToast } from '../lib/useToast';

const auth = useAuthStore();
const router = useRouter();
const { confirm } = useConfirm();
const toast = useToast();

const schools = ref<SchoolSummary[]>([]);
const errorMessage = ref<string | null>(null);

async function load() {
  if (!auth.accessToken) return;
  try {
    schools.value = await api.listSchools(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load schools.';
  }
}
load();

// Adding, viewing and editing all happen on the school profile screen — no popup forms.
const openNew = () => router.push('/admin/schools/new');
const openProfile = (id: string) => router.push(`/admin/schools/${id}`);
const openEdit = (id: string) => router.push({ path: `/admin/schools/${id}`, query: { edit: '1' } });

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!(await confirm({ title: 'Delete this school?', message: 'This cannot be undone.', danger: true }))) return;
  errorMessage.value = null;
  try {
    await api.deleteSchool(auth.accessToken, id);
    await load();
    toast.success('School deleted.');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this school.';
  }
}
</script>

<template>
  <ListPageCard icon="home" title="Schools">
    <template #actions>
      <Button data-testid="open-add-form" @click="openNew">+ Add New</Button>
    </template>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <EntityTable
      :items="schools"
      :columns="[
        { key: 'name', label: 'Name' },
        { key: 'code', label: 'Code' },
        { key: 'status', label: 'Status' },
        { key: 'address', label: 'Address' },
        { key: 'phone', label: 'Phone' },
        { key: 'campusCount', label: 'Campuses' },
        { key: 'studentCount', label: 'Students' },
        { key: 'staffCount', label: 'Staff' },
      ]"
      row-key="id"
      :editing-id="null"
    >
      <template #cell-code="{ item }">
        <span>{{ item.code ?? '—' }}</span>
      </template>
      <template #cell-status="{ item }">
        <StatusPill
          :tone="item.status === 'INACTIVE' ? 'neutral' : 'success'"
          :label="item.status === 'INACTIVE' ? 'Inactive' : 'Active'"
        />
      </template>
      <template #cell-address="{ item }">
        <span>{{ item.address ?? '—' }}</span>
      </template>
      <template #cell-phone="{ item }">
        <span>{{ item.phone ?? '—' }}</span>
      </template>
      <template #actions="{ item }">
        <Button :data-testid="`view-profile-${item.id}`" @click="openProfile(item.id)">View</Button>
        <Button :data-testid="`edit-${item.id}`" @click="openEdit(item.id)">Edit</Button>
        <Button variant="secondary" :data-testid="`delete-${item.id}`" @click="onDelete(item.id)">
          Delete
        </Button>
      </template>
    </EntityTable>
  </ListPageCard>
</template>

<style scoped>
.error {
  color: var(--color-destructive);
  margin-bottom: var(--space-3);
}
</style>
