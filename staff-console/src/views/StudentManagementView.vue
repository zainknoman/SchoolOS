<!-- staff-console/src/views/StudentManagementView.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api, type SectionSummary, type ParentSummary, type StudentAdminSummary } from '../lib/api';
import { useFocusTarget } from '../lib/useFocusTarget';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import AppModal from '../components/AppModal.vue';
import { useConfirm } from '../lib/useConfirm';

const auth = useAuthStore();
const { confirm } = useConfirm();

const sections = ref<SectionSummary[]>([]);
const parents = ref<ParentSummary[]>([]);
const students = ref<StudentAdminSummary[]>([]);
const errorMessage = ref<string | null>(null);

const route = useRoute();
const showAddForm = ref(route.query.focus === 'gr-number');
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

const grNumberFieldRef = ref<{ focus(): void } | null>(null);
useFocusTarget({ 'gr-number': grNumberFieldRef });

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
    showAddForm.value = false;
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
  if (!(await confirm({ title: 'Delete this student?', message: 'This cannot be undone.', danger: true }))) return;
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
    <div class="page-header">
      <h1>Students</h1>
      <Button data-testid="open-add-form" @click="showAddForm = true">+ Add New</Button>
    </div>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <EntityTable
      :items="students"
      :columns="[
        { key: 'grNumber', label: 'GR Number' },
        { key: 'name', label: 'Name' },
        { key: 'sectionName', label: 'Section' },
        { key: 'parentNames', label: 'Parents' },
      ]"
      row-key="id"
      :editing-id="editingId"
    >
      <template #cell-grNumber="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-gr-${item.id}`" v-model="editGrNumber" type="text" />
        <span v-else>{{ item.grNumber }}</span>
      </template>
      <template #cell-name="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-name-${item.id}`" v-model="editName" type="text" />
        <span v-else>{{ item.name }}</span>
      </template>
      <template #cell-sectionName="{ item }">
        {{ item.sectionName ?? '—' }}
      </template>
      <template #cell-parentNames="{ item }">
        {{ item.parentNames.join(', ') || '—' }}
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

    <AppModal v-model="showAddForm" title="Add Student">
      <div class="add-form">
        <div class="inline-form">
          <FormField
            ref="grNumberFieldRef"
            v-model="newGrNumber"
            label="GR number"
            type="text"
            data-testid="add-gr-number"
            placeholder="GR number"
            grow
          />
          <FormField v-model="newName" label="Full name" type="text" data-testid="add-name" placeholder="Full name" grow />
          <FormField
            v-model="newSectionId"
            label="Section"
            type="select"
            data-testid="add-section"
            placeholder="Choose a section"
            :options="sections.map((sec) => ({ value: sec.id, label: `${sec.className} ${sec.name} (${sec.campusName})` }))"
          />
        </div>

        <FormField v-model="useNewParent" label="+ New Parent (instead of picking an existing one)" type="checkbox" data-testid="toggle-new-parent" />

        <div v-if="!useNewParent" class="inline-form">
          <FormField
            v-model="newParentProfileId"
            label="Parent"
            type="select"
            data-testid="add-parent-select"
            placeholder="Choose a parent"
            :options="parents.map((p) => ({ value: p.id, label: `${p.name} (${p.identifier})` }))"
          />
        </div>
        <div v-else class="inline-form">
          <FormField v-model="newParentIdentifier" label="Parent login email" type="text" data-testid="new-parent-identifier" placeholder="Parent login email" grow />
          <FormField v-model="newParentPassword" label="Initial password" type="password" data-testid="new-parent-password" placeholder="Initial password" grow />
          <FormField v-model="newParentName" label="Parent full name" type="text" data-testid="new-parent-name" placeholder="Parent full name" grow />
          <FormField v-model="newParentPhone" label="Phone" type="text" data-testid="new-parent-phone" placeholder="Phone (optional)" grow />
        </div>

        <Button data-testid="add-submit" :disabled="isSaving" @click="onAdd">Add Student</Button>
      </div>
    </AppModal>
  </div>
</template>

<style scoped>
.org-entity {
  max-width: 1100px;
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
.add-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.inline-form {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  flex-wrap: wrap;
}
</style>
