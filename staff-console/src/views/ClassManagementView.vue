<!-- staff-console/src/views/ClassManagementView.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type ClassSummary, type CampusSummary, type AcademicSessionSummary } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import AppModal from '../components/AppModal.vue';
import { useConfirm } from '../lib/useConfirm';

const auth = useAuthStore();
const { confirm } = useConfirm();

const campuses = ref<CampusSummary[]>([]);
const academicSessions = ref<AcademicSessionSummary[]>([]);
const classes = ref<ClassSummary[]>([]);
const errorMessage = ref<string | null>(null);

const showAddForm = ref(false);
const newCampusId = ref('');
const newAcademicSessionId = ref('');
const newName = ref('');
const isSaving = ref(false);

const editingId = ref<string | null>(null);
const editName = ref('');

async function load() {
  if (!auth.accessToken) return;
  try {
    [campuses.value, academicSessions.value, classes.value] = await Promise.all([
      api.listCampuses(auth.accessToken),
      api.listAcademicSessions(auth.accessToken),
      api.listClasses(auth.accessToken),
    ]);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load classes.';
  }
}
load();

async function onAdd() {
  if (!auth.accessToken || !newCampusId.value || !newAcademicSessionId.value || !newName.value.trim()) return;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createClass(auth.accessToken, {
      campusId: newCampusId.value,
      academicSessionId: newAcademicSessionId.value,
      name: newName.value.trim(),
    });
    newName.value = '';
    showAddForm.value = false;
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not create this class.';
  } finally {
    isSaving.value = false;
  }
}

function startEdit(klass: ClassSummary) {
  editingId.value = klass.id;
  editName.value = klass.name;
}

function cancelEdit() {
  editingId.value = null;
}

async function onSaveEdit(id: string) {
  if (!auth.accessToken || !editName.value.trim()) return;
  errorMessage.value = null;
  try {
    await api.updateClass(auth.accessToken, id, { name: editName.value.trim() });
    editingId.value = null;
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this class.';
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!(await confirm({ title: 'Delete this class?', message: 'This cannot be undone.', danger: true }))) return;
  errorMessage.value = null;
  try {
    await api.deleteClass(auth.accessToken, id);
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this class.';
  }
}
</script>

<template>
  <div class="org-entity">
    <div class="page-header">
      <h1>Classes</h1>
      <Button data-testid="open-add-form" @click="showAddForm = true">+ Add New</Button>
    </div>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <EntityTable
      :items="classes"
      :columns="[
        { key: 'name', label: 'Name' },
        { key: 'campusName', label: 'Campus' },
        { key: 'academicSessionLabel', label: 'Academic Session' },
      ]"
      row-key="id"
      :editing-id="editingId"
    >
      <template #cell-name="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-name-${item.id}`" v-model="editName" type="text" />
        <span v-else>{{ item.name }}</span>
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

    <AppModal v-model="showAddForm" title="Add Class">
      <div class="inline-form">
        <FormField
          v-model="newCampusId"
          label="Campus"
          type="select"
          data-testid="add-campus"
          placeholder="Choose a campus"
          :options="campuses.map((c) => ({ value: c.id, label: c.name }))"
        />
        <FormField
          v-model="newAcademicSessionId"
          label="Academic session"
          type="select"
          data-testid="add-session"
          placeholder="Choose an academic session"
          :options="academicSessions.map((s) => ({ value: s.id, label: s.label }))"
        />
        <FormField v-model="newName" label="Class name" type="text" data-testid="add-name" placeholder="e.g. Grade 4" grow />
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
