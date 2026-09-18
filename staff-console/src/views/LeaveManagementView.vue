<script setup lang="ts">
import { ref } from 'vue';
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
    await api.approveLeaveRequest(auth.accessToken, id);
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
    await api.rejectLeaveRequest(auth.accessToken, id);
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not reject this request.';
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
  <ListPageCard icon="calendar" title="Leave Applications" subtitle="Student leave requests">
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
        </div>
        <div class="request-actions">
          <StatusPill :tone="leaveTone(r.status)" :label="r.status" />
          <template v-if="r.status === 'pending'">
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
