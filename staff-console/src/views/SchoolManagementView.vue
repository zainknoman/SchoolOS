<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type SchoolSummary } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import AppModal from '../components/AppModal.vue';
import { useConfirm } from '../lib/useConfirm';

const auth = useAuthStore();
const { confirm } = useConfirm();

const schools = ref<SchoolSummary[]>([]);
const errorMessage = ref<string | null>(null);

const showAddForm = ref(false);
const newSchool = reactive({ name: '', address: '', phone: '', email: '' });
const isSaving = ref(false);

const editingId = ref<string | null>(null);
const editForm = reactive({ name: '', address: '', phone: '', email: '' });

async function load() {
  if (!auth.accessToken) return;
  try {
    schools.value = await api.listSchools(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load schools.';
  }
}
load();

function resetAddForm() {
  newSchool.name = '';
  newSchool.address = '';
  newSchool.phone = '';
  newSchool.email = '';
}

async function onAdd() {
  if (!auth.accessToken || !newSchool.name.trim()) return;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createSchool(auth.accessToken, {
      name: newSchool.name.trim(),
      address: newSchool.address.trim() || undefined,
      phone: newSchool.phone.trim() || undefined,
      email: newSchool.email.trim() || undefined,
    });
    resetAddForm();
    showAddForm.value = false;
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not create this school.';
  } finally {
    isSaving.value = false;
  }
}

function startEdit(school: SchoolSummary) {
  editingId.value = school.id;
  editForm.name = school.name;
  editForm.address = school.address ?? '';
  editForm.phone = school.phone ?? '';
  editForm.email = school.email ?? '';
}

function cancelEdit() {
  editingId.value = null;
}

async function onSaveEdit(id: string) {
  if (!auth.accessToken || !editForm.name.trim()) return;
  errorMessage.value = null;
  try {
    await api.updateSchool(auth.accessToken, id, {
      name: editForm.name.trim(),
      address: editForm.address.trim() || undefined,
      phone: editForm.phone.trim() || undefined,
      email: editForm.email.trim() || undefined,
    });
    editingId.value = null;
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this school.';
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!(await confirm({ title: 'Delete this school?', message: 'This cannot be undone.', danger: true }))) return;
  errorMessage.value = null;
  try {
    await api.deleteSchool(auth.accessToken, id);
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this school.';
  }
}
</script>

<template>
  <div class="org-entity">
    <div class="page-header">
      <h1>Schools</h1>
      <Button data-testid="open-add-form" @click="showAddForm = true">+ Add New</Button>
    </div>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <EntityTable
      :items="schools"
      :columns="[
        { key: 'name', label: 'Name' },
        { key: 'address', label: 'Address' },
        { key: 'phone', label: 'Phone' },
        { key: 'campusCount', label: 'Campuses' },
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

    <AppModal v-model="showAddForm" title="Add School">
      <div class="add-form">
        <div class="inline-form">
          <FormField v-model="newSchool.name" label="School name" type="text" data-testid="add-name" placeholder="School name" grow />
        </div>
        <div class="inline-form">
          <FormField v-model="newSchool.address" label="Address" type="text" data-testid="add-address" placeholder="Address" grow />
        </div>
        <div class="inline-form">
          <FormField v-model="newSchool.phone" label="Phone" type="text" data-testid="add-phone" placeholder="Phone" grow />
          <FormField v-model="newSchool.email" label="Email" type="email" data-testid="add-email" placeholder="Email" grow />
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
