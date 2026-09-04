<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type AcademicSessionSummary } from '../lib/api';

const auth = useAuthStore();

const sessions = ref<AcademicSessionSummary[]>([]);
const errorMessage = ref<string | null>(null);

const newLabel = ref('');
const newStart = ref('');
const newEnd = ref('');
const newActive = ref(false);
const isSaving = ref(false);

const editingId = ref<string | null>(null);
const editLabel = ref('');
const editStart = ref('');
const editEnd = ref('');
const editActive = ref(false);

async function load() {
  if (!auth.accessToken) return;
  try {
    sessions.value = await api.listAcademicSessions(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load academic sessions.';
  }
}
load();

async function onAdd() {
  if (!auth.accessToken || !newLabel.value.trim() || !newStart.value || !newEnd.value) return;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createAcademicSession(auth.accessToken, {
      label: newLabel.value.trim(),
      startDate: newStart.value,
      endDate: newEnd.value,
      isActive: newActive.value,
    });
    newLabel.value = '';
    newStart.value = '';
    newEnd.value = '';
    newActive.value = false;
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not create this academic session.';
  } finally {
    isSaving.value = false;
  }
}

function startEdit(session: AcademicSessionSummary) {
  editingId.value = session.id;
  editLabel.value = session.label;
  editStart.value = session.startDate;
  editEnd.value = session.endDate;
  editActive.value = session.isActive;
}

function cancelEdit() {
  editingId.value = null;
}

async function onSaveEdit(id: string) {
  if (!auth.accessToken || !editLabel.value.trim() || !editStart.value || !editEnd.value) return;
  errorMessage.value = null;
  try {
    await api.updateAcademicSession(auth.accessToken, id, {
      label: editLabel.value.trim(),
      startDate: editStart.value,
      endDate: editEnd.value,
      isActive: editActive.value,
    });
    editingId.value = null;
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this academic session.';
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!window.confirm('Delete this academic session? This cannot be undone.')) return;
  errorMessage.value = null;
  try {
    await api.deleteAcademicSession(auth.accessToken, id);
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this academic session.';
  }
}
</script>

<template>
  <div class="org-entity">
    <h1>Academic Sessions</h1>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <table class="entity-table">
      <thead>
        <tr>
          <th>Label</th>
          <th>Start</th>
          <th>End</th>
          <th>Active</th>
          <th class="actions-col"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in sessions" :key="s.id">
          <template v-if="editingId === s.id">
            <td><input :data-testid="`edit-label-${s.id}`" v-model="editLabel" type="text" /></td>
            <td><input :data-testid="`edit-start-${s.id}`" v-model="editStart" type="date" /></td>
            <td><input :data-testid="`edit-end-${s.id}`" v-model="editEnd" type="date" /></td>
            <td><input :data-testid="`edit-active-${s.id}`" v-model="editActive" type="checkbox" /></td>
            <td class="actions-col">
              <button type="button" :data-testid="`save-${s.id}`" @click="onSaveEdit(s.id)">Save</button>
              <button type="button" class="secondary" @click="cancelEdit">Cancel</button>
            </td>
          </template>
          <template v-else>
            <td>{{ s.label }}</td>
            <td>{{ s.startDate }}</td>
            <td>{{ s.endDate }}</td>
            <td>{{ s.isActive ? 'Active' : '—' }}</td>
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
      <input data-testid="add-label" v-model="newLabel" type="text" placeholder="e.g. 2027-2028" />
      <input data-testid="add-start" v-model="newStart" type="date" />
      <input data-testid="add-end" v-model="newEnd" type="date" />
      <label class="checkbox-row">
        <input data-testid="add-active" v-model="newActive" type="checkbox" />
        Active
      </label>
      <button type="button" data-testid="add-submit" :disabled="isSaving" @click="onAdd">Add</button>
    </div>
  </div>
</template>

<style scoped>
.org-entity {
  max-width: 900px;
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
.inline-form input[type='text'],
.inline-form input[type='date'] {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
}
.checkbox-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
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
