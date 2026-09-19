<script setup lang="ts">
import { ref, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type TermSummary, type AcademicSessionSummary } from '../lib/api';
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

const academicSessions = ref<AcademicSessionSummary[]>([]);
const selectedSessionId = ref('');
const terms = ref<TermSummary[]>([]);
const errorMessage = ref<string | null>(null);

const showAddForm = ref(false);
const newLabel = ref('');
const newOrder = ref('');
const newStartDate = ref('');
const newEndDate = ref('');
const isSaving = ref(false);

const editingId = ref<string | null>(null);
const editLabel = ref('');
const editOrder = ref('');
const editStartDate = ref('');
const editEndDate = ref('');

async function loadSessions() {
  if (!auth.accessToken) return;
  try {
    academicSessions.value = await api.listAcademicSessions(auth.accessToken);
    if (!selectedSessionId.value && academicSessions.value.length > 0) {
      selectedSessionId.value = academicSessions.value[0]!.id;
    }
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load academic sessions.';
  }
}

async function loadTerms() {
  if (!auth.accessToken || !selectedSessionId.value) return;
  try {
    terms.value = await api.listTerms(auth.accessToken, selectedSessionId.value);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load terms.';
  }
}

watch(selectedSessionId, () => {
  loadTerms();
});

loadSessions().then(loadTerms);

async function onAdd() {
  if (!auth.accessToken || !selectedSessionId.value || !newLabel.value.trim() || !newOrder.value || !newStartDate.value || !newEndDate.value) return;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createTerm(auth.accessToken, {
      academicSessionId: selectedSessionId.value,
      label: newLabel.value.trim(),
      order: Number(newOrder.value),
      startDate: newStartDate.value,
      endDate: newEndDate.value,
    });
    newLabel.value = '';
    newOrder.value = '';
    newStartDate.value = '';
    newEndDate.value = '';
    showAddForm.value = false;
    await loadTerms();
    toast.success('Term added.');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not create this term.';
  } finally {
    isSaving.value = false;
  }
}

function startEdit(term: TermSummary) {
  editingId.value = term.id;
  editLabel.value = term.label;
  editOrder.value = String(term.order);
  editStartDate.value = term.startDate;
  editEndDate.value = term.endDate;
}

function cancelEdit() {
  editingId.value = null;
}

async function onSaveEdit(id: string) {
  if (!auth.accessToken || !editLabel.value.trim()) return;
  errorMessage.value = null;
  try {
    await api.updateTerm(auth.accessToken, id, {
      label: editLabel.value.trim(),
      order: Number(editOrder.value),
      startDate: editStartDate.value,
      endDate: editEndDate.value,
    });
    editingId.value = null;
    await loadTerms();
    toast.success('Term updated.');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this term.';
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!(await confirm({ title: 'Delete this term?', message: 'This cannot be undone.', danger: true }))) return;
  errorMessage.value = null;
  try {
    await api.deleteTerm(auth.accessToken, id);
    await loadTerms();
    toast.success('Term deleted.');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this term.';
  }
}
</script>

<template>
  <ListPageCard icon="calendar" title="Terms">
    <template #actions>
      <Button data-testid="open-add-form" @click="showAddForm = true">+ Add New</Button>
    </template>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <FormField
      v-model="selectedSessionId"
      label="Academic session"
      hide-label
      type="select"
      data-testid="select-academic-session"
      placeholder="Select academic session"
      :options="academicSessions.map((s) => ({ value: s.id, label: s.label }))"
    />

    <EntityTable
      :items="terms"
      :columns="[
        { key: 'label', label: 'Label' },
        { key: 'order', label: 'Order' },
        { key: 'startDate', label: 'Start' },
        { key: 'endDate', label: 'End' },
      ]"
      row-key="id"
      :editing-id="editingId"
    >
      <template #cell-label="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-label-${item.id}`" v-model="editLabel" type="text" />
        <span v-else>{{ item.label }}</span>
      </template>
      <template #cell-order="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-order-${item.id}`" v-model="editOrder" type="text" />
        <span v-else>{{ item.order }}</span>
      </template>
      <template #cell-startDate="{ item, editing }">
        <input v-if="editing" v-model="editStartDate" type="date" />
        <span v-else>{{ item.startDate }}</span>
      </template>
      <template #cell-endDate="{ item, editing }">
        <input v-if="editing" v-model="editEndDate" type="date" />
        <span v-else>{{ item.endDate }}</span>
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

    <AppModal v-model="showAddForm" title="Add Term">
      <div class="inline-form">
        <FormField v-model="newLabel" label="Label" type="text" data-testid="add-label" placeholder="e.g. Term 1" grow />
        <FormField v-model="newOrder" label="Order" type="text" data-testid="add-order" placeholder="1" />
        <FormField v-model="newStartDate" label="Start date" type="date" data-testid="add-start-date" />
        <FormField v-model="newEndDate" label="End date" type="date" data-testid="add-end-date" />
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
  gap: var(--space-2);
  align-items: flex-end;
  flex-wrap: wrap;
}
</style>
