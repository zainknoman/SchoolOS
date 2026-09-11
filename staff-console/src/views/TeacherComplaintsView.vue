<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type ComplaintSummary, type SectionSummary, type StudentSummary } from '../lib/api';
import EntityTable from '../components/EntityTable.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import AppModal from '../components/AppModal.vue';

const auth = useAuthStore();

const sections = ref<SectionSummary[]>([]);
const selectedSectionId = ref('');
const students = ref<StudentSummary[]>([]);
const selectedStudentId = ref('');
const complaints = ref<ComplaintSummary[]>([]);
const errorMessage = ref<string | null>(null);
const busyId = ref<string | null>(null);

const showAddForm = ref(false);
const newSubject = ref('');
const newDescription = ref('');
const isSaving = ref(false);

async function loadSections() {
  if (!auth.accessToken) return;
  try {
    sections.value = await api.listSections(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load sections.';
  }
}
loadSections();

async function loadStudents() {
  students.value = [];
  selectedStudentId.value = '';
  complaints.value = [];
  if (!auth.accessToken || !selectedSectionId.value) return;
  errorMessage.value = null;
  try {
    students.value = await api.sectionStudents(auth.accessToken, selectedSectionId.value);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load students.';
  }
}

async function loadComplaints() {
  if (!auth.accessToken || !selectedStudentId.value) {
    complaints.value = [];
    return;
  }
  errorMessage.value = null;
  try {
    complaints.value = await api.listComplaints(auth.accessToken, selectedStudentId.value);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load complaints.';
  }
}

async function onAdd() {
  if (!auth.accessToken || !selectedStudentId.value || !newSubject.value.trim() || !newDescription.value.trim()) {
    return;
  }
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createComplaint(auth.accessToken, {
      studentId: selectedStudentId.value,
      subject: newSubject.value.trim(),
      description: newDescription.value.trim(),
    });
    newSubject.value = '';
    newDescription.value = '';
    showAddForm.value = false;
    await loadComplaints();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not raise this complaint.';
  } finally {
    isSaving.value = false;
  }
}

async function onUpdateStatus(id: string, status: string) {
  if (!auth.accessToken) return;
  busyId.value = id;
  try {
    await api.updateComplaintStatus(auth.accessToken, id, status);
    await loadComplaints();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this complaint.';
  } finally {
    busyId.value = null;
  }
}
</script>

<template>
  <div class="complaints">
    <div class="page-header">
      <h1>Complaints</h1>
      <Button data-testid="open-add-form" :disabled="!selectedStudentId" @click="showAddForm = true">+ Add New</Button>
    </div>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <div class="picker-row">
      <FormField
        v-model="selectedSectionId"
        label="Section"
        type="select"
        data-testid="section-select"
        placeholder="Choose a section"
        :options="sections.map((s) => ({ value: s.id, label: `${s.className} ${s.name} — ${s.campusName}` }))"
        @update:model-value="loadStudents"
      />
      <FormField
        v-model="selectedStudentId"
        label="Student"
        type="select"
        data-testid="student-select"
        placeholder="Choose a student"
        :options="students.map((s) => ({ value: s.id, label: `${s.name} (${s.grNumber})` }))"
        @update:model-value="loadComplaints"
      />
    </div>

    <EntityTable
      v-if="selectedStudentId"
      :items="complaints"
      :columns="[
        { key: 'subject', label: 'Subject' },
        { key: 'description', label: 'Description' },
        { key: 'status', label: 'Status' },
        { key: 'createdAt', label: 'Raised' },
      ]"
      row-key="id"
      :editing-id="null"
    >
      <template #actions="{ item }">
        <select
          :data-testid="`status-${item.id}`"
          :value="item.status"
          :disabled="busyId === item.id"
          @change="onUpdateStatus(item.id, ($event.target as HTMLSelectElement).value)"
        >
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
        </select>
      </template>
    </EntityTable>

    <AppModal v-model="showAddForm" title="Raise Complaint">
      <div class="inline-form">
        <FormField v-model="newSubject" label="Subject" type="text" data-testid="add-subject" placeholder="Subject" />
        <FormField
          v-model="newDescription"
          label="Description"
          type="text"
          data-testid="add-description"
          placeholder="Description"
          grow
        />
        <Button data-testid="add-submit" :disabled="isSaving" @click="onAdd">Raise complaint</Button>
      </div>
    </AppModal>
  </div>
</template>

<style scoped>
.complaints {
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
.picker-row {
  display: flex;
  gap: var(--space-2);
  align-items: flex-end;
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}
.inline-form {
  display: flex;
  gap: var(--space-2);
  align-items: flex-end;
}
select {
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
}
</style>
