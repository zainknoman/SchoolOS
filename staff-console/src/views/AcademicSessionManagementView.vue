<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type AcademicSessionSummary } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import AppModal from '../components/AppModal.vue';
import StatusPill from '../components/StatusPill.vue';
import { useConfirm } from '../lib/useConfirm';
import { useToast } from '../lib/useToast';

const auth = useAuthStore();
const { confirm } = useConfirm();
const toast = useToast();

const sessions = ref<AcademicSessionSummary[]>([]);
const errorMessage = ref<string | null>(null);

const showAddForm = ref(false);
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
    showAddForm.value = false;
    await load();
    toast.success('Academic session added.');
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
    toast.success('Academic session updated.');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this academic session.';
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (
    !(await confirm({ title: 'Delete this academic session?', message: 'This cannot be undone.', danger: true }))
  )
    return;
  errorMessage.value = null;
  try {
    await api.deleteAcademicSession(auth.accessToken, id);
    await load();
    toast.success('Academic session deleted.');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this academic session.';
  }
}
</script>

<template>
  <div class="org-entity">
    <div class="page-header">
      <h1>Academic Sessions</h1>
      <Button data-testid="open-add-form" @click="showAddForm = true">+ Add New</Button>
    </div>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <EntityTable
      :items="sessions"
      :columns="[
        { key: 'label', label: 'Label' },
        { key: 'startDate', label: 'Start' },
        { key: 'endDate', label: 'End' },
        { key: 'isActive', label: 'Active' },
      ]"
      row-key="id"
      :editing-id="editingId"
    >
      <template #cell-label="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-label-${item.id}`" v-model="editLabel" type="text" />
        <span v-else>{{ item.label }}</span>
      </template>
      <template #cell-startDate="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-start-${item.id}`" v-model="editStart" type="date" />
        <span v-else>{{ item.startDate }}</span>
      </template>
      <template #cell-endDate="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-end-${item.id}`" v-model="editEnd" type="date" />
        <span v-else>{{ item.endDate }}</span>
      </template>
      <template #cell-isActive="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-active-${item.id}`" v-model="editActive" type="checkbox" />
        <StatusPill v-else :tone="item.isActive ? 'success' : 'neutral'" :label="item.isActive ? 'Active' : 'Inactive'" />
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

    <AppModal v-model="showAddForm" title="Add Academic Session">
      <div class="inline-form">
        <FormField v-model="newLabel" label="Session label" type="text" data-testid="add-label" placeholder="e.g. 2027-2028" />
        <FormField v-model="newStart" label="Start date" type="date" data-testid="add-start" />
        <FormField v-model="newEnd" label="End date" type="date" data-testid="add-end" />
        <FormField v-model="newActive" label="Active" type="checkbox" data-testid="add-active" />
        <Button data-testid="add-submit" :disabled="isSaving" @click="onAdd">Add</Button>
      </div>
    </AppModal>
  </div>
</template>

<style scoped>
.org-entity {
  max-width: 900px;
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
.inline-form {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
</style>
