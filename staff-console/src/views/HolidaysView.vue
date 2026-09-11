<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type HolidaySummary, type CampusSummary } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import { useConfirm } from '../lib/useConfirm';

const auth = useAuthStore();
const { confirm } = useConfirm();

const holidays = ref<HolidaySummary[]>([]);
const campuses = ref<CampusSummary[]>([]);
const errorMessage = ref<string | null>(null);

const newTitle = ref('');
const newStartDate = ref('');
const newEndDate = ref('');
const newCampusId = ref('');
const isSaving = ref(false);

const editingId = ref<string | null>(null);
const editTitle = ref('');
const editStartDate = ref('');
const editEndDate = ref('');

async function load() {
  if (!auth.accessToken) return;
  try {
    [holidays.value, campuses.value] = await Promise.all([
      api.listHolidays(auth.accessToken),
      api.listCampuses(auth.accessToken),
    ]);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load holidays.';
  }
}
load();

function campusName(id: string | null): string {
  if (!id) return 'Every campus';
  return campuses.value.find((c) => c.id === id)?.name ?? id;
}

async function onAdd() {
  if (!auth.accessToken || !newTitle.value.trim() || !newStartDate.value || !newEndDate.value) return;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createHoliday(auth.accessToken, {
      title: newTitle.value.trim(),
      startDate: newStartDate.value,
      endDate: newEndDate.value,
      campusId: newCampusId.value || undefined,
    });
    newTitle.value = '';
    newStartDate.value = '';
    newEndDate.value = '';
    newCampusId.value = '';
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not create this holiday.';
  } finally {
    isSaving.value = false;
  }
}

function startEdit(holiday: HolidaySummary) {
  editingId.value = holiday.id;
  editTitle.value = holiday.title;
  editStartDate.value = holiday.startDate;
  editEndDate.value = holiday.endDate;
}

function cancelEdit() {
  editingId.value = null;
}

async function onSaveEdit(id: string) {
  if (!auth.accessToken || !editTitle.value.trim()) return;
  errorMessage.value = null;
  try {
    await api.updateHoliday(auth.accessToken, id, {
      title: editTitle.value.trim(),
      startDate: editStartDate.value,
      endDate: editEndDate.value,
    });
    editingId.value = null;
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this holiday.';
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!(await confirm({ title: 'Delete this holiday?', message: 'This cannot be undone.', danger: true }))) return;
  errorMessage.value = null;
  try {
    await api.deleteHoliday(auth.accessToken, id);
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this holiday.';
  }
}
</script>

<template>
  <div class="org-entity">
    <h1>Holidays</h1>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <EntityTable
      :items="holidays"
      :columns="[
        { key: 'title', label: 'Title' },
        { key: 'startDate', label: 'Start' },
        { key: 'endDate', label: 'End' },
        { key: 'campusId', label: 'Campus' },
      ]"
      row-key="id"
      :editing-id="editingId"
    >
      <template #cell-title="{ item, editing }">
        <input v-if="editing" :data-testid="`edit-title-${item.id}`" v-model="editTitle" type="text" />
        <span v-else>{{ item.title }}</span>
      </template>
      <template #cell-startDate="{ item, editing }">
        <input v-if="editing" v-model="editStartDate" type="date" />
        <span v-else>{{ item.startDate }}</span>
      </template>
      <template #cell-endDate="{ item, editing }">
        <input v-if="editing" v-model="editEndDate" type="date" />
        <span v-else>{{ item.endDate }}</span>
      </template>
      <template #cell-campusId="{ item }">
        <span>{{ campusName(item.campusId) }}</span>
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

    <div class="inline-form">
      <FormField v-model="newTitle" label="Title" type="text" data-testid="add-title" placeholder="e.g. Eid break" grow />
      <FormField v-model="newStartDate" label="Start date" type="date" data-testid="add-start-date" />
      <FormField v-model="newEndDate" label="End date" type="date" data-testid="add-end-date" />
      <FormField
        v-model="newCampusId"
        label="Campus"
        type="select"
        data-testid="add-campus"
        placeholder="Every campus"
        :options="campuses.map((c) => ({ value: c.id, label: c.name }))"
      />
      <Button data-testid="add-submit" :disabled="isSaving" @click="onAdd">Add</Button>
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
.inline-form {
  display: flex;
  gap: var(--space-2);
  align-items: flex-end;
  flex-wrap: wrap;
}
</style>
