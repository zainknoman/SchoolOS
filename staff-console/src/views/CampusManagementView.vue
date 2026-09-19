<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api, type CampusSummary } from '../lib/api';
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

// Create needs SUPER_ADMIN or a school-wide SCHOOL_ADMIN; edit/delete are SUPER_ADMIN-only.
const canCreateCampus = computed(
  () => auth.role === 'SUPER_ADMIN' || (auth.role === 'SCHOOL_ADMIN' && !auth.campusId),
);
const canEditCampus = computed(() => auth.role === 'SUPER_ADMIN');

const campuses = ref<CampusSummary[]>([]);
const errorMessage = ref<string | null>(null);

async function load() {
  if (!auth.accessToken) return;
  try {
    campuses.value = await api.listCampuses(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load campuses.';
  }
}
load();

// Adding, viewing and editing all happen on the campus profile screen — no popup forms.
const openNew = () => router.push('/admin/campuses/new');
const openProfile = (id: string) => router.push(`/admin/campuses/${id}`);
const openEdit = (id: string) => router.push({ path: `/admin/campuses/${id}`, query: { edit: '1' } });

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!(await confirm({ title: 'Delete this campus?', message: 'This cannot be undone.', danger: true }))) return;
  errorMessage.value = null;
  try {
    await api.deleteCampus(auth.accessToken, id);
    await load();
    toast.success('Campus deleted.');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this campus.';
  }
}
</script>

<template>
  <ListPageCard icon="grid" title="Campuses">
    <template #actions>
      <Button v-if="canCreateCampus" data-testid="open-add-form" @click="openNew">+ Add New</Button>
    </template>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <EntityTable
      :items="campuses"
      :columns="[
        { key: 'name', label: 'Name' },
        { key: 'code', label: 'Code' },
        { key: 'status', label: 'Status' },
        { key: 'campusType', label: 'Type' },
        { key: 'schoolName', label: 'School' },
        { key: 'address', label: 'Address' },
        { key: 'phone', label: 'Phone' },
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
      <template #cell-campusType="{ item }">
        <span>{{ item.campusType ?? '—' }}</span>
      </template>
      <template #cell-address="{ item }">
        <span>{{ item.address ?? '—' }}</span>
      </template>
      <template #cell-phone="{ item }">
        <span>{{ item.phone ?? '—' }}</span>
      </template>
      <template #actions="{ item }">
        <Button :data-testid="`view-profile-${item.id}`" @click="openProfile(item.id)">View</Button>
        <Button v-if="canEditCampus" :data-testid="`edit-${item.id}`" @click="openEdit(item.id)">Edit</Button>
        <Button v-if="canEditCampus" variant="secondary" :data-testid="`delete-${item.id}`" @click="onDelete(item.id)">
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
