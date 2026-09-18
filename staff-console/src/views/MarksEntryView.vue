<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import {
  api,
  type SectionSummary,
  type StudentSummary,
  type ClassSummary,
  type TermSummary,
  type AssessmentCategorySummary,
  type AssessmentSummary,
} from '../lib/api';

const auth = useAuthStore();
const route = useRoute();

const sections = ref<SectionSummary[]>([]);
const classes = ref<ClassSummary[]>([]);
const selectedSectionId = ref('');
const students = ref<StudentSummary[]>([]);

const terms = ref<TermSummary[]>([]);
const selectedTermId = ref('');
const categories = ref<AssessmentCategorySummary[]>([]);
const selectedCategoryId = ref('');
const assessments = ref<AssessmentSummary[]>([]);
const selectedAssessmentId = ref('');

const marks = ref<Record<string, string>>({});
const isSaving = ref(false);
const message = ref<string | null>(null);
const errorMessage = ref<string | null>(null);

// A Section doesn't carry its own classId — resolved here by matching the section's
// className/campusName against the class list, the same pair SectionSummary and ClassSummary
// both expose. (There is no classId on SectionSummary; see gradebook plan Task 9 discrepancy notes.)
function classForSection(section: SectionSummary): ClassSummary | undefined {
  return classes.value.find((c) => c.name === section.className && c.campusName === section.campusName);
}

async function loadInitial() {
  if (!auth.accessToken) return;
  try {
    [sections.value, classes.value] = await Promise.all([
      api.listSections(auth.accessToken),
      api.listClasses(auth.accessToken),
    ]);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load sections.';
    return;
  }
  // A "?sectionId=" query param (e.g. from the Gradebook overview's "Enter marks" link)
  // preselects that section, same as picking it from the dropdown manually would.
  const preselectSectionId = route.query.sectionId;
  if (typeof preselectSectionId === 'string' && sections.value.some((s) => s.id === preselectSectionId)) {
    selectedSectionId.value = preselectSectionId;
    await onSectionChange();
  }
}
loadInitial();

async function onSectionChange() {
  message.value = null;
  errorMessage.value = null;
  students.value = [];
  terms.value = [];
  selectedTermId.value = '';
  categories.value = [];
  selectedCategoryId.value = '';
  assessments.value = [];
  selectedAssessmentId.value = '';
  marks.value = {};
  if (!selectedSectionId.value || !auth.accessToken) return;

  try {
    students.value = await api.sectionStudents(auth.accessToken, selectedSectionId.value);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load students.';
    return;
  }

  const section = sections.value.find((s) => s.id === selectedSectionId.value);
  const klass = section ? classForSection(section) : undefined;
  if (!klass) return;
  try {
    terms.value = await api.listTerms(auth.accessToken, klass.academicSessionId);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load terms.';
  }
}

async function onTermChange() {
  categories.value = [];
  selectedCategoryId.value = '';
  assessments.value = [];
  selectedAssessmentId.value = '';
  if (!auth.accessToken || !selectedTermId.value) return;
  const section = sections.value.find((s) => s.id === selectedSectionId.value);
  const klass = section ? classForSection(section) : undefined;
  if (!klass) return;
  try {
    categories.value = await api.listAssessmentCategories(auth.accessToken, klass.id, selectedTermId.value);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load assessment categories.';
  }
}

async function onCategoryChange() {
  assessments.value = [];
  selectedAssessmentId.value = '';
  if (!auth.accessToken || !selectedCategoryId.value) return;
  try {
    assessments.value = await api.listAssessments(auth.accessToken, selectedCategoryId.value);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load assessments.';
  }
}

async function onSave() {
  if (!auth.accessToken || !selectedAssessmentId.value) return;
  message.value = null;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    const entries = Object.entries(marks.value).filter(([, v]) => v !== '');
    await api.saveMarksBulk(auth.accessToken, selectedAssessmentId.value, {
      marks: entries.map(([studentId, obtainedMarks]) => ({ studentId, obtainedMarks: Number(obtainedMarks) })),
    });
    message.value = `Saved marks for ${entries.length} student(s).`;
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="marks-entry">
    <h1>Gradebook</h1>

    <label class="field">
      <span>Section</span>
      <select data-testid="select-section" v-model="selectedSectionId" @change="onSectionChange">
        <option value="" disabled>Choose a section</option>
        <option v-for="s in sections" :key="s.id" :value="s.id">
          {{ s.className }} {{ s.name }} — {{ s.campusName }}
        </option>
      </select>
    </label>

    <label class="field" v-if="terms.length">
      <span>Term</span>
      <select data-testid="select-term" v-model="selectedTermId" @change="onTermChange">
        <option value="" disabled>Choose a term</option>
        <option v-for="t in terms" :key="t.id" :value="t.id">{{ t.label }}</option>
      </select>
    </label>

    <label class="field" v-if="categories.length">
      <span>Category</span>
      <select data-testid="select-category" v-model="selectedCategoryId" @change="onCategoryChange">
        <option value="" disabled>Choose a category</option>
        <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
    </label>

    <label class="field" v-if="assessments.length">
      <span>Assessment</span>
      <select data-testid="select-assessment" v-model="selectedAssessmentId">
        <option value="" disabled>Choose an assessment</option>
        <option v-for="a in assessments" :key="a.id" :value="a.id">{{ a.label }} (max {{ a.maxMarks }})</option>
      </select>
    </label>

    <ul v-if="students.length" class="roster">
      <li v-for="student in students" :key="student.id" class="roster-row">
        <span class="roster-name">{{ student.name }}</span>
        <input
          v-if="selectedAssessmentId"
          :data-testid="`marks-input-${student.id}`"
          type="number"
          min="0"
          v-model="marks[student.id]"
        />
      </li>
    </ul>

    <p v-if="message" class="success" data-testid="success">{{ message }}</p>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <button
      v-if="students.length && selectedAssessmentId"
      data-testid="save-marks"
      :disabled="isSaving"
      @click="onSave"
    >
      {{ isSaving ? 'Saving…' : 'Save Marks' }}
    </button>
  </div>
</template>

<style scoped>
.marks-entry {
  max-width: 640px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-3);
  max-width: 320px;
}
select,
input {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
}
.roster {
  list-style: none;
  margin-bottom: var(--space-4);
  border-top: 1px solid var(--color-border);
}
.roster-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}
.roster-row input {
  width: 6rem;
}
.success {
  color: var(--color-accent);
  margin-bottom: var(--space-3);
}
.error {
  color: var(--color-destructive);
  margin-bottom: var(--space-3);
}
</style>
