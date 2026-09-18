<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type OperationsSummary } from '../lib/api';
import { formatTimeAgo } from '../lib/format';
import Icon from '../components/AppIcon.vue';
import ErrorRetry from '../components/ErrorRetry.vue';
import AppSkeleton from '../components/AppSkeleton.vue';

const auth = useAuthStore();
const summary = ref<OperationsSummary | null>(null);
const errorMessage = ref<string | null>(null);

async function load() {
  if (!auth.accessToken) return;
  errorMessage.value = null;
  try {
    summary.value = await api.operationsSummary(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load dashboard data.';
  }
}
load();

const quickActions = [
  { testid: 'qa-add-student', label: 'Add Student', icon: 'users', to: '/admin/students' },
  { testid: 'qa-add-staff', label: 'Add Staff', icon: 'user-circle', to: '/admin/staff' },
  { testid: 'qa-record-payment', label: 'Record Payment', icon: 'receipt', to: '/admin/fees' },
  { testid: 'qa-new-circular', label: 'New Circular', icon: 'megaphone', to: '/admin/circulars' },
  { testid: 'qa-bulk-import', label: 'Bulk Import', icon: 'grid', to: '/admin/bulk-import' },
  { testid: 'qa-timetable', label: 'Timetable', icon: 'clock', to: '/admin/timetable' },
] as const;
</script>

<template>
  <div class="operations">
    <h1>Operations</h1>

    <ErrorRetry v-if="errorMessage" :message="errorMessage" @retry="load" />

    <div v-else-if="!summary" class="queue-row" data-testid="operations-skeleton">
      <div v-for="n in 4" :key="n" class="queue-tile"><AppSkeleton height="4rem" /></div>
    </div>

    <template v-else>
      <div class="queue-row">
        <RouterLink to="/admin/admissions" class="queue-tile" data-testid="queue-admissions">
          <span class="queue-icon queue-icon-info"><Icon name="plus" :size="16" /></span>
          <span class="queue-count">{{ summary.admissionsPending }}</span>
          <span class="queue-label">Admissions pending</span>
        </RouterLink>
        <RouterLink to="/admin/fees" class="queue-tile" data-testid="queue-fee-defaulters">
          <span class="queue-icon queue-icon-critical"><Icon name="receipt" :size="16" /></span>
          <span class="queue-count">{{ summary.feeDefaulters }}</span>
          <span class="queue-label">Fee defaulters</span>
        </RouterLink>
        <RouterLink to="/admin/leave" class="queue-tile" data-testid="queue-leave-requests">
          <span class="queue-icon queue-icon-warning"><Icon name="calendar" :size="16" /></span>
          <span class="queue-count">{{ summary.leaveRequestsPending }}</span>
          <span class="queue-label">Leave requests</span>
        </RouterLink>
        <RouterLink to="/admin/students" class="queue-tile" data-testid="queue-documents">
          <span class="queue-icon queue-icon-neutral"><Icon name="file-text" :size="16" /></span>
          <span class="queue-count">{{ summary.documentsToVerify }}</span>
          <span class="queue-label">Documents to verify</span>
        </RouterLink>
      </div>

      <div class="lower-grid">
        <div class="card">
          <h2>Quick actions</h2>
          <div class="qa-grid">
            <RouterLink v-for="qa in quickActions" :key="qa.testid" :data-testid="qa.testid" :to="qa.to" class="qa-tile">
              <Icon :name="qa.icon" :size="20" />
              <span>{{ qa.label }}</span>
            </RouterLink>
          </div>
        </div>

        <div class="card">
          <h2>Recent activity</h2>
          <ul v-if="summary.recentActivity.length" class="activity-list">
            <li v-for="alert in summary.recentActivity" :key="alert.id">
              <span>{{ alert.message }}</span>
              <span class="activity-time">{{ formatTimeAgo(alert.createdAt) }}</span>
            </li>
          </ul>
          <p v-else class="muted">No recent activity.</p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.operations {
  max-width: 1180px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.operations h1 {
  margin: 0;
}

.queue-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
}
.queue-tile {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  padding: var(--space-3) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  text-decoration: none;
  color: inherit;
}
.queue-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-1);
}
.queue-icon-info {
  background: var(--color-status-info-tint);
  color: var(--color-accent);
}
.queue-icon-critical {
  background: var(--color-status-critical-tint);
  color: var(--color-destructive);
}
.queue-icon-warning {
  background: var(--color-status-warning-tint);
  color: var(--color-late);
}
.queue-icon-neutral {
  background: var(--color-muted-bg);
  color: var(--color-text);
}
.queue-count {
  font-size: var(--font-size-xl);
  font-weight: 800;
}
.queue-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
}

.lower-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--space-4);
}
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  padding: var(--space-4);
}
.card h2 {
  margin: 0 0 var(--space-3);
  font-size: var(--font-size-base);
}

.qa-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}
.qa-tile {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  text-align: center;
  color: var(--color-accent);
  text-decoration: none;
  font-size: var(--font-size-sm);
  font-weight: 600;
}
.qa-tile span {
  color: var(--color-text);
}
.qa-tile:hover {
  border-color: var(--color-accent);
}

.activity-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.activity-list li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
}
.activity-list li:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.activity-time {
  color: var(--color-muted);
  font-size: var(--font-size-xs);
  white-space: nowrap;
}
.muted {
  color: var(--color-muted);
}

@media (max-width: 1024px) {
  .queue-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .lower-grid {
    grid-template-columns: 1fr;
  }
}
</style>
