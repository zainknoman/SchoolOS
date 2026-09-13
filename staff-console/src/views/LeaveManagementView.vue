<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type LeaveRequestSummary } from '../lib/api';
import { useConfirm } from '../lib/useConfirm';
import StatusPill from '../components/StatusPill.vue';

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
  <div class="leave">
    <h1>Leave Applications</h1>

    <label class="field">
      <span>Status</span>
      <select data-testid="status-filter" v-model="statusFilter" @change="load">
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
        <option value="">All</option>
      </select>
    </label>

    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
    <p v-if="!requests.length && !errorMessage" class="empty">No leave requests here.</p>

    <ul class="requests-list">
      <li v-for="r in requests" :key="r.id" class="request-row">
        <div class="request-main">
          <strong>{{ r.studentName }}</strong>
          <span>{{ r.startDate }} to {{ r.endDate }}</span>
          <span class="reason">{{ r.reason }}</span>
        </div>
        <div class="request-actions">
          <StatusPill :tone="leaveTone(r.status)" :label="r.status" />
          <template v-if="r.status === 'pending'">
            <button
              :data-testid="`approve-${r.id}`"
              :disabled="busyId === r.id"
              @click="onApprove(r.id)"
            >
              Approve
            </button>
            <button
              :data-testid="`reject-${r.id}`"
              class="secondary"
              :disabled="busyId === r.id"
              @click="onReject(r.id)"
            >
              Reject
            </button>
          </template>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.leave {
  max-width: 720px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-4);
  max-width: 240px;
}
select {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
}
.error {
  color: var(--color-destructive);
}
.empty {
  color: var(--color-muted);
}
.requests-list {
  list-style: none;
  padding: 0;
}
.request-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border);
}
.request-main {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.reason {
  color: var(--color-muted);
  font-size: var(--font-size-sm);
}
.request-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
button {
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-on-primary);
  font-weight: 600;
  cursor: pointer;
}
button.secondary {
  background: transparent;
  color: var(--color-destructive);
  border: 1px solid var(--color-destructive);
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
