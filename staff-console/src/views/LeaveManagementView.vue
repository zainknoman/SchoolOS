<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type LeaveRequestSummary } from '../lib/api';
import { useConfirm } from '../lib/useConfirm';
import StatusPill from '../components/StatusPill.vue';
import ListPageCard from '../components/ListPageCard.vue';
import EmptyState from '../components/EmptyState.vue';

const auth = useAuthStore();
const { confirm } = useConfirm();
const statusFilter = ref<'pending' | 'approved' | 'rejected' | ''>('pending');
const requests = ref<LeaveRequestSummary[]>([]);
const errorMessage = ref<string | null>(null);
const busyId = ref<string | null>(null);
// BL-29: teachers recommend, admins decide; an optional note per request (parents see a decision note).
const isTeacher = computed(() => auth.role === 'TEACHER');
const notes = ref<Record<string, string>>({});
const noteFor = (id: string) => notes.value[id]?.trim() || undefined;

async function load() {
  if (!auth.accessToken) return;
  errorMessage.value = null;
  try {
    requests.value = await api.listLeaveRequests(auth.accessToken, statusFilter.value || undefined);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load leave requests.';
  }
}
load();

async function onApprove(id: string) {
  if (!auth.accessToken) return;
  busyId.value = id;
  try {
    await api.approveLeaveRequest(auth.accessToken, id, noteFor(id));
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not approve this request.';
  } finally {
    busyId.value = null;
  }
}

async function onReject(id: string) {
  if (!auth.accessToken) return;
  if (!(await confirm({ title: 'Reject this leave request?', message: 'This cannot be undone.', danger: true })))
    return;
  busyId.value = id;
  try {
    await api.rejectLeaveRequest(auth.accessToken, id, noteFor(id));
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not reject this request.';
  } finally {
    busyId.value = null;
  }
}

async function onRecommend(id: string, approve: boolean) {
  if (!auth.accessToken) return;
  busyId.value = id;
  errorMessage.value = null;
  try {
    await api.recommendLeaveRequest(auth.accessToken, id, { approve, note: noteFor(id) });
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not save the recommendation.';
  } finally {
    busyId.value = null;
  }
}

function leaveTone(status: string): 'success' | 'warning' | 'critical' | 'neutral' {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'critical';
  if (status === 'pending') return 'warning';
  return 'neutral';
}
</script>

<template>
  <ListPageCard
    icon="calendar"
    title="Leave Applications"
    :subtitle="isTeacher ? 'Recommend on your students\' leave requests; the school admin decides' : 'Student leave requests'"
  >
    <template #toolbar>
      <label class="field">
        <span>Status</span>
        <select data-testid="status-filter" v-model="statusFilter" @change="load">
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="">All</option>
        </select>
      </label>
    </template>

    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
    <EmptyState v-if="!requests.length && !errorMessage" icon="calendar" title="No leave requests here." />

    <div v-else class="requests-card">
      <div v-for="r in requests" :key="r.id" class="request-row">
        <div class="request-main">
          <strong>{{ r.studentName }}</strong>
          <span class="muted">{{ r.startDate }} to {{ r.endDate }}</span>
          <span class="reason">{{ r.reason }}</span>
          <span v-if="r.recommendation" class="recommendation" :data-testid="`recommendation-${r.id}`">
            {{ r.recommendation.approve ? 'Recommended approval' : 'Recommended rejection' }}
            <template v-if="r.recommendation.by"> by {{ r.recommendation.by }}</template>
            <template v-if="r.recommendation.note"> — “{{ r.recommendation.note }}”</template>
          </span>
          <span v-if="r.decision" class="reason" :data-testid="`decision-${r.id}`">
            Decided<template v-if="r.decision.by"> by {{ r.decision.by }}</template>
            <template v-if="r.decision.note"> — “{{ r.decision.note }}”</template>
          </span>
          <input
            v-if="r.status === 'pending'"
            v-model="notes[r.id]"
            class="note"
            :data-testid="`note-${r.id}`"
            :placeholder="isTeacher ? 'Note for the admin (optional)' : 'Note to the parent (optional)'"
            :aria-label="`Note for ${r.studentName}'s request`"
          />
        </div>
        <div class="request-actions">
          <StatusPill :tone="leaveTone(r.status)" :label="r.status" />
          <template v-if="r.status === 'pending' && isTeacher">
            <button
              class="btn-secondary"
              :data-testid="`recommend-approve-${r.id}`"
              :disabled="busyId === r.id"
              @click="onRecommend(r.id, true)"
            >
              Recommend approval
            </button>
            <button
              class="btn-secondary"
              :data-testid="`recommend-reject-${r.id}`"
              :disabled="busyId === r.id"
              @click="onRecommend(r.id, false)"
            >
              Recommend rejection
            </button>
          </template>
          <template v-else-if="r.status === 'pending'">
            <button
              class="btn-secondary"
              :data-testid="`approve-${r.id}`"
              :disabled="busyId === r.id"
              @click="onApprove(r.id)"
            >
              Approve
            </button>
            <button
              class="btn-danger-outline"
              :data-testid="`reject-${r.id}`"
              :disabled="busyId === r.id"
              @click="onReject(r.id)"
            >
              Reject
            </button>
          </template>
        </div>
      </div>
    </div>
  </ListPageCard>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-muted);
}
select {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
}
.error {
  color: var(--color-destructive);
}
.requests-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.request-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}
.request-row:last-child {
  border-bottom: none;
}
.request-main {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.muted {
  color: var(--color-muted);
  font-size: var(--font-size-sm);
}
.recommendation {
  font-size: var(--font-size-xs);
  font-weight: 600;
}
.note {
  margin-top: var(--space-1);
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: var(--font-size-sm);
  max-width: 28rem;
}
.reason {
  color: var(--color-muted);
  font-size: var(--font-size-xs);
}
.request-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}
.btn-secondary {
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font-weight: 600;
  font-size: var(--font-size-sm);
  cursor: pointer;
}
.btn-danger-outline {
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--color-destructive);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-destructive);
  font-weight: 600;
  font-size: var(--font-size-sm);
  cursor: pointer;
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .request-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
