<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type SchoolSummary } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import { useConfirm } from '../lib/useConfirm';

const auth = useAuthStore();
const { confirm } = useConfirm();

const schools = ref<SchoolSummary[]>([]);
const errorMessage = ref<string | null>(null);

const newName = ref('');
const isSaving = ref(false);

const editingId = ref<string | null>(null);
const editName = ref('');

async function load() {
  if (!auth.accessToken) return;
  try {
    schools.value = await api.listSchools(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load schools.';
  }
}
load();

async function onAdd() {
  if (!auth.accessToken || !newName.value.trim()) return;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createSchool(auth.accessToken, { name: newName.value.trim() });
    newName.value = '';
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not create this school.';
  } finally {
    isSaving.value = false;
  }
}

function startEdit(school: SchoolSummary) {
  editingId.value = school.id;
  editName.value = school.name;
}

function cancelEdit() {
  editingId.value = null;
}

async function onSaveEdit(id: string) {
  if (!auth.accessToken || !editName.value.trim()) return;
  errorMessage.value = null;
  try {
    await api.updateSchool(auth.accessToken, id, { name: editName.value.trim() });
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
    <h1>Schools</h1>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <EntityTable :items="schools" :columns="[{ key: 'name', label: 'Name' }]" row-key="id" :editing-id="editingId">
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

    <div class="inline-form">
      <FormField v-model="newName" label="School name" type="text" data-testid="add-name" placeholder="School name" grow />
      <Button data-testid="add-submit" :disabled="isSaving" @click="onAdd">Add</Button>
    </div>
  </div>
</template>

<style scoped>
.org-entity {
  max-width: 720px;
}
.error {
  color: var(--color-destructive);
  margin-bottom: var(--space-3);
}
.inline-form {
  display: flex;
  gap: var(--space-2);
  align-items: flex-end;
}
</style>
