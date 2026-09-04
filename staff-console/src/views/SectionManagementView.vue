<!-- staff-console/src/views/SectionManagementView.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type SectionSummary, type ClassSummary, type TeacherSummary } from '../lib/api';

const auth = useAuthStore();

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
  if (!window.confirm('Delete this section? This cannot be undone.')) return;
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

    <table class="entity-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Class</th>
          <th>Campus</th>
          <th>Class Teacher</th>
          <th class="actions-col"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in sections" :key="s.id">
          <template v-if="editingId === s.id">
            <td><input :data-testid="`edit-name-${s.id}`" v-model="editName" type="text" /></td>
            <td>{{ s.className }}</td>
            <td>{{ s.campusName }}</td>
            <td>
              <select :data-testid="`edit-teacher-${s.id}`" v-model="editTeacherId">
                <option value="">— None —</option>
                <option v-for="t in teachers" :key="t.id" :value="t.id">{{ t.name }}</option>
              </select>
            </td>
            <td class="actions-col">
              <button type="button" :data-testid="`save-${s.id}`" @click="onSaveEdit(s.id)">Save</button>
              <button type="button" class="secondary" @click="cancelEdit">Cancel</button>
            </td>
          </template>
          <template v-else>
            <td>{{ s.name }}</td>
            <td>{{ s.className }}</td>
            <td>{{ s.campusName }}</td>
            <td>{{ s.classTeacherName ?? '— None —' }}</td>
            <td class="actions-col">
              <button type="button" :data-testid="`edit-${s.id}`" @click="startEdit(s)">Edit</button>
              <button type="button" class="secondary" :data-testid="`delete-${s.id}`" @click="onDelete(s.id)">
                Delete
              </button>
            </td>
          </template>
        </tr>
      </tbody>
    </table>

    <div class="inline-form">
      <select data-testid="add-class" v-model="newClassId">
        <option value="" disabled>Choose a class</option>
        <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }} ({{ c.campusName }})</option>
      </select>
      <input data-testid="add-name" v-model="newName" type="text" placeholder="e.g. 3B" />
      <select data-testid="add-teacher" v-model="newTeacherId">
        <option value="">— No class teacher —</option>
        <option v-for="t in teachers" :key="t.id" :value="t.id">{{ t.name }}</option>
      </select>
      <button type="button" data-testid="add-submit" :disabled="isSaving" @click="onAdd">Add</button>
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
.entity-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: var(--space-4);
}
.entity-table th,
.entity-table td {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
}
.actions-col {
  width: 1%;
  white-space: nowrap;
  display: flex;
  gap: var(--space-2);
}
.inline-form {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.inline-form input,
.inline-form select {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
}
button {
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-on-primary);
  font-weight: 600;
  cursor: pointer;
}
button.secondary {
  background: transparent;
  color: var(--color-destructive);
  border: 1px solid var(--color-destructive);
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
