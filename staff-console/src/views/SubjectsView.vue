<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type SchoolSummary, type SubjectSummary } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import AppModal from '../components/AppModal.vue';
import ListPageCard from '../components/ListPageCard.vue';
import StatusPill from '../components/StatusPill.vue';
import { useConfirm } from '../lib/useConfirm';
import { useToast } from '../lib/useToast';

// BL-02: each school manages its own subjects. A subject that is in use is deactivated (hidden
// from pickers, history kept) — only an unused one can be deleted.
const auth = useAuthStore();
const { confirm } = useConfirm();
const toast = useToast();
const isSuperAdmin = auth.role === 'SUPER_ADMIN';

const subjects = ref<SubjectSummary[]>([]);
const schools = ref<SchoolSummary[]>([]);
const errorMessage = ref<string | null>(null);
const showAddForm = ref(false);
const newName = ref('');
const newSchoolId = ref('');
const isSaving = ref(false);
const editingId = ref<string | null>(null);
const editName = ref('');

const rows = computed(() =>
  subjects.value.map((s) => ({
    ...s,
    status: s.isActive === false ? 'Inactive' : 'Active',
    school: schools.value.find((x) => x.id === s.schoolId)?.name ?? (s.schoolId ? '—' : 'Unassigned (legacy)'),
  })),
);

async function load() {
  if (!auth.accessToken) return;
  try {
    subjects.value = await api.listSubjects(auth.accessToken, { includeInactive: true });
    if (isSuperAdmin && schools.value.length === 0) schools.value = await api.listSchools(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load subjects.';
  }
}
load();

async function onAdd() {
  if (!auth.accessToken || !newName.value.trim()) return;
  if (isSuperAdmin && !newSchoolId.value) {
    errorMessage.value = 'Choose the school this subject belongs to.';
    return;
  }
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createSubject(auth.accessToken, {
      name: newName.value.trim(),
      ...(isSuperAdmin ? { schoolId: newSchoolId.value } : {}),
    });
    newName.value = '';
    showAddForm.value = false;
    await load();
    toast.success('Subject added.');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not create this subject.';
  } finally {
    isSaving.value = false;
  }
}

function startEdit(subject: SubjectSummary) {
  editingId.value = subject.id;
  editName.value = subject.name;
}

async function onSaveEdit(id: string) {
  if (!auth.accessToken || !editName.value.trim()) return;
  errorMessage.value = null;
  try {
    await api.updateSubject(auth.accessToken, id, { name: editName.value.trim() });
    editingId.value = null;
    await load();
    toast.success('Subject renamed.');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not rename this subject.';
  }
}

async function onToggleActive(subject: SubjectSummary) {
  if (!auth.accessToken) return;
  errorMessage.value = null;
  try {
    await api.updateSubject(auth.accessToken, subject.id, { isActive: subject.isActive === false });
    await load();
    toast.success(subject.isActive === false ? 'Subject reactivated.' : 'Subject deactivated.');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this subject.';
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!(await confirm({ title: 'Delete this subject?', message: 'Only an unused subject can be deleted.', danger: true })))
    return;
  errorMessage.value = null;
  try {
    await api.deleteSubject(auth.accessToken, id);
    await load();
    toast.success('Subject deleted.');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this subject.';
  }
}
</script>

<template>
  <ListPageCard icon="grid" title="Subjects" subtitle="Your school's subjects, reusable across campuses and classes">
    <template #actions>
      <Button data-testid="open-add-form" @click="showAddForm = true">+ Add New</Button>
    </template>
    <p v-if="errorMessage" class="error" role="alert" data-testid="subjects-error">{{ errorMessage }}</p>

    <EntityTable
      :items="rows"
      :columns="[
        { key: 'name', label: 'Subject' },
        ...(isSuperAdmin ? [{ key: 'school', label: 'School' }] : []),
        { key: 'status', label: 'Status' },
      ]"
      row-key="id"
      :editing-id="editingId"
      empty-icon="grid"
      empty-title="No subjects yet"
      empty-message="Add the subjects your school teaches."
      empty-cta-label="+ Add New"
      @empty-cta="showAddForm = true"
    >
      <template #cell-name="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-name-${item.id}`" v-model="editName" type="text" />
        <span v-else>{{ item.name }}</span>
      </template>
      <template #cell-status="{ item }">
        <StatusPill :tone="item.isActive === false ? 'neutral' : 'success'" :label="item.status" />
      </template>
      <template #actions="{ item, editing }">
        <template v-if="editing">
          <Button :data-testid="`save-${item.id}`" @click="onSaveEdit(item.id)">Save</Button>
          <Button variant="secondary" @click="editingId = null">Cancel</Button>
        </template>
        <template v-else>
          <Button variant="secondary" :data-testid="`edit-${item.id}`" @click="startEdit(item)">Rename</Button>
          <Button variant="secondary" :data-testid="`toggle-${item.id}`" @click="onToggleActive(item)">
            {{ item.isActive === false ? 'Reactivate' : 'Deactivate' }}
          </Button>
          <Button variant="secondary" :data-testid="`delete-${item.id}`" @click="onDelete(item.id)">Delete</Button>
        </template>
      </template>
    </EntityTable>

    <AppModal v-model="showAddForm" title="Add Subject">
      <div class="inline-form">
        <FormField v-model="newName" label="Subject name" type="text" data-testid="add-name" placeholder="e.g. Physics" grow />
        <FormField
          v-if="isSuperAdmin"
          v-model="newSchoolId"
          label="School"
          type="select"
          data-testid="add-school"
          placeholder="Choose a school"
          :options="schools.map((s) => ({ value: s.id, label: s.name }))"
        />
        <Button data-testid="add-submit" :disabled="isSaving" @click="onAdd">Add</Button>
      </div>
    </AppModal>
  </ListPageCard>
</template>

<style scoped>
.error {
  color: var(--color-destructive);
}
.inline-form {
  display: flex;
  gap: var(--space-2);
  align-items: flex-end;
  flex-wrap: wrap;
}
</style>
