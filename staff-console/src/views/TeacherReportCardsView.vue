<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import {
  api,
  type ReportCardSummary,
  type SectionSummary,
  type StudentSummary,
  type AcademicSessionSummary,
  type TermSummary,
  type SubjectGrade,
} from '../lib/api';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import ListPageCard from '../components/ListPageCard.vue';
import EmptyState from '../components/EmptyState.vue';

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

const terms = ref<TermSummary[]>([]);
const selectedTermId = ref('');
const grades = ref<SubjectGrade[]>([]);

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
  <ListPageCard icon="file-text" title="Report Cards" subtitle="Grades & downloadable report cards">
    <div class="picker-card">
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

    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <div v-if="grades.length" class="grades-card">
      <table class="grades-table" data-testid="grades-table">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Categories</th>
            <th class="col-final">Final %</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="grade in grades" :key="grade.subjectId">
            <td class="subject-name">{{ grade.subjectName }}</td>
            <td>
              <span v-for="cat in grade.categories" :key="cat.name" class="category-chip">
                {{ cat.name }}: {{ cat.weightPercent }}% wt, {{ cat.obtainedPercent }}% obtained
              </span>
            </td>
            <td class="mono final-percent">{{ grade.finalPercent }}%</td>
          </tr>
        </tbody>
      </table>
    </div>

    <template v-else-if="selectedStudentId">
      <EmptyState v-if="!reportCards.length" icon="file-text" title="No report cards uploaded yet." />
      <div v-else class="report-card-list">
        <div v-for="card in reportCards" :key="card.id" class="report-card-row">
          <span>{{ sessions.find((s) => s.id === card.academicSessionId)?.label ?? card.academicSessionId }}</span>
          <a :data-testid="`download-${card.id}`" :href="downloadUrl(card.id)" target="_blank" rel="noopener" class="link">
            Download
          </a>
        </div>
      </div>
    </template>
  </ListPageCard>
</template>

<style scoped>
.error {
  color: var(--color-destructive);
}
.picker-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  padding: var(--space-3) var(--space-4);
  display: flex;
  gap: var(--space-3);
  align-items: flex-end;
  flex-wrap: wrap;
}
.file-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-muted);
}
.grades-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.grades-table {
  width: 100%;
  border-collapse: collapse;
}
.grades-table th {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-2xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-muted);
  background: var(--color-background);
  border-bottom: 1px solid var(--color-border);
}
.grades-table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
  vertical-align: middle;
}
.grades-table tbody tr:last-child td {
  border-bottom: none;
}
.subject-name {
  font-weight: 700;
}
.col-final {
  width: 100px;
}
.final-percent {
  font-weight: 700;
}
.category-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.55rem;
  border-radius: var(--radius-full);
  background: var(--color-muted-bg);
  color: var(--color-text);
  font-size: var(--font-size-2xs);
  font-weight: 600;
  margin: 0.1rem 0.25rem 0.1rem 0;
}
.report-card-list {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.report-card-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
  font-weight: 600;
  font-size: var(--font-size-sm);
}
.report-card-row:last-child {
  border-bottom: none;
}
.link {
  color: var(--color-accent);
  font-weight: 700;
  font-size: var(--font-size-sm);
  text-decoration: none;
}
</style>
