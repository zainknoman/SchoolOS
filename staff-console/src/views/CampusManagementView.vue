<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type CampusSummary, type SchoolSummary } from '../lib/api';

const auth = useAuthStore();

const schools = ref<SchoolSummary[]>([]);
const campuses = ref<CampusSummary[]>([]);
const errorMessage = ref<string | null>(null);

const newSchoolId = ref('');
const newName = ref('');
const isSaving = ref(false);

const editingId = ref<string | null>(null);
const editName = ref('');

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

async function onAdd() {
  if (!auth.accessToken || !newSchoolId.value || !newName.value.trim()) return;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createCampus(auth.accessToken, { schoolId: newSchoolId.value, name: newName.value.trim() });
    newName.value = '';
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not create this campus.';
  } finally {
    isSaving.value = false;
  }
}

function startEdit(campus: CampusSummary) {
  editingId.value = campus.id;
  editName.value = campus.name;
}

function cancelEdit() {
  editingId.value = null;
}

async function onSaveEdit(id: string) {
  if (!auth.accessToken || !editName.value.trim()) return;
  errorMessage.value = null;
  try {
    await api.updateCampus(auth.accessToken, id, { name: editName.value.trim() });
    editingId.value = null;
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this campus.';
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!window.confirm('Delete this campus? This cannot be undone.')) return;
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
    <h1>Campuses</h1>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <table class="entity-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>School</th>
          <th class="actions-col"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in campuses" :key="c.id">
          <template v-if="editingId === c.id">
            <td>
              <input :data-testid="`edit-name-${c.id}`" v-model="editName" type="text" />
            </td>
            <td>{{ c.schoolName }}</td>
            <td class="actions-col">
              <button type="button" :data-testid="`save-${c.id}`" @click="onSaveEdit(c.id)">Save</button>
              <button type="button" class="secondary" @click="cancelEdit">Cancel</button>
            </td>
          </template>
          <template v-else>
            <td>{{ c.name }}</td>
            <td>{{ c.schoolName }}</td>
            <td class="actions-col">
              <button type="button" :data-testid="`edit-${c.id}`" @click="startEdit(c)">Edit</button>
              <button type="button" class="secondary" :data-testid="`delete-${c.id}`" @click="onDelete(c.id)">
                Delete
              </button>
            </td>
          </template>
        </tr>
      </tbody>
    </table>

    <div class="inline-form">
      <select data-testid="add-school" v-model="newSchoolId">
        <option value="" disabled>Choose a school</option>
        <option v-for="s in schools" :key="s.id" :value="s.id">{{ s.name }}</option>
      </select>
      <input data-testid="add-name" v-model="newName" type="text" placeholder="Campus name" />
      <button type="button" data-testid="add-submit" :disabled="isSaving" @click="onAdd">Add</button>
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
  gap: var(--space-2);
}
.inline-form input,
.inline-form select {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
}
.inline-form input {
  flex: 1;
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
