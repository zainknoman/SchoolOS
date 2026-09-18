<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api, type ApplicationSummary, type SectionSummary, type ParentSummary } from '../lib/api';
import FormField from '../components/FormField.vue';
import Button from '../components/Button.vue';
import AppModal from '../components/AppModal.vue';
import StatusPill from '../components/StatusPill.vue';

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};
const STATUS_TONES: Record<string, 'success' | 'warning' | 'critical' | 'info' | 'neutral'> = {
  SUBMITTED: 'neutral',
  UNDER_REVIEW: 'info',
  APPROVED: 'success',
  REJECTED: 'critical',
  WITHDRAWN: 'warning',
};
function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}
function statusTone(status: string): 'success' | 'warning' | 'critical' | 'info' | 'neutral' {
  return STATUS_TONES[status] ?? 'neutral';
}

const auth = useAuthStore();
const route = useRoute();
const applicationId = route.params.id as string;

const application = ref<ApplicationSummary | null>(null);
const sections = ref<SectionSummary[]>([]);
const parents = ref<ParentSummary[]>([]);
const errorMessage = ref<string | null>(null);

const isMarkingUnderReview = ref(false);
const showRejectModal = ref(false);
const showApproveModal = ref(false);

const rejectDecisionNotes = ref('');
const isRejecting = ref(false);
const rejectErrorMessage = ref<string | null>(null);

const approveGrNumber = ref('');
const approveSectionId = ref('');
const useNewParent = ref(false);
const newParentProfileId = ref('');
const newParentIdentifier = ref('');
const newParentPassword = ref('');
const newParentName = ref('');
const newParentPhone = ref('');
const isApproving = ref(false);
const approveErrorMessage = ref<string | null>(null);

async function load() {
  if (!auth.accessToken) return;
  try {
    [application.value, sections.value, parents.value] = await Promise.all([
      api.getApplication(auth.accessToken, applicationId),
      api.listSections(auth.accessToken),
      api.listAdminParents(auth.accessToken),
    ]);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load this application.';
  }
}
load();

async function onMarkUnderReview() {
  if (!auth.accessToken) return;
  errorMessage.value = null;
  isMarkingUnderReview.value = true;
  try {
    application.value = await api.updateApplicationStatus(auth.accessToken, applicationId, { status: 'UNDER_REVIEW' });
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this application.';
  } finally {
    isMarkingUnderReview.value = false;
  }
}

async function onReject() {
  if (!auth.accessToken || !rejectDecisionNotes.value.trim()) return;
  rejectErrorMessage.value = null;
  isRejecting.value = true;
  try {
    application.value = await api.rejectApplication(auth.accessToken, applicationId, rejectDecisionNotes.value.trim());
    showRejectModal.value = false;
  } catch (err) {
    rejectErrorMessage.value = err instanceof Error ? err.message : 'Could not reject this application.';
  } finally {
    isRejecting.value = false;
  }
}

async function onApprove() {
  if (!auth.accessToken || !approveGrNumber.value.trim() || !approveSectionId.value) return;
  if (useNewParent.value) {
    if (!newParentIdentifier.value.trim() || !newParentPassword.value || !newParentName.value.trim()) return;
  } else if (!newParentProfileId.value) {
    return;
  }
  approveErrorMessage.value = null;
  isApproving.value = true;
  try {
    application.value = await api.approveApplication(auth.accessToken, applicationId, {
      grNumber: approveGrNumber.value.trim(),
      sectionId: approveSectionId.value,
      ...(useNewParent.value
        ? {
            newParent: {
              identifier: newParentIdentifier.value.trim(),
              password: newParentPassword.value,
              name: newParentName.value.trim(),
              phone: newParentPhone.value.trim() || undefined,
            },
          }
        : { parentProfileId: newParentProfileId.value }),
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
    <RouterLink to="/admin/admissions" class="back-link">← Back to Admissions</RouterLink>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <div v-if="application" class="application-info">
      <div class="detail-header">
        <h1>{{ application.applicantName }}</h1>
        <StatusPill :tone="statusTone(application.status)" :label="statusLabel(application.status)" />
      </div>

      <div class="info-card">
        <div class="info-row"><span class="muted">Applicant</span><span class="info-value">{{ application.applicantName }}</span></div>
        <div class="info-row"><span class="muted">Status</span><span class="info-value">{{ statusLabel(application.status) }}</span></div>
        <div v-if="application.decisionNotes" class="info-row"><span class="muted">Decision notes</span><span class="info-value">{{ application.decisionNotes }}</span></div>
      </div>

      <template v-if="application.status !== 'APPROVED' && application.status !== 'REJECTED'">
        <div class="inline-form">
          <Button data-testid="mark-under-review" variant="secondary" :disabled="isMarkingUnderReview" @click="onMarkUnderReview">
            Mark Under Review
          </Button>
          <Button data-testid="open-reject-modal" variant="secondary" class="btn-danger-outline" @click="showRejectModal = true">
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
              <FormField v-model="approveGrNumber" label="GR number" type="text" data-testid="approve-gr-number" placeholder="GR number" grow />
              <FormField
                v-model="approveSectionId"
                label="Section"
                type="select"
                data-testid="approve-section"
                placeholder="Choose a section"
                :options="sections.map((sec) => ({ value: sec.id, label: `${sec.className} ${sec.name} (${sec.campusName})` }))"
              />
            </div>

            <FormField
              v-model="useNewParent"
              label="+ New Parent (instead of picking an existing one)"
              type="checkbox"
              data-testid="toggle-new-parent"
            />

            <div v-if="!useNewParent" class="form-grid">
              <FormField
                v-model="newParentProfileId"
                label="Parent"
                type="select"
                data-testid="add-parent-select"
                placeholder="Choose a parent"
                :options="parents.map((p) => ({ value: p.id, label: `${p.name} (${p.identifier})` }))"
              />
            </div>
            <div v-else class="form-grid">
              <FormField v-model="newParentIdentifier" label="Parent login email" type="text" data-testid="new-parent-identifier" placeholder="Parent login email" grow />
              <FormField v-model="newParentPassword" label="Initial password" type="password" data-testid="new-parent-password" placeholder="Initial password" grow />
              <FormField v-model="newParentName" label="Parent full name" type="text" data-testid="new-parent-name" placeholder="Parent full name" grow />
              <FormField v-model="newParentPhone" label="Phone" type="text" data-testid="new-parent-phone" placeholder="Phone (optional)" grow />
            </div>

            <Button data-testid="approve-submit" :disabled="isApproving" @click="onApprove">Approve</Button>
          </div>
        </AppModal>
      </template>
    </div>
  </div>
</template>

<style scoped>
.application-detail {
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.back-link {
  color: var(--color-muted);
  font-size: var(--font-size-xs);
  font-weight: 700;
  text-decoration: none;
}
.error {
  color: var(--color-destructive);
}
.application-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.detail-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.detail-header h1 {
  margin: 0;
}
.info-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.info-row {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  font-size: var(--font-size-sm);
}
.info-value {
  font-weight: 600;
}
.muted {
  color: var(--color-muted);
}
.inline-form {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.btn-danger-outline {
  border-color: var(--color-destructive) !important;
  color: var(--color-destructive) !important;
}
</style>
