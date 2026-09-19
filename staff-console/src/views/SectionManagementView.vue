<!-- staff-console/src/views/SectionManagementView.vue -->
<script setup lang="ts">
import { ref, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type SectionSummary, type ClassSummary, type TeacherSummary } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import AppModal from '../components/AppModal.vue';
import ListPageCard from '../components/ListPageCard.vue';
import { useConfirm } from '../lib/useConfirm';
import { useToast } from '../lib/useToast';

const auth = useAuthStore();
const { confirm } = useConfirm();
const toast = useToast();

const classes = ref<ClassSummary[]>([]);
const addTeachers = ref<TeacherSummary[]>([]);
const editTeachers = ref<TeacherSummary[]>([]);
const sections = ref<SectionSummary[]>([]);
const errorMessage = ref<string | null>(null);

const showAddForm = ref(false);
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
    [classes.value, sections.value] = await Promise.all([
      api.listClasses(auth.accessToken),
      api.listSections(auth.accessToken),
    ]);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load sections.';
  }
}
load();

async function teachersForClass(classId: string | undefined): Promise<TeacherSummary[]> {
  const campusId = classes.value.find((c) => c.id === classId)?.campusId;
  if (!auth.accessToken || !campusId) return [];
  return api.listTeachers(auth.accessToken, campusId);
}

watch(newClassId, async (classId) => {
  newTeacherId.value = '';
  addTeachers.value = [];
  try {
    const list = await teachersForClass(classId || undefined);
    if (newClassId.value !== classId) return; // stale response: the class changed meanwhile
    addTeachers.value = list;
  } catch (err) {
    if (newClassId.value !== classId) return;
    addTeachers.value = [];
    errorMessage.value = err instanceof Error ? err.message : 'Could not load teachers.';
  }
});

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
    newClassId.value = '';
    newTeacherId.value = '';
    addTeachers.value = [];
    showAddForm.value = false;
    await load();
    toast.success('Section added.');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not create this section.';
  } finally {
    isSaving.value = false;
  }
}

async function startEdit(section: SectionSummary) {
  editingId.value = section.id;
  editName.value = section.name;
  editTeacherId.value = section.classTeacherId ?? '';
  const assigned: TeacherSummary[] =
    section.classTeacherId && section.classTeacherName
      ? [{ id: section.classTeacherId, name: section.classTeacherName }]
      : [];
  editTeachers.value = assigned;
  try {
    const list = await teachersForClass(section.classId);
    if (editingId.value !== section.id) return; // stale response: another row is being edited
    editTeachers.value = [...list, ...assigned.filter((a) => !list.some((t) => t.id === a.id))];
  } catch (err) {
    if (editingId.value !== section.id) return;
    editTeachers.value = assigned;
    errorMessage.value = err instanceof Error ? err.message : 'Could not load teachers.';
  }
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
    toast.success('Section updated.');
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
    toast.success('Section deleted.');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this section.';
  }
}
</script>

<template>
  <ListPageCard icon="notebook" title="Sections">
    <template #actions>
      <Button data-testid="open-add-form" @click="showAddForm = true">+ Add New</Button>
    </template>
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
          <option v-for="t in editTeachers" :key="t.id" :value="t.id">{{ t.name }}</option>
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

    <AppModal v-model="showAddForm" title="Add Section">
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
          :options="newClassId
            ? [{ value: '', label: '— No class teacher —' }, ...addTeachers.map((t) => ({ value: t.id, label: t.name }))]
            : [{ value: '', label: 'Choose a class first' }]"
        />
        <Button data-testid="add-submit" :disabled="isSaving" @click="onAdd">Add</Button>
      </div>
    </AppModal>
  </ListPageCard>
</template>

<style scoped>
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
