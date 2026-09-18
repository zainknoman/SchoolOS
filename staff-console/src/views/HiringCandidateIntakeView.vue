<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type CampusSummary, type HiringCandidateSummary } from '../lib/api';
import { EMPLOYEE_TYPE_OPTIONS } from '../lib/staff-profile.constants';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';

const auth = useAuthStore();

const campuses = ref<CampusSummary[]>([]);
const errorMessage = ref<string | null>(null);
const applicationErrorMessage = ref<string | null>(null);

const candidateName = ref('');
const candidateDob = ref('');
const candidateCnic = ref('');
const candidatePhone = ref('');
const candidateEmail = ref('');
const candidateResumeFile = ref<File | null>(null);
const isSavingCandidate = ref(false);

const candidateId = ref<string | null>(null);
const possibleDuplicate = ref<HiringCandidateSummary | null>(null);
const showDuplicateBanner = ref(false);

const applicationEmployeeType = ref('');
const applicationCampusId = ref('');
const isSavingApplication = ref(false);
const applicationCreated = ref(false);

const emit = defineEmits<{ created: [] }>();

async function loadOptions() {
  if (!auth.accessToken) return;
  try {
    campuses.value = await api.listCampuses(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load campuses.';
  }
}
loadOptions();

function onResumeFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  candidateResumeFile.value = input.files?.[0] ?? null;
}

async function onCreateCandidate() {
  if (!auth.accessToken || !candidateName.value.trim() || !candidatePhone.value.trim()) return;
  errorMessage.value = null;
  isSavingCandidate.value = true;
  try {
    let resumeFileId: string | undefined;
    if (candidateResumeFile.value) {
      const uploaded = await api.uploadFile(auth.accessToken, candidateResumeFile.value);
      resumeFileId = uploaded.id;
    }
    const res = await api.createHiringCandidate(auth.accessToken, {
      name: candidateName.value.trim(),
      dateOfBirth: candidateDob.value || undefined,
      cnic: candidateCnic.value || undefined,
      contactPhone: candidatePhone.value.trim(),
      contactEmail: candidateEmail.value || undefined,
      resumeFileId,
    });
    candidateId.value = res.candidate.id;
    possibleDuplicate.value = res.possibleDuplicate;
    showDuplicateBanner.value = res.possibleDuplicate !== null;
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not create this candidate.';
  } finally {
    isSavingCandidate.value = false;
  }
}

function dismissDuplicateBanner() {
  showDuplicateBanner.value = false;
}

async function onCreateApplication() {
  if (!auth.accessToken || !candidateId.value || !applicationEmployeeType.value || !applicationCampusId.value) return;
  applicationErrorMessage.value = null;
  isSavingApplication.value = true;
  try {
    await api.createHiringApplication(auth.accessToken, {
      candidateId: candidateId.value,
      employeeType: applicationEmployeeType.value,
      campusId: applicationCampusId.value,
    });
    applicationCreated.value = true;
    emit('created');
  } catch (err) {
    applicationErrorMessage.value = err instanceof Error ? err.message : 'Could not create this application.';
  } finally {
    isSavingApplication.value = false;
  }
}
</script>

<template>
  <div class="candidate-intake">
    <h1>New Hiring Candidate</h1>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <div v-if="showDuplicateBanner && possibleDuplicate" class="duplicate-banner" data-testid="duplicate-banner" role="alert">
      A similar candidate already exists — {{ possibleDuplicate.name }}
      <button type="button" class="dismiss-banner" @click="dismissDuplicateBanner">Dismiss</button>
    </div>

    <section class="stage-card">
      <h2>1 · Candidate details</h2>
      <div class="field-grid">
        <FormField v-model="candidateName" label="Name" type="text" data-testid="candidate-name" placeholder="Candidate's full name" grow />
        <FormField v-model="candidateDob" label="Date of birth" type="date" data-testid="candidate-dob" />
        <FormField v-model="candidateCnic" label="CNIC" type="text" data-testid="candidate-cnic" placeholder="CNIC" grow />
        <FormField v-model="candidatePhone" label="Contact phone" type="text" data-testid="candidate-phone" placeholder="Contact phone" grow />
        <FormField v-model="candidateEmail" label="Contact email" type="email" data-testid="candidate-email" placeholder="Contact email" grow />
        <div class="resume-field">
          <label class="resume-label" for="candidate-resume-input">Résumé</label>
          <input id="candidate-resume-input" class="resume-input" type="file" data-testid="candidate-resume" @change="onResumeFileChange" />
        </div>
      </div>
      <Button data-testid="candidate-submit" :disabled="isSavingCandidate" @click="onCreateCandidate">
        Create Candidate
      </Button>
    </section>

    <section v-if="candidateId" class="stage-card">
      <h2>2 · Application</h2>
      <p v-if="applicationErrorMessage" class="error" role="alert">{{ applicationErrorMessage }}</p>
      <p v-if="applicationCreated" class="success">Application created.</p>
      <div class="field-grid">
        <FormField
          v-model="applicationEmployeeType"
          label="Employee type"
          type="select"
          data-testid="application-employee-type"
          placeholder="Choose an employee type"
          :options="EMPLOYEE_TYPE_OPTIONS"
        />
        <FormField
          v-model="applicationCampusId"
          label="Campus"
          type="select"
          data-testid="application-campus"
          placeholder="Choose a campus"
          :options="campuses.map((c) => ({ value: c.id, label: c.name }))"
        />
      </div>
      <Button data-testid="application-submit" :disabled="isSavingApplication" @click="onCreateApplication">
        Create Application
      </Button>
    </section>
  </div>
</template>

<style scoped>
.candidate-intake {
  max-width: 900px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.candidate-intake h1 {
  margin: 0;
}
.error {
  color: var(--color-destructive);
}
.success {
  color: var(--color-accent);
}
.stage-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.stage-card h2 {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 700;
}
.field-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
}
.resume-field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.resume-label {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-muted);
}
.resume-input {
  padding: 0.4rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-size: var(--font-size-sm);
}
.duplicate-banner {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-status-warning-tint);
  color: var(--color-late);
  font-weight: 600;
  font-size: var(--font-size-sm);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
.dismiss-banner {
  border: none;
  background: none;
  color: inherit;
  font-weight: 700;
  cursor: pointer;
  font-size: var(--font-size-xs);
}

@media (max-width: 640px) {
  .field-grid {
    grid-template-columns: 1fr;
  }
}
</style>