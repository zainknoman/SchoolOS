<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type ApplicantSummary, type ClassSummary, type AcademicSessionSummary } from '../lib/api';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';

const auth = useAuthStore();

const classes = ref<ClassSummary[]>([]);
const sessions = ref<AcademicSessionSummary[]>([]);
const errorMessage = ref<string | null>(null);
const applicationErrorMessage = ref<string | null>(null);

const applicantName = ref('');
const applicantDob = ref('');
const applicantGuardianName = ref('');
const applicantGuardianPhone = ref('');
const isSavingApplicant = ref(false);

const applicantId = ref<string | null>(null);
const possibleDuplicate = ref<ApplicantSummary | null>(null);
const showDuplicateBanner = ref(false);

const applicationClassId = ref('');
const applicationSessionId = ref('');
const isSavingApplication = ref(false);
const applicationCreated = ref(false);

async function loadOptions() {
  if (!auth.accessToken) return;
  try {
    [classes.value, sessions.value] = await Promise.all([
      api.listClasses(auth.accessToken),
      api.listAcademicSessions(auth.accessToken),
    ]);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load classes/sessions.';
  }
}
loadOptions();

async function onCreateApplicant() {
  if (
    !auth.accessToken ||
    !applicantName.value.trim() ||
    !applicantDob.value ||
    !applicantGuardianName.value.trim() ||
    !applicantGuardianPhone.value.trim()
  ) {
    return;
  }
  errorMessage.value = null;
  isSavingApplicant.value = true;
  try {
    const res = await api.createApplicant(auth.accessToken, {
      name: applicantName.value.trim(),
      dateOfBirth: applicantDob.value,
      guardianName: applicantGuardianName.value.trim(),
      guardianPhone: applicantGuardianPhone.value.trim(),
    });
    applicantId.value = res.applicant.id;
    possibleDuplicate.value = res.possibleDuplicate;
    showDuplicateBanner.value = res.possibleDuplicate !== null;
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not create this applicant.';
  } finally {
    isSavingApplicant.value = false;
  }
}

function dismissDuplicateBanner() {
  showDuplicateBanner.value = false;
}

async function onCreateApplication() {
  if (!auth.accessToken || !applicantId.value || !applicationClassId.value || !applicationSessionId.value) return;
  applicationErrorMessage.value = null;
  isSavingApplication.value = true;
  try {
    await api.createApplication(auth.accessToken, {
      applicantId: applicantId.value,
      desiredClassId: applicationClassId.value,
      academicSessionId: applicationSessionId.value,
    });
    applicationCreated.value = true;
  } catch (err) {
    applicationErrorMessage.value = err instanceof Error ? err.message : 'Could not create this application.';
  } finally {
    isSavingApplication.value = false;
  }
}
</script>

<template>
  <div class="applicant-intake">
    <h1>New Applicant</h1>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <section class="form-section">
      <h2>Applicant details</h2>
      <div class="inline-form">
        <FormField v-model="applicantName" label="Name" type="text" data-testid="applicant-name" placeholder="Applicant's full name" grow />
        <FormField v-model="applicantDob" label="Date of birth" type="date" data-testid="applicant-dob" />
        <FormField v-model="applicantGuardianName" label="Guardian name" type="text" data-testid="applicant-guardian-name" placeholder="Guardian's full name" grow />
        <FormField v-model="applicantGuardianPhone" label="Guardian phone" type="text" data-testid="applicant-guardian-phone" placeholder="Guardian phone" grow />
        <Button data-testid="applicant-submit" :disabled="isSavingApplicant" @click="onCreateApplicant">
          Create Applicant
        </Button>
      </div>

      <div v-if="showDuplicateBanner && possibleDuplicate" class="duplicate-banner" data-testid="duplicate-banner" role="alert">
        A similar applicant already exists — {{ possibleDuplicate.name }}
        <button type="button" class="dismiss-banner" @click="dismissDuplicateBanner">Dismiss</button>
      </div>
    </section>

    <section v-if="applicantId" class="form-section">
      <h2>Application</h2>
      <p v-if="applicationErrorMessage" class="error" role="alert">{{ applicationErrorMessage }}</p>
      <p v-if="applicationCreated" class="success">Application created.</p>
      <div class="inline-form">
        <FormField
          v-model="applicationClassId"
          label="Desired class"
          type="select"
          data-testid="application-class"
          placeholder="Choose a class"
          :options="classes.map((c) => ({ value: c.id, label: `${c.name} (${c.campusName})` }))"
        />
        <FormField
          v-model="applicationSessionId"
          label="Academic session"
          type="select"
          data-testid="application-session"
          placeholder="Choose a session"
          :options="sessions.map((s) => ({ value: s.id, label: s.label }))"
        />
        <Button data-testid="application-submit" :disabled="isSavingApplication" @click="onCreateApplication">
          Create Application
        </Button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.applicant-intake {
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
</style>
