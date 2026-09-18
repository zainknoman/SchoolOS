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

    <section class="form-section">
      <h2>Candidate details</h2>
      <div class="inline-form">
        <FormField v-model="candidateName" label="Name" type="text" data-testid="candidate-name" placeholder="Candidate's full name" grow />
        <FormField v-model="candidateDob" label="Date of birth" type="date" data-testid="candidate-dob" />
        <FormField v-model="candidateCnic" label="CNIC" type="text" data-testid="candidate-cnic" placeholder="CNIC" grow />
      </div>
      <div class="inline-form">
        <FormField v-model="candidatePhone" label="Contact phone" type="text" data-testid="candidate-phone" placeholder="Contact phone" grow />
        <FormField v-model="candidateEmail" label="Contact email" type="email" data-testid="candidate-email" placeholder="Contact email" grow />
      </div>
      <div class="form-field">
        <label class="sr-only" for="candidate-resume-input">Résumé</label>
        <input id="candidate-resume-input" type="file" data-testid="candidate-resume" @change="onResumeFileChange" />
      </div>
      <Button data-testid="candidate-submit" :disabled="isSavingCandidate" @click="onCreateCandidate">
        Create Candidate
      </Button>

      <div v-if="showDuplicateBanner && possibleDuplicate" class="duplicate-banner" data-testid="duplicate-banner" role="alert">
        A similar candidate already exists — {{ possibleDuplicate.name }}
        <button type="button" class="dismiss-banner" @click="dismissDuplicateBanner">Dismiss</button>
      </div>
    </section>

    <section v-if="candidateId" class="form-section">
      <h2>Application</h2>
      <p v-if="applicationErrorMessage" class="error" role="alert">{{ applicationErrorMessage }}</p>
      <p v-if="applicationCreated" class="success">Application created.</p>
      <div class="inline-form">
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
        <Button data-testid="application-submit" :disabled="isSavingApplication" @click="onCreateApplication">
          Create Application
        </Button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.candidate-intake {
  max-width: 900px;
}
.form-section {
  margin-bottom: var(--space-4);
}
.error {
  color: var(--color-destructive);
  margin-bottom: var(--space-3);
}
.success {
  color: var(--color-accent);
  margin-bottom: var(--space-3);
}
.inline-form {
  display: flex;
  gap: var(--space-2);
  align-items: flex-end;
  flex-wrap: wrap;
}
.duplicate-banner {
  margin-top: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-muted-bg);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.dismiss-banner {
  border: none;
  background: none;
  color: var(--color-accent);
  cursor: pointer;
  font: inherit;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>