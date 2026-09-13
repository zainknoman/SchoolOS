<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import {
  api,
  type ReportCardSummary,
  type StudentAdminSummary,
  type AcademicSessionSummary,
  type TermSummary,
  type SubjectGrade,
} from '../lib/api';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';

const auth = useAuthStore();

const students = ref<StudentAdminSummary[]>([]);
const sessions = ref<AcademicSessionSummary[]>([]);
const selectedStudentId = ref('');
const selectedSessionId = ref('');
const selectedFile = ref<File | null>(null);
const reportCards = ref<ReportCardSummary[]>([]);
const errorMessage = ref<string | null>(null);
const isUploading = ref(false);

const terms = ref<TermSummary[]>([]);
const selectedTermId = ref('');
const grades = ref<SubjectGrade[]>([]);

async function loadOptions() {
  if (!auth.accessToken) return;
  try {
    [students.value, sessions.value] = await Promise.all([
      api.listAdminStudents(auth.accessToken),
      api.listAcademicSessions(auth.accessToken),
    ]);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load students/sessions.';
  }
}
loadOptions();

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

async function onSessionChange() {
  terms.value = [];
  selectedTermId.value = '';
  grades.value = [];
  if (!auth.accessToken || !selectedSessionId.value) return;
  try {
    terms.value = await api.listTerms(auth.accessToken, selectedSessionId.value);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load terms.';
  }
}

async function loadGrades() {
  grades.value = [];
  if (!auth.accessToken || !selectedStudentId.value || !selectedTermId.value) return;
  try {
    grades.value = await api.getStudentGrades(auth.accessToken, selectedStudentId.value, selectedTermId.value);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load grades.';
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
        @update:model-value="onSessionChange"
      />
      <FormField
        v-if="terms.length"
        v-model="selectedTermId"
        label="Term"
        type="select"
        data-testid="select-term"
        placeholder="Choose a term"
        :options="terms.map((t) => ({ value: t.id, label: t.label }))"
        @update:model-value="loadGrades"
      />
      <label class="file-field">
        <span>File (PDF)</span>
        <input data-testid="select-file" type="file" accept="application/pdf" @change="onFileChange" />
      </label>
      <Button data-testid="upload-submit" :disabled="isUploading" @click="onUpload">Upload</Button>
    </div>

    <table v-if="grades.length" class="grades-table" data-testid="grades-table">
      <thead>
        <tr>
          <th>Subject</th>
          <th>Categories</th>
          <th>Final %</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="grade in grades" :key="grade.subjectId">
          <td>{{ grade.subjectName }}</td>
          <td>
            <span v-for="cat in grade.categories" :key="cat.name" class="category-chip">
              {{ cat.name }}: {{ cat.weightPercent }}% wt, {{ cat.obtainedPercent }}% obtained
            </span>
          </td>
          <td>{{ grade.finalPercent }}%</td>
        </tr>
      </tbody>
    </table>

    <ul v-else-if="selectedStudentId" class="report-card-list">
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
