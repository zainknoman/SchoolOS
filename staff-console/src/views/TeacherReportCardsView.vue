<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import {
  api,
  type ReportCardSummary,
  type SectionSummary,
  type StudentSummary,
  type AcademicSessionSummary,
} from '../lib/api';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';

const auth = useAuthStore();

const sections = ref<SectionSummary[]>([]);
const selectedSectionId = ref('');
const students = ref<StudentSummary[]>([]);
const sessions = ref<AcademicSessionSummary[]>([]);
const selectedStudentId = ref('');
const selectedSessionId = ref('');
const selectedFile = ref<File | null>(null);
const reportCards = ref<ReportCardSummary[]>([]);
const errorMessage = ref<string | null>(null);
const isUploading = ref(false);

async function loadOptions() {
  if (!auth.accessToken) return;
  try {
    [sections.value, sessions.value] = await Promise.all([
      api.listSections(auth.accessToken),
      api.listAcademicSessions(auth.accessToken),
    ]);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load sections/sessions.';
  }
}
loadOptions();

async function loadStudents() {
  students.value = [];
  selectedStudentId.value = '';
  reportCards.value = [];
  if (!auth.accessToken || !selectedSectionId.value) return;
  errorMessage.value = null;
  try {
    students.value = await api.sectionStudents(auth.accessToken, selectedSectionId.value);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load students.';
  }
}

async function loadReportCards() {
  if (!auth.accessToken || !selectedStudentId.value) {
    reportCards.value = [];
    return;
  }
  try {
    reportCards.value = await api.listReportCards(auth.accessToken, selectedStudentId.value);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load report cards.';
  }
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  selectedFile.value = input.files?.[0] ?? null;
}

async function onUpload() {
  if (!auth.accessToken || !selectedStudentId.value || !selectedSessionId.value || !selectedFile.value) return;
  errorMessage.value = null;
  isUploading.value = true;
  try {
    await api.uploadReportCard(auth.accessToken, {
      studentId: selectedStudentId.value,
      academicSessionId: selectedSessionId.value,
      file: selectedFile.value,
    });
    selectedFile.value = null;
    await loadReportCards();
  } catch (err) {
    errorMessage.value =
      err instanceof Error ? err.message : 'Could not upload this report card.';
  } finally {
    isUploading.value = false;
  }
}

function downloadUrl(id: string): string {
  return api.reportCardPdfUrl(auth.accessToken ?? '', id);
}
</script>

<template>
  <div class="report-cards">
    <h1>Report Cards</h1>
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
        data-testid="select-student"
        placeholder="Choose a student"
        :options="students.map((s) => ({ value: s.id, label: `${s.name} (${s.grNumber})` }))"
        @update:model-value="loadReportCards"
      />
      <FormField
        v-model="selectedSessionId"
        label="Academic session"
        type="select"
        data-testid="select-session"
        placeholder="Choose a session"
        :options="sessions.map((s) => ({ value: s.id, label: s.label }))"
      />
      <label class="file-field">
        <span>File (PDF)</span>
        <input data-testid="select-file" type="file" accept="application/pdf" @change="onFileChange" />
      </label>
      <Button data-testid="upload-submit" :disabled="isUploading" @click="onUpload">Upload</Button>
    </div>

    <ul v-if="selectedStudentId" class="report-card-list">
      <li v-if="!reportCards.length" class="empty">No report cards uploaded yet.</li>
      <li v-for="card in reportCards" :key="card.id" class="report-card-row">
        <span>{{ sessions.find((s) => s.id === card.academicSessionId)?.label ?? card.academicSessionId }}</span>
        <a :data-testid="`download-${card.id}`" :href="downloadUrl(card.id)" target="_blank" rel="noopener">
          Download
        </a>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.report-cards {
  max-width: 900px;
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
.file-field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: var(--font-size-sm);
}
.report-card-list {
  list-style: none;
  padding: 0;
}
.report-card-row {
  display: flex;
  justify-content: space-between;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}
.empty {
  color: var(--color-muted);
}
</style>
