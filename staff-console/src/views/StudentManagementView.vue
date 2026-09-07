<!-- staff-console/src/views/StudentManagementView.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type SectionSummary, type ParentSummary, type StudentAdminSummary } from '../lib/api';
import { useFocusTarget } from '../lib/useFocusTarget';

const auth = useAuthStore();

const sections = ref<SectionSummary[]>([]);
const parents = ref<ParentSummary[]>([]);
const students = ref<StudentAdminSummary[]>([]);
const errorMessage = ref<string | null>(null);

const newGrNumber = ref('');
const newName = ref('');
const newSectionId = ref('');
const useNewParent = ref(false);
const newParentProfileId = ref('');
const newParentIdentifier = ref('');
const newParentPassword = ref('');
const newParentName = ref('');
const newParentPhone = ref('');
const isSaving = ref(false);

const grNumberInputRef = ref<HTMLInputElement | null>(null);
useFocusTarget({ 'gr-number': grNumberInputRef });

const editingId = ref<string | null>(null);
const editGrNumber = ref('');
const editName = ref('');

async function load() {
  if (!auth.accessToken) return;
  try {
    [sections.value, parents.value, students.value] = await Promise.all([
      api.listSections(auth.accessToken),
      api.listAdminParents(auth.accessToken),
      api.listAdminStudents(auth.accessToken),
    ]);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load students.';
  }
}
load();

function resetAddForm() {
  newGrNumber.value = '';
  newName.value = '';
  newSectionId.value = '';
  useNewParent.value = false;
  newParentProfileId.value = '';
  newParentIdentifier.value = '';
  newParentPassword.value = '';
  newParentName.value = '';
  newParentPhone.value = '';
}

async function onAdd() {
  if (!auth.accessToken || !newGrNumber.value.trim() || !newName.value.trim() || !newSectionId.value) return;
  if (useNewParent.value) {
    if (!newParentIdentifier.value.trim() || !newParentPassword.value || !newParentName.value.trim()) return;
  } else if (!newParentProfileId.value) {
    return;
  }
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createStudent(auth.accessToken, {
      grNumber: newGrNumber.value.trim(),
      name: newName.value.trim(),
      sectionId: newSectionId.value,
      ...(useNewParent.value
        ? {
            newParent: {
              identifier: newParentIdentifier.value.trim(),
              password: newParentPassword.value,
              name: newParentName.value.trim(),
              phone: newParentPhone.value.trim() || undefined,
            },
          }
        : { parentProfileId: newParentProfileId.value }),
    });
    resetAddForm();
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not create this student.';
  } finally {
    isSaving.value = false;
  }
}

function startEdit(student: StudentAdminSummary) {
  editingId.value = student.id;
  editGrNumber.value = student.grNumber;
  editName.value = student.name;
}

function cancelEdit() {
  editingId.value = null;
}

async function onSaveEdit(id: string) {
  if (!auth.accessToken || !editGrNumber.value.trim() || !editName.value.trim()) return;
  errorMessage.value = null;
  try {
    await api.updateStudent(auth.accessToken, id, {
      grNumber: editGrNumber.value.trim(),
      name: editName.value.trim(),
    });
    editingId.value = null;
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this student.';
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!window.confirm('Delete this student? This cannot be undone.')) return;
  errorMessage.value = null;
  try {
    await api.deleteStudent(auth.accessToken, id);
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this student.';
  }
}
</script>

<template>
  <div class="org-entity">
    <h1>Students</h1>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <table class="entity-table">
      <thead>
        <tr>
          <th>GR Number</th>
          <th>Name</th>
          <th>Section</th>
          <th>Parents</th>
          <th class="actions-col"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in students" :key="s.id">
          <template v-if="editingId === s.id">
            <td><input :data-testid="`edit-gr-${s.id}`" v-model="editGrNumber" type="text" /></td>
            <td><input :data-testid="`edit-name-${s.id}`" v-model="editName" type="text" /></td>
            <td>{{ s.sectionName ?? '—' }}</td>
            <td>{{ s.parentNames.join(', ') || '—' }}</td>
            <td class="actions-col">
              <button type="button" :data-testid="`save-${s.id}`" @click="onSaveEdit(s.id)">Save</button>
              <button type="button" class="secondary" @click="cancelEdit">Cancel</button>
            </td>
          </template>
          <template v-else>
            <td>{{ s.grNumber }}</td>
            <td>{{ s.name }}</td>
            <td>{{ s.sectionName ?? '—' }}</td>
            <td>{{ s.parentNames.join(', ') || '—' }}</td>
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

    <div class="add-form">
      <div class="inline-form">
        <input ref="grNumberInputRef" data-testid="add-gr-number" v-model="newGrNumber" type="text" placeholder="GR number" />
        <input data-testid="add-name" v-model="newName" type="text" placeholder="Full name" />
        <select data-testid="add-section" v-model="newSectionId">
          <option value="" disabled>Choose a section</option>
          <option v-for="sec in sections" :key="sec.id" :value="sec.id">
            {{ sec.className }} {{ sec.name }} ({{ sec.campusName }})
          </option>
        </select>
      </div>

      <label class="checkbox-row">
        <input data-testid="toggle-new-parent" v-model="useNewParent" type="checkbox" />
        + New Parent (instead of picking an existing one)
      </label>

      <div v-if="!useNewParent" class="inline-form">
        <select data-testid="add-parent-select" v-model="newParentProfileId">
          <option value="" disabled>Choose a parent</option>
          <option v-for="p in parents" :key="p.id" :value="p.id">{{ p.name }} ({{ p.identifier }})</option>
        </select>
      </div>
      <div v-else class="inline-form">
        <input data-testid="new-parent-identifier" v-model="newParentIdentifier" type="text" placeholder="Parent login email" />
        <input data-testid="new-parent-password" v-model="newParentPassword" type="password" placeholder="Initial password" />
        <input data-testid="new-parent-name" v-model="newParentName" type="text" placeholder="Parent full name" />
        <input data-testid="new-parent-phone" v-model="newParentPhone" type="text" placeholder="Phone (optional)" />
      </div>

      <button type="button" data-testid="add-submit" :disabled="isSaving" @click="onAdd">Add Student</button>
    </div>
  </div>
</template>

<style scoped>
.org-entity {
  max-width: 1100px;
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
.add-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
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
.checkbox-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: var(--font-size-sm);
}
button {
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-on-primary);
  font-weight: 600;
  cursor: pointer;
  align-self: flex-start;
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
