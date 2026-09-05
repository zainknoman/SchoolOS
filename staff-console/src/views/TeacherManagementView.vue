<!-- staff-console/src/views/TeacherManagementView.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type TeacherAdminSummary } from '../lib/api';

const auth = useAuthStore();

const teachers = ref<TeacherAdminSummary[]>([]);
const errorMessage = ref<string | null>(null);

const newIdentifier = ref('');
const newPassword = ref('');
const newName = ref('');
const isSaving = ref(false);

const editingId = ref<string | null>(null);
const editName = ref('');
const editPassword = ref('');

async function load() {
  if (!auth.accessToken) return;
  try {
    teachers.value = await api.listAdminTeachers(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load teachers.';
  }
}
load();

async function onAdd() {
  if (!auth.accessToken || !newIdentifier.value.trim() || !newPassword.value || !newName.value.trim()) return;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createTeacher(auth.accessToken, {
      identifier: newIdentifier.value.trim(),
      password: newPassword.value,
      name: newName.value.trim(),
    });
    newIdentifier.value = '';
    newPassword.value = '';
    newName.value = '';
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
  if (!window.confirm('Delete this teacher? This cannot be undone.')) return;
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
    <h1>Teachers</h1>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <table class="entity-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Login</th>
          <th class="actions-col"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="t in teachers" :key="t.id">
          <template v-if="editingId === t.id">
            <td><input :data-testid="`edit-name-${t.id}`" v-model="editName" type="text" /></td>
            <td>
              {{ t.identifier }}
              <input
                :data-testid="`edit-password-${t.id}`"
                v-model="editPassword"
                type="password"
                placeholder="New password (leave blank to keep)"
              />
            </td>
            <td class="actions-col">
              <button type="button" :data-testid="`save-${t.id}`" @click="onSaveEdit(t.id)">Save</button>
              <button type="button" class="secondary" @click="cancelEdit">Cancel</button>
            </td>
          </template>
          <template v-else>
            <td>{{ t.name }}</td>
            <td>{{ t.identifier }}</td>
            <td class="actions-col">
              <button type="button" :data-testid="`edit-${t.id}`" @click="startEdit(t)">Edit</button>
              <button type="button" class="secondary" :data-testid="`delete-${t.id}`" @click="onDelete(t.id)">
                Delete
              </button>
            </td>
          </template>
        </tr>
      </tbody>
    </table>

    <div class="inline-form">
      <input data-testid="add-identifier" v-model="newIdentifier" type="text" placeholder="Login email" />
      <input data-testid="add-password" v-model="newPassword" type="password" placeholder="Initial password" />
      <input data-testid="add-name" v-model="newName" type="text" placeholder="Full name" />
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
.inline-form input {
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
