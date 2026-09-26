<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type AcademicSessionSummary, type SchoolSummary } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import AppModal from '../components/AppModal.vue';
import ListPageCard from '../components/ListPageCard.vue';
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
// BL-01: each school runs its own calendar — a session is created for one school.
const schools = ref<SchoolSummary[]>([]);
// BL-33: school admins may view and copy structure; creating/editing/deleting stays super-admin only.
const isSuperAdmin = auth.role === 'SUPER_ADMIN';
const copyTargetId = ref<string | null>(null);
const copySourceId = ref('');
const isCopying = ref(false);
const copyTarget = computed(() => sessions.value.find((s) => s.id === copyTargetId.value) ?? null);
const copySources = computed(() =>
  sessions.value.filter((s) => s.id !== copyTargetId.value && s.schoolId === copyTarget.value?.schoolId),
);

function openCopy(session: AcademicSessionSummary) {
  copyTargetId.value = session.id;
  copySourceId.value = sessions.value.find((s) => s.isActive && s.id !== session.id && s.schoolId === session.schoolId)?.id ?? '';
}

async function onCopy() {
  if (!auth.accessToken || !copyTargetId.value || !copySourceId.value) return;
  errorMessage.value = null;
  isCopying.value = true;
  try {
    const r = await api.copySessionStructure(auth.accessToken, copyTargetId.value, copySourceId.value);
    copyTargetId.value = null;
    toast.success(
      `Copied: ${r.classesCreated} class(es), ${r.sectionsCreated} section(s), ${r.termsCreated ?? 0} term(s), ` +
        `${r.assessmentCategoriesCreated ?? 0} categor(ies), ${r.syllabiCreated ?? 0} syllab(i), ${r.timetableEntriesCreated ?? 0} timetable slot(s)` +
        (r.timetableEntriesSkipped ? ` (${r.timetableEntriesSkipped} skipped: teacher/room already booked)` : '') +
        '.',
    );
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not copy the structure.';
  } finally {
    isCopying.value = false;
  }
}
const newSchoolId = ref('');
const isSaving = ref(false);
const schoolName = (id: string | null | undefined) =>
  id ? (schools.value.find((s) => s.id === id)?.name ?? '—') : 'Unassigned (legacy)';

const editingId = ref<string | null>(null);
const editLabel = ref('');
const editStart = ref('');
const editEnd = ref('');
const editActive = ref(false);

async function load() {
  if (!auth.accessToken) return;
  try {
    [sessions.value, schools.value] = await Promise.all([
      api.listAcademicSessions(auth.accessToken),
      isSuperAdmin ? api.listSchools(auth.accessToken) : Promise.resolve([]),
    ]);
    const only = schools.value.length === 1 ? schools.value[0] : undefined;
    if (!newSchoolId.value && only) newSchoolId.value = only.id;
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load academic sessions.';
  }
}
load();

async function onAdd() {
  if (!auth.accessToken || !newLabel.value.trim() || !newStart.value || !newEnd.value) return;
  if (!newSchoolId.value) {
    errorMessage.value = 'Choose the school this session belongs to.';
    return;
  }
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createAcademicSession(auth.accessToken, {
      label: newLabel.value.trim(),
      startDate: newStart.value,
      endDate: newEnd.value,
      isActive: newActive.value,
      schoolId: newSchoolId.value,
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
  <ListPageCard icon="clock" title="Academic Sessions">
    <template #actions>
      <Button v-if="isSuperAdmin" data-testid="open-add-form" @click="showAddForm = true">+ Add New</Button>
    </template>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <EntityTable
      :items="sessions"
      :columns="[
        { key: 'label', label: 'Label' },
        { key: 'schoolId', label: 'School' },
        { key: 'startDate', label: 'Start' },
        { key: 'endDate', label: 'End' },
        { key: 'isActive', label: 'Active' },
      ]"
      row-key="id"
      :editing-id="editingId"
    >
      <template #cell-schoolId="{ item }">
        <span>{{ schoolName(item.schoolId) }}</span>
      </template>
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
          <Button variant="secondary" :data-testid="`copy-${item.id}`" @click="openCopy(item)">Copy structure here</Button>
          <template v-if="isSuperAdmin">
            <Button :data-testid="`edit-${item.id}`" @click="startEdit(item)">Edit</Button>
            <Button variant="secondary" :data-testid="`delete-${item.id}`" @click="onDelete(item.id)">
              Delete
            </Button>
          </template>
        </template>
      </template>
    </EntityTable>

    <AppModal
      :model-value="copyTargetId !== null"
      :title="`Copy structure into ${copyTarget?.label ?? ''}`"
      @update:model-value="(open: boolean) => { if (!open) copyTargetId = null; }"
    >
      <p class="muted">
        Creates, in this session only, the classes, sections, terms, assessment categories and timetable of the
        source session. Nothing in the source session changes; running it again creates nothing new.
      </p>
      <div class="inline-form">
        <FormField
          v-model="copySourceId"
          label="Copy from"
          type="select"
          data-testid="copy-source"
          placeholder="Choose a session"
          :options="copySources.map((s) => ({ value: s.id, label: s.label }))"
        />
        <Button data-testid="copy-submit" :disabled="isCopying || !copySourceId" @click="onCopy">Copy</Button>
      </div>
    </AppModal>

    <AppModal v-model="showAddForm" title="Add Academic Session">
      <div class="inline-form">
        <FormField
          v-model="newSchoolId"
          label="School"
          type="select"
          data-testid="add-school"
          placeholder="Choose a school"
          :options="schools.map((s) => ({ value: s.id, label: s.name }))"
        />
        <FormField v-model="newLabel" label="Session label" type="text" data-testid="add-label" placeholder="e.g. 2027-2028" />
        <FormField v-model="newStart" label="Start date" type="date" data-testid="add-start" />
        <FormField v-model="newEnd" label="End date" type="date" data-testid="add-end" />
        <FormField v-model="newActive" label="Active" type="checkbox" data-testid="add-active" />
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
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
</style>
