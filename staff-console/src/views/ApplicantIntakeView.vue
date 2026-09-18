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

const emit = defineEmits<{ created: [] }>();

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
    emit('created');
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

    <div v-if="showDuplicateBanner && possibleDuplicate" class="duplicate-banner" data-testid="duplicate-banner" role="alert">
      A similar applicant already exists — {{ possibleDuplicate.name }}
      <button type="button" class="dismiss-banner" @click="dismissDuplicateBanner">Dismiss</button>
    </div>

    <section class="stage-card">
      <h2>1 · Applicant details</h2>
      <div class="field-grid">
        <FormField v-model="applicantName" label="Name" type="text" data-testid="applicant-name" placeholder="Applicant's full name" grow />
        <FormField v-model="applicantDob" label="Date of birth" type="date" data-testid="applicant-dob" />
        <FormField v-model="applicantGuardianName" label="Guardian name" type="text" data-testid="applicant-guardian-name" placeholder="Guardian's full name" grow />
        <FormField v-model="applicantGuardianPhone" label="Guardian phone" type="text" data-testid="applicant-guardian-phone" placeholder="Guardian phone" grow />
      </div>
      <Button data-testid="applicant-submit" :disabled="isSavingApplicant" @click="onCreateApplicant">
        Create Applicant
      </Button>
    </section>

    <section v-if="applicantId" class="stage-card">
      <h2>2 · Application</h2>
      <p v-if="applicationErrorMessage" class="error" role="alert">{{ applicationErrorMessage }}</p>
      <p v-if="applicationCreated" class="success">Application created.</p>
      <div class="field-grid">
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
      </div>
      <Button data-testid="application-submit" :disabled="isSavingApplication" @click="onCreateApplication">
        Create Application
      </Button>
    </section>
  </div>
</template>

<style scoped>
.applicant-intake {
  max-width: 900px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.applicant-intake h1 {
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
