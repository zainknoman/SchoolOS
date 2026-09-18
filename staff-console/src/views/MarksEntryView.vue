<script setup lang="ts">
import { ref, computed } from 'vue';
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
import ListPageCard from '../components/ListPageCard.vue';
import Button from '../components/Button.vue';

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

const selectedAssessment = computed(() => assessments.value.find((a) => a.id === selectedAssessmentId.value));

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
  <ListPageCard icon="grid" title="Gradebook" subtitle="Enter marks for one assessment at a time">
    <div class="picker-card">
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
    </div>

    <div v-if="students.length" class="roster-card">
      <div class="roster-header">
        <span>Roster · {{ students.length }} student{{ students.length === 1 ? '' : 's' }}</span>
        <span v-if="selectedAssessment" class="mono muted">max {{ selectedAssessment.maxMarks }}</span>
      </div>
      <div v-for="student in students" :key="student.id" class="roster-row">
        <span class="roster-name">{{ student.name }}</span>
        <input
          v-if="selectedAssessmentId"
          :data-testid="`marks-input-${student.id}`"
          class="mono"
          type="number"
          min="0"
          v-model="marks[student.id]"
        />
      </div>
    </div>

    <p v-if="message" class="success" data-testid="success">{{ message }}</p>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <div v-if="students.length && selectedAssessmentId" class="save-row">
      <Button data-testid="save-marks" :disabled="isSaving" @click="onSave">
        {{ isSaving ? 'Saving…' : 'Save Marks' }}
      </Button>
    </div>
  </ListPageCard>
</template>

<style scoped>
.picker-card,
.roster-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
}
.picker-card {
  padding: var(--space-3) var(--space-4);
  display: flex;
  gap: var(--space-3);
  align-items: flex-end;
  flex-wrap: wrap;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-muted);
}
select,
input {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: var(--font-size-sm);
}
.roster-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--color-border);
  font-weight: 700;
  font-size: var(--font-size-sm);
}
.roster-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}
.roster-row:last-child {
  border-bottom: none;
}
.roster-name {
  font-weight: 600;
  font-size: var(--font-size-sm);
}
.roster-row input {
  width: 6rem;
  text-align: right;
}
.muted {
  color: var(--color-muted);
}
.success {
  color: var(--color-accent);
}
.error {
  color: var(--color-destructive);
}
.save-row {
  display: flex;
  justify-content: flex-end;
}
</style>
