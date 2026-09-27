<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import {
  api,
  type ComplaintCategory,
  type ComplaintPerson,
  type ComplaintStatus,
  type ComplaintSummary,
  type StudentAdminSummary,
} from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import AppModal from '../components/AppModal.vue';
import StatusPill from '../components/StatusPill.vue';
import ListPageCard from '../components/ListPageCard.vue';
import { useToast } from '../lib/useToast';
import { downloadAuthedFile } from '../lib/authedFile';

// BL-30 (Q10, RD-9): the school's complaint queue. Parents submit complaints from the app; staff
// assign an owner, keep internal notes (never shown to parents), reply, and resolve with a written
// resolution. Every change is audited by the API.
const auth = useAuthStore();
const toast = useToast();

// BL-36: files are fetched with the bearer header and saved from a blob URL.
async function download(path: string, filename: string) {
  try {
    await downloadAuthedFile(path, filename);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Could not download this file.');
  }
}

const CATEGORIES: Record<ComplaintCategory, string> = {
  ACADEMIC: 'Academic',
  BEHAVIOUR: 'Behaviour',
  TRANSPORT: 'Transport',
  FEES: 'Fees',
  FACILITIES: 'Facilities',
  STAFF: 'Staff',
  OTHER: 'Other',
};
const STATUS_LABEL: Record<string, string> = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved' };
const categoryOptions = Object.entries(CATEGORIES).map(([value, label]) => ({ value, label }));

const filterStatus = ref('');
const filterCategory = ref('');
const filterAssigned = ref('');
const complaints = ref<ComplaintSummary[]>([]);
const errorMessage = ref<string | null>(null);
const loading = ref(false);

async function loadQueue() {
  if (!auth.accessToken) return;
  errorMessage.value = null;
  loading.value = true;
  try {
    complaints.value = await api.complaintQueue(auth.accessToken, {
      status: filterStatus.value || undefined,
      category: filterCategory.value || undefined,
      assigned: (filterAssigned.value || undefined) as 'me' | 'none' | undefined,
    });
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load complaints.';
  } finally {
    loading.value = false;
  }
}
loadQueue();
watch([filterStatus, filterCategory, filterAssigned], loadQueue);

// --- detail ---
const open = ref<ComplaintSummary | null>(null);
const assignees = ref<ComplaintPerson[]>([]);
const editStatus = ref<ComplaintStatus>('open');
const editAssignee = ref('');
const editResolution = ref('');
const noteBody = ref('');
const noteInternal = ref(true);
const detailError = ref<string | null>(null);
const busy = ref(false);
const showDetail = computed({
  get: () => open.value !== null,
  set: (v: boolean) => {
    if (!v) open.value = null;
  },
});

function fill(c: ComplaintSummary) {
  open.value = c;
  editStatus.value = (c.status as ComplaintStatus) ?? 'open';
  editAssignee.value = c.assignedTo?.id ?? '';
  editResolution.value = c.resolution ?? '';
}

async function onOpen(id: string) {
  if (!auth.accessToken) return;
  detailError.value = null;
  try {
    const [c, people] = await Promise.all([
      api.getComplaint(auth.accessToken, id),
      api.complaintAssignees(auth.accessToken, id).catch(() => []),
    ]);
    assignees.value = people;
    fill(c);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not open this complaint.';
  }
}

async function run(action: () => Promise<ComplaintSummary>, done: string) {
  detailError.value = null;
  busy.value = true;
  try {
    fill(await action());
    await loadQueue();
    toast.success(done);
  } catch (err) {
    detailError.value = err instanceof Error ? err.message : 'Could not save.';
  } finally {
    busy.value = false;
  }
}

function onSave() {
  if (!auth.accessToken || !open.value) return;
  if (editStatus.value === 'resolved' && !editResolution.value.trim()) {
    detailError.value = 'Write the resolution the parent will see before resolving.';
    return;
  }
  const token = auth.accessToken;
  const id = open.value.id;
  void run(
    () =>
      api.updateComplaint(token, id, {
        status: editStatus.value,
        assignedToId: editAssignee.value || null,
        ...(editResolution.value.trim() ? { resolution: editResolution.value.trim() } : {}),
      }),
    'Complaint updated.',
  );
}

function onAddNote() {
  if (!auth.accessToken || !open.value || !noteBody.value.trim()) return;
  const token = auth.accessToken;
  const id = open.value.id;
  const payload = { body: noteBody.value.trim(), internal: noteInternal.value };
  void run(async () => {
    const c = await api.addComplaintNote(token, id, payload);
    noteBody.value = '';
    return c;
  }, payload.internal ? 'Internal note added.' : 'Reply sent to the parent.');
}

function onAttach(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!auth.accessToken || !open.value || !file) return;
  const token = auth.accessToken;
  const id = open.value.id;
  void run(() => api.addComplaintAttachment(token, id, file), 'File attached.');
}

function tone(status: string): 'success' | 'warning' | 'neutral' {
  if (status === 'resolved') return 'success';
  if (status === 'in_progress') return 'warning';
  return 'neutral';
}

// --- staff-raised complaint (e.g. behaviour), kept from the earlier log ---
const students = ref<StudentAdminSummary[]>([]);
const showAddForm = ref(false);
const newStudentId = ref('');
const newCategory = ref<ComplaintCategory>('BEHAVIOUR');
const newSubject = ref('');
const newDescription = ref('');
const isSaving = ref(false);

async function openAddForm() {
  showAddForm.value = true;
  if (!auth.accessToken || students.value.length) return;
  try {
    students.value = await api.listAdminStudents(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load students.';
  }
}

async function onAdd() {
  if (!auth.accessToken || !newStudentId.value || !newSubject.value.trim() || !newDescription.value.trim()) return;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createComplaint(auth.accessToken, {
      studentId: newStudentId.value,
      category: newCategory.value,
      subject: newSubject.value.trim(),
      description: newDescription.value.trim(),
    });
    newSubject.value = '';
    newDescription.value = '';
    showAddForm.value = false;
    await loadQueue();
    toast.success('Complaint recorded.');
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not record this complaint.';
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <ListPageCard icon="chat" title="Complaints" subtitle="Your school's complaint queue">
    <template #actions>
      <Button data-testid="open-add-form" @click="openAddForm">+ Record complaint</Button>
    </template>
    <template #toolbar>
      <FormField
        v-model="filterStatus"
        label="Status"
        hide-label
        type="select"
        data-testid="filter-status"
        :options="[{ value: '', label: 'All statuses' }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))]"
      />
      <FormField
        v-model="filterCategory"
        label="Category"
        hide-label
        type="select"
        data-testid="filter-category"
        :options="[{ value: '', label: 'All categories' }, ...categoryOptions]"
      />
      <FormField
        v-model="filterAssigned"
        label="Owner"
        hide-label
        type="select"
        data-testid="filter-assigned"
        :options="[
          { value: '', label: 'Any owner' },
          { value: 'me', label: 'Assigned to me' },
          { value: 'none', label: 'Unassigned' },
        ]"
      />
    </template>

    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <EntityTable
      :items="complaints"
      :columns="[
        { key: 'subject', label: 'Complaint' },
        { key: 'category', label: 'Category' },
        { key: 'studentName', label: 'Student' },
        { key: 'assignedTo', label: 'Owner' },
        { key: 'status', label: 'Status' },
        { key: 'createdAt', label: 'Raised' },
      ]"
      row-key="id"
      :editing-id="null"
      :loading="loading"
      empty-icon="chat"
      empty-title="No complaints"
      empty-message="Complaints from parents and staff appear here."
    >
      <template #cell-subject="{ item }">
        {{ item.subject }}
        <span class="muted">· {{ item.raisedBy?.role === 'PARENT' ? 'from a parent' : 'recorded by staff' }}</span>
      </template>
      <template #cell-category="{ item }">{{ CATEGORIES[item.category as ComplaintCategory] ?? '—' }}</template>
      <template #cell-studentName="{ item }">{{ item.studentName }} <span class="mono muted">{{ item.grNumber }}</span></template>
      <template #cell-assignedTo="{ item }">{{ item.assignedTo?.name ?? 'Unassigned' }}</template>
      <template #cell-status="{ item }">
        <StatusPill :tone="tone(item.status)" :label="STATUS_LABEL[item.status] ?? item.status" />
      </template>
      <template #cell-createdAt="{ item }">{{ item.createdAt.slice(0, 10) }}</template>
      <template #actions="{ item }">
        <Button variant="secondary" :data-testid="`open-${item.id}`" @click="onOpen(item.id)">Open</Button>
      </template>
    </EntityTable>

    <AppModal v-model="showDetail" :title="open?.subject ?? 'Complaint'">
      <div v-if="open" class="detail" data-testid="complaint-detail">
        <p class="muted">
          {{ CATEGORIES[open.category as ComplaintCategory] ?? '' }} · {{ open.studentName }} · raised by
          {{ open.raisedBy?.name ?? 'unknown' }} on {{ open.createdAt.slice(0, 10) }}
        </p>
        <p>{{ open.description }}</p>
        <div v-if="open.attachments?.length" class="attachments">
          <button
            v-for="a in open.attachments"
            :key="a.id"
            type="button"
            class="link"
            @click="download(api.filePath(a.fileId), a.originalName)"
          >{{ a.originalName }}</button>
        </div>
        <label class="attach">
          <span class="muted">Attach a file</span>
          <input type="file" data-testid="attach-file" @change="onAttach" />
        </label>

        <p v-if="detailError" class="error" role="alert" data-testid="detail-error">{{ detailError }}</p>

        <div class="grid">
          <FormField
            v-model="editStatus"
            label="Status"
            type="select"
            data-testid="edit-status"
            :options="Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))"
          />
          <FormField
            v-model="editAssignee"
            label="Owner"
            type="select"
            data-testid="edit-assignee"
            :options="[{ value: '', label: 'Unassigned' }, ...assignees.map((p) => ({ value: p.id, label: `${p.name} (${p.role})` }))]"
          />
        </div>
        <FormField
          v-model="editResolution"
          label="Resolution (shown to the parent)"
          type="textarea"
          data-testid="edit-resolution"
        />
        <Button data-testid="save-complaint" :disabled="busy" @click="onSave">Save</Button>

        <h3>Notes and replies</h3>
        <div v-for="n in open.notes ?? []" :key="n.id" class="note" :class="{ internal: n.internal }" :data-testid="`note-${n.id}`">
          <span class="muted">
            {{ n.internal ? 'Internal note' : 'Visible to the parent' }} · {{ n.author?.name ?? 'unknown' }} ·
            {{ n.createdAt.slice(0, 16).replace('T', ' ') }}
          </span>
          <p>{{ n.body }}</p>
        </div>
        <FormField v-model="noteBody" label="Add a note or reply" type="textarea" data-testid="note-body" />
        <FormField
          v-model="noteInternal"
          type="checkbox"
          label="Internal note (staff only — never shown to the parent)"
          data-testid="note-internal"
        />
        <Button data-testid="add-note" :disabled="busy" @click="onAddNote">Add</Button>
      </div>
    </AppModal>

    <AppModal v-model="showAddForm" title="Record Complaint">
      <div class="detail">
        <FormField
          v-model="newStudentId"
          label="Student"
          type="select"
          data-testid="add-student"
          placeholder="Choose a student"
          :options="students.map((s) => ({ value: s.id, label: `${s.name} (${s.grNumber})` }))"
        />
        <FormField v-model="newCategory" label="Category" type="select" data-testid="add-category" :options="categoryOptions" />
        <FormField v-model="newSubject" label="Title" type="text" data-testid="add-subject" />
        <FormField v-model="newDescription" label="Description" type="textarea" data-testid="add-description" />
        <Button data-testid="add-submit" :disabled="isSaving" @click="onAdd">Record complaint</Button>
      </div>
    </AppModal>
  </ListPageCard>
</template>

<style scoped>
.error {
  color: var(--color-destructive);
}
.muted {
  color: var(--color-muted);
  font-size: var(--font-size-xs);
}
.detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: min(36rem, 90vw);
}
.detail p {
  margin: 0;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: var(--space-3);
}
.attachments {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.attach {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.link {
  background: none;
  border: 0;
  padding: 0;
  font-family: inherit;
  cursor: pointer;
  color: var(--color-accent);
  font-weight: 700;
  font-size: var(--font-size-sm);
  text-align: start;
}
.note {
  border-left: 3px solid var(--color-accent);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
}
.note.internal {
  border-left-color: var(--color-warning, #b7791f);
}
h3 {
  margin: var(--space-3) 0 0;
}
</style>
