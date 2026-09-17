<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type CampusSummary, type SchoolSummary } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import AppModal from '../components/AppModal.vue';
import { useConfirm } from '../lib/useConfirm';

const auth = useAuthStore();
const { confirm } = useConfirm();

const schools = ref<SchoolSummary[]>([]);
const campuses = ref<CampusSummary[]>([]);
const errorMessage = ref<string | null>(null);

const showAddForm = ref(false);
const newCampus = reactive({ schoolId: '', name: '', address: '', phone: '', email: '' });
const isSaving = ref(false);

const editingId = ref<string | null>(null);
const editForm = reactive({ name: '', address: '', phone: '', email: '' });

async function load() {
  if (!auth.accessToken) return;
  try {
    [schools.value, campuses.value] = await Promise.all([
      api.listSchools(auth.accessToken),
      api.listCampuses(auth.accessToken),
    ]);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load campuses.';
  }
}
load();

function resetAddForm() {
  newCampus.schoolId = '';
  newCampus.name = '';
  newCampus.address = '';
  newCampus.phone = '';
  newCampus.email = '';
}

async function onAdd() {
  if (!auth.accessToken || !newCampus.schoolId || !newCampus.name.trim()) return;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createCampus(auth.accessToken, {
      schoolId: newCampus.schoolId,
      name: newCampus.name.trim(),
      address: newCampus.address.trim() || undefined,
      phone: newCampus.phone.trim() || undefined,
      email: newCampus.email.trim() || undefined,
    });
    resetAddForm();
    showAddForm.value = false;
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not create this campus.';
  } finally {
    isSaving.value = false;
  }
}

function startEdit(campus: CampusSummary) {
  editingId.value = campus.id;
  editForm.name = campus.name;
  editForm.address = campus.address ?? '';
  editForm.phone = campus.phone ?? '';
  editForm.email = campus.email ?? '';
}

function cancelEdit() {
  editingId.value = null;
}

async function onSaveEdit(id: string) {
  if (!auth.accessToken || !editForm.name.trim()) return;
  errorMessage.value = null;
  try {
    await api.updateCampus(auth.accessToken, id, {
      name: editForm.name.trim(),
      address: editForm.address.trim() || undefined,
      phone: editForm.phone.trim() || undefined,
      email: editForm.email.trim() || undefined,
    });
    editingId.value = null;
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this campus.';
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!(await confirm({ title: 'Delete this campus?', message: 'This cannot be undone.', danger: true }))) return;
  errorMessage.value = null;
  try {
    await api.deleteCampus(auth.accessToken, id);
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this campus.';
  }
}
</script>

<template>
  <div class="org-entity">
    <div class="page-header">
      <h1>Campuses</h1>
      <Button data-testid="open-add-form" @click="showAddForm = true">+ Add New</Button>
    </div>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <EntityTable
      :items="campuses"
      :columns="[
        { key: 'name', label: 'Name' },
        { key: 'schoolName', label: 'School' },
        { key: 'address', label: 'Address' },
        { key: 'phone', label: 'Phone' },
        { key: 'studentCount', label: 'Students' },
        { key: 'staffCount', label: 'Staff' },
      ]"
      row-key="id"
      :editing-id="editingId"
    >
      <template #cell-name="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-name-${item.id}`" v-model="editForm.name" type="text" />
        <span v-else>{{ item.name }}</span>
      </template>
      <template #cell-address="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-address-${item.id}`" v-model="editForm.address" type="text" />
        <span v-else>{{ item.address ?? '—' }}</span>
      </template>
      <template #cell-phone="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-phone-${item.id}`" v-model="editForm.phone" type="text" />
        <span v-else>{{ item.phone ?? '—' }}</span>
      </template>
      <template #actions="{ item, editing }">
        <template v-if="editing">
          <Button :data-testid="`save-${item.id}`" @click="onSaveEdit(item.id)">Save</Button>
          <Button variant="secondary" @click="cancelEdit">Cancel</Button>
        </template>
        <template v-else>
          <Button :data-testid="`edit-${item.id}`" @click="startEdit(item)">Edit</Button>
          <Button variant="secondary" :data-testid="`delete-${item.id}`" @click="onDelete(item.id)">
            Delete
          </Button>
        </template>
      </template>
    </EntityTable>

    <AppModal v-model="showAddForm" title="Add Campus">
      <div class="add-form">
        <div class="inline-form">
          <FormField
            v-model="newCampus.schoolId"
            label="School"
            type="select"
            data-testid="add-school"
            placeholder="Choose a school"
            :options="schools.map((s) => ({ value: s.id, label: s.name }))"
          />
          <FormField v-model="newCampus.name" label="Campus name" type="text" data-testid="add-name" placeholder="Campus name" grow />
        </div>
        <div class="inline-form">
          <FormField v-model="newCampus.address" label="Address" type="text" data-testid="add-address" placeholder="Address" grow />
        </div>
        <div class="inline-form">
          <FormField v-model="newCampus.phone" label="Phone" type="text" data-testid="add-phone" placeholder="Phone" grow />
          <FormField v-model="newCampus.email" label="Email" type="email" data-testid="add-email" placeholder="Email" grow />
        </div>
        <Button data-testid="add-submit" :disabled="isSaving" @click="onAdd">Add</Button>
      </div>
    </AppModal>
  </div>
</template>

<style scoped>
.org-entity {
  max-width: 1000px;
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
.add-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.inline-form {
  display: flex;
  gap: var(--space-2);
  align-items: flex-end;
}
</style>
