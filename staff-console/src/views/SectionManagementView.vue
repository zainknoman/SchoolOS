<!-- staff-console/src/views/SectionManagementView.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type SectionSummary, type ClassSummary, type TeacherSummary } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import { useConfirm } from '../lib/useConfirm';

const auth = useAuthStore();
const { confirm } = useConfirm();

const classes = ref<ClassSummary[]>([]);
const teachers = ref<TeacherSummary[]>([]);
const sections = ref<SectionSummary[]>([]);
const errorMessage = ref<string | null>(null);

const newClassId = ref('');
const newName = ref('');
const newTeacherId = ref('');
const isSaving = ref(false);

const editingId = ref<string | null>(null);
const editName = ref('');
const editTeacherId = ref('');

async function load() {
  if (!auth.accessToken) return;
  try {
    [classes.value, teachers.value, sections.value] = await Promise.all([
      api.listClasses(auth.accessToken),
      api.listTeachers(auth.accessToken),
      api.listSections(auth.accessToken),
    ]);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load sections.';
  }
}
load();

async function onAdd() {
  if (!auth.accessToken || !newClassId.value || !newName.value.trim()) return;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createSection(auth.accessToken, {
      classId: newClassId.value,
      name: newName.value.trim(),
      classTeacherId: newTeacherId.value || undefined,
    });
    newName.value = '';
    newTeacherId.value = '';
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not create this section.';
  } finally {
    isSaving.value = false;
  }
}

function startEdit(section: SectionSummary) {
  editingId.value = section.id;
  editName.value = section.name;
  editTeacherId.value = section.classTeacherId ?? '';
}

function cancelEdit() {
  editingId.value = null;
}

async function onSaveEdit(id: string) {
  if (!auth.accessToken || !editName.value.trim()) return;
  errorMessage.value = null;
  try {
    await api.updateSection(auth.accessToken, id, {
      name: editName.value.trim(),
      classTeacherId: editTeacherId.value || null,
    });
    editingId.value = null;
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this section.';
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!(await confirm({ title: 'Delete this section?', message: 'This cannot be undone.', danger: true }))) return;
  errorMessage.value = null;
  try {
    await api.deleteSection(auth.accessToken, id);
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this section.';
  }
}
</script>

<template>
  <div class="org-entity">
    <h1>Sections</h1>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <EntityTable
      :items="sections"
      :columns="[
        { key: 'name', label: 'Name' },
        { key: 'className', label: 'Class' },
        { key: 'campusName', label: 'Campus' },
        { key: 'classTeacherName', label: 'Class Teacher' },
      ]"
      row-key="id"
      :editing-id="editingId"
    >
      <template #cell-name="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-name-${item.id}`" v-model="editName" type="text" />
        <span v-else>{{ item.name }}</span>
      </template>
      <template #cell-classTeacherName="{ item, editing }">
        <select v-if="editing" :data-testid="`edit-teacher-${item.id}`" v-model="editTeacherId">
          <option value="">— None —</option>
          <option v-for="t in teachers" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
        <span v-else>{{ item.classTeacherName ?? '— None —' }}</span>
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
      <FormField
        v-model="newClassId"
        label="Class"
        type="select"
        data-testid="add-class"
        placeholder="Choose a class"
        :options="classes.map((c) => ({ value: c.id, label: `${c.name} (${c.campusName})` }))"
      />
      <FormField v-model="newName" label="Section name" type="text" data-testid="add-name" placeholder="e.g. 3B" grow />
      <FormField
        v-model="newTeacherId"
        label="Class teacher"
        type="select"
        data-testid="add-teacher"
        :options="[{ value: '', label: '— No class teacher —' }, ...teachers.map((t) => ({ value: t.id, label: t.name }))]"
      />
      <Button data-testid="add-submit" :disabled="isSaving" @click="onAdd">Add</Button>
    </div>
  </div>
</template>

<style scoped>
.org-entity {
  max-width: 960px;
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
