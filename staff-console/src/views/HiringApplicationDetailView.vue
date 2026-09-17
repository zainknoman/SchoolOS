<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api, type CampusSummary, type HiringApplicationSummary } from '../lib/api';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import AppModal from '../components/AppModal.vue';

const auth = useAuthStore();
const route = useRoute();
const applicationId = route.params.id as string;

const application = ref<HiringApplicationSummary | null>(null);
const campuses = ref<CampusSummary[]>([]);
const errorMessage = ref<string | null>(null);

const campusName = computed(() => {
  if (!application.value) return '—';
  return campuses.value.find((c) => c.id === application.value!.campusId)?.name ?? application.value.campusId;
});

const isMarkingStatus = ref(false);
const showRejectModal = ref(false);
const showApproveModal = ref(false);

const rejectDecisionNotes = ref('');
const isRejecting = ref(false);
const rejectErrorMessage = ref<string | null>(null);

const approveDateOfBirth = ref('');
const approveCnic = ref('');
const approveMobile = ref('');
const approveEmail = ref('');
const approveJoiningDate = ref('');
const approveLoginIdentifier = ref('');
const approveLoginPassword = ref('');
const isApproving = ref(false);
const approveErrorMessage = ref<string | null>(null);

async function load() {
  if (!auth.accessToken) return;
  try {
    [application.value, campuses.value] = await Promise.all([
      api.getHiringApplication(auth.accessToken, applicationId),
      api.listCampuses(auth.accessToken),
    ]);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load this hiring application.';
  }
}
load();

async function onMarkStatus(status: 'SHORTLISTED' | 'INTERVIEWED') {
  if (!auth.accessToken) return;
  errorMessage.value = null;
  isMarkingStatus.value = true;
  try {
    application.value = await api.updateHiringApplicationStatus(auth.accessToken, applicationId, { status });
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this application.';
  } finally {
    isMarkingStatus.value = false;
  }
}

async function onReject() {
  if (!auth.accessToken || !rejectDecisionNotes.value.trim()) return;
  rejectErrorMessage.value = null;
  isRejecting.value = true;
  try {
    application.value = await api.rejectHiringApplication(auth.accessToken, applicationId, rejectDecisionNotes.value.trim());
    showRejectModal.value = false;
  } catch (err) {
    rejectErrorMessage.value = err instanceof Error ? err.message : 'Could not reject this application.';
  } finally {
    isRejecting.value = false;
  }
}

async function onApprove() {
  if (!auth.accessToken || !application.value) return;
  const requiresLogin = application.value.employeeType === 'TEACHER';
  if (requiresLogin && (!approveLoginIdentifier.value.trim() || !approveLoginPassword.value)) return;
  approveErrorMessage.value = null;
  isApproving.value = true;
  try {
    application.value = await api.approveHiringApplication(auth.accessToken, applicationId, {
      dateOfBirth: approveDateOfBirth.value || undefined,
      cnic: approveCnic.value || undefined,
      mobile: approveMobile.value || undefined,
      email: approveEmail.value || undefined,
      joiningDate: approveJoiningDate.value || undefined,
      login: requiresLogin
        ? { identifier: approveLoginIdentifier.value.trim(), password: approveLoginPassword.value }
        : undefined,
    });
    showApproveModal.value = false;
  } catch (err) {
    approveErrorMessage.value = err instanceof Error ? err.message : 'Could not approve this application.';
  } finally {
    isApproving.value = false;
  }
}
</script>

<template>
  <div class="application-detail">
    <h1>Hiring Application</h1>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <div v-if="application" class="application-info">
      <p><strong>Candidate:</strong> {{ application.candidateName }}</p>
      <p><strong>Employee type:</strong> {{ application.employeeType }}</p>
      <p><strong>Campus:</strong> {{ campusName }}</p>
      <p><strong>Status:</strong> {{ application.status }}</p>
      <p v-if="application.decisionNotes"><strong>Decision notes:</strong> {{ application.decisionNotes }}</p>

      <template v-if="application.status !== 'APPROVED' && application.status !== 'REJECTED'">
        <div class="inline-form">
          <Button data-testid="mark-shortlisted" :disabled="isMarkingStatus" @click="onMarkStatus('SHORTLISTED')">
            Mark Shortlisted
          </Button>
          <Button data-testid="mark-interviewed" :disabled="isMarkingStatus" @click="onMarkStatus('INTERVIEWED')">
            Mark Interviewed
          </Button>
          <Button data-testid="open-reject-modal" variant="secondary" @click="showRejectModal = true">
            Reject
          </Button>
          <Button data-testid="open-approve-modal" @click="showApproveModal = true">
            Approve
          </Button>
        </div>

        <AppModal v-model="showRejectModal" title="Reject Application">
          <div class="add-form">
            <p v-if="rejectErrorMessage" class="error" role="alert">{{ rejectErrorMessage }}</p>
            <FormField
              v-model="rejectDecisionNotes"
              label="Decision notes"
              type="text"
              data-testid="reject-decision-notes"
              placeholder="Reason for rejection"
              grow
            />
            <Button data-testid="reject-submit" variant="secondary" :disabled="isRejecting" @click="onReject">
              Reject
            </Button>
          </div>
        </AppModal>

        <AppModal v-model="showApproveModal" title="Approve Application">
          <div class="add-form">
            <p v-if="approveErrorMessage" class="error" role="alert">{{ approveErrorMessage }}</p>
            <div class="form-grid">
              <FormField v-model="approveDateOfBirth" label="Date of birth" type="date" data-testid="approve-dateOfBirth" />
              <FormField v-model="approveCnic" label="CNIC" type="text" data-testid="approve-cnic" placeholder="CNIC" grow />
              <FormField v-model="approveMobile" label="Mobile" type="text" data-testid="approve-mobile" placeholder="Mobile" grow />
              <FormField v-model="approveEmail" label="Email" type="email" data-testid="approve-email" placeholder="Email" grow />
              <FormField v-model="approveJoiningDate" label="Joining date" type="date" data-testid="approve-joiningDate" />
            </div>

            <template v-if="application.employeeType === 'TEACHER'">
              <p class="hint">A login is required to hire a teacher.</p>
              <div class="form-grid">
                <FormField v-model="approveLoginIdentifier" label="Login email" type="text" data-testid="approve-login-identifier" placeholder="Login email" grow />
                <FormField v-model="approveLoginPassword" label="Initial password" type="password" data-testid="approve-login-password" placeholder="Initial password" grow />
              </div>
            </template>

            <Button data-testid="approve-submit" :disabled="isApproving" @click="onApprove">Approve</Button>
          </div>
        </AppModal>
      </template>
    </div>
  </div>
</template>

<style scoped>
.application-detail {
  max-width: 900px;
}
.error {
  color: var(--color-destructive);
  margin-bottom: var(--space-3);
}
.hint {
  color: var(--color-muted, #64748b);
  font-size: var(--font-size-sm);
}
.application-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.inline-form {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.add-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-2);
}
</style>