<!-- staff-console/src/views/TeacherManagementView.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type TeacherAdminSummary, type CampusSummary } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import AppModal from '../components/AppModal.vue';
import { useConfirm } from '../lib/useConfirm';

const auth = useAuthStore();
const { confirm } = useConfirm();

const teachers = ref<TeacherAdminSummary[]>([]);
const campuses = ref<CampusSummary[]>([]);
const errorMessage = ref<string | null>(null);

const showAddForm = ref(false);
const newIdentifier = ref('');
const newPassword = ref('');
const newName = ref('');
const newCampusId = ref('');
const isSaving = ref(false);

const editingId = ref<string | null>(null);
const editName = ref('');
const editPassword = ref('');

async function load() {
  if (!auth.accessToken) return;
  try {
    [teachers.value, campuses.value] = await Promise.all([
      api.listAdminTeachers(auth.accessToken),
      api.listCampuses(auth.accessToken),
    ]);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load teachers.';
  }
}
load();

async function onAdd() {
  if (!auth.accessToken || !newIdentifier.value.trim() || !newPassword.value || !newName.value.trim() || !newCampusId.value) return;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createTeacher(auth.accessToken, {
      identifier: newIdentifier.value.trim(),
      password: newPassword.value,
      name: newName.value.trim(),
      campusId: newCampusId.value,
    });
    newIdentifier.value = '';
    newPassword.value = '';
    newName.value = '';
    newCampusId.value = '';
    showAddForm.value = false;
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not create this teacher.';
  } finally {
    isSaving.value = false;
  }
}

function startEdit(teacher: TeacherAdminSummary) {
  editingId.value = teacher.id;
  editName.value = teacher.name;
  editPassword.value = '';
}

function cancelEdit() {
  editingId.value = null;
}

async function onSaveEdit(id: string) {
  if (!auth.accessToken || !editName.value.trim()) return;
  errorMessage.value = null;
  try {
    await api.updateTeacher(auth.accessToken, id, {
      name: editName.value.trim(),
      ...(editPassword.value ? { password: editPassword.value } : {}),
    });
    editingId.value = null;
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this teacher.';
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!(await confirm({ title: 'Delete this teacher?', message: 'This cannot be undone.', danger: true }))) return;
  errorMessage.value = null;
  try {
    await api.deleteTeacher(auth.accessToken, id);
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this teacher.';
  }
}
</script>

<template>
  <div class="org-entity">
    <div class="page-header">
      <h1>Teachers</h1>
      <Button data-testid="open-add-form" @click="showAddForm = true">+ Add New</Button>
    </div>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <EntityTable
      :items="teachers"
      :columns="[{ key: 'name', label: 'Name' }, { key: 'identifier', label: 'Login' }]"
      row-key="id"
      :editing-id="editingId"
    >
      <template #cell-name="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-name-${item.id}`" v-model="editName" type="text" />
        <span v-else>{{ item.name }}</span>
      </template>
      <template #cell-identifier="{ item, editing }">
        {{ item.identifier }}
        <input
          v-if="editing"
          :data-testid="`edit-password-${item.id}`"
          v-model="editPassword"
          type="password"
          placeholder="New password (leave blank to keep)"
        />
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

    <AppModal v-model="showAddForm" title="Add Teacher">
      <div class="inline-form">
        <FormField v-model="newIdentifier" label="Login email" type="text" data-testid="add-identifier" placeholder="Login email" grow />
        <FormField v-model="newPassword" label="Initial password" type="password" data-testid="add-password" placeholder="Initial password" grow />
        <FormField v-model="newName" label="Full name" type="text" data-testid="add-name" placeholder="Full name" grow />
        <FormField
          v-model="newCampusId"
          label="Campus"
          type="select"
          data-testid="add-campus"
          placeholder="Select a campus"
          :options="campuses.map((c) => ({ value: c.id, label: c.name }))"
        />
        <Button data-testid="add-submit" :disabled="isSaving" @click="onAdd">Add</Button>
      </div>
    </AppModal>
  </div>
</template>

<style scoped>
.org-entity {
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
.inline-form {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  flex-wrap: wrap;
}
</style>
