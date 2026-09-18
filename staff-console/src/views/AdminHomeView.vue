<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import AppShell from '../components/AppShell.vue';
import Icon from '../components/AppIcon.vue';
import TrendsSparkline from '../components/TrendsSparkline.vue';
import AppSkeleton from '../components/AppSkeleton.vue';
import ErrorRetry from '../components/ErrorRetry.vue';
import { useAuthStore } from '../stores/auth';
import { api, type DashboardSummary, type AttendanceRiskSummary } from '../lib/api';
import { formatPkrShort, formatPkrFull } from '../lib/format';

const auth = useAuthStore();
const summary = ref<DashboardSummary | null>(null);
const flaggedStudents = ref<AttendanceRiskSummary[]>([]);
const errorMessage = ref<string | null>(null);

function formatTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

async function loadDashboard() {
  if (!auth.accessToken) return;
  errorMessage.value = null;
  try {
    summary.value = await api.dashboardSummary(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load dashboard data.';
  }
  try {
    flaggedStudents.value = await api.getFlaggedStudents(auth.accessToken);
  } catch {
    // Non-critical — the rest of the dashboard still renders without the early-warning panel.
  }
}
onMounted(loadDashboard);

const trendLabels = computed(() => summary.value?.weeklyTrend.map((d) => d.day) ?? []);
const maxFees = computed(
  () => Math.max(...(summary.value?.weeklyTrend.map((d) => d.feesCollectedPkr) ?? [0])) || 1,
);
const trendSeries = computed(() => [
  {
    label: 'Attendance %',
    color: 'var(--color-primary)',
    unit: '%',
    values: summary.value?.weeklyTrend.map((d) => d.attendancePercent) ?? [],
  },
  {
    label: 'Fees Collected (PKR)',
    color: 'var(--color-muted)',
    dashed: true,
    unit: ' PKR',
    values: summary.value?.weeklyTrend.map((d) => (d.feesCollectedPkr / maxFees.value) * 100) ?? [],
  },
]);
</script>

<template>
  <AppShell>
    <ErrorRetry v-if="errorMessage" :message="errorMessage" @retry="loadDashboard" />
    <div v-else-if="!summary" class="dashboard" data-testid="dashboard-skeleton">
      <div class="stat-grid">
        <div v-for="n in 4" :key="n" class="stat-card">
          <AppSkeleton width="60%" height="0.8rem" />
          <AppSkeleton width="40%" height="1.8rem" />
        </div>
      </div>
      <div class="lower-grid">
        <div class="trends-panel">
          <AppSkeleton width="100%" height="180px" />
        </div>
        <div class="alerts-panel skeleton-stack">
          <AppSkeleton v-for="n in 3" :key="n" height="1rem" />
        </div>
      </div>
    </div>
    <div v-else class="dashboard">
      <div class="dashboard-header">
        <h1>Dashboard</h1>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Students</div>
          <div class="stat-value">{{ formatPkrFull(summary.studentsTotal) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Present</div>
          <div class="stat-value">{{ summary.presentTodayPercent }}%</div>
          <div class="stat-hint">Today</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Fees Collected</div>
          <div class="stat-value">
            {{ formatPkrShort(summary.feesCollectedPkr) }} <span class="stat-unit">PKR</span>
          </div>
          <div class="stat-hint">Month to date</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Outstanding</div>
          <div class="stat-value">
            {{ formatPkrShort(summary.feesOutstandingPkr) }} <span class="stat-unit">PKR</span>
          </div>
          <div class="stat-hint">Total</div>
        </div>
      </div>

      <div class="secondary-row">
        <div class="secondary-card">
          <span class="secondary-icon"><Icon name="user-circle" :size="18" /></span>
          <span class="secondary-label">Absent today</span>
          <span class="secondary-value">{{ summary.absentToday }}</span>
        </div>
      </div>

      <div class="lower-grid">
        <div class="trends-panel">
          <h2>Trends <span class="muted">(This Week)</span></h2>
          <TrendsSparkline :labels="trendLabels" :series="trendSeries" />
        </div>

        <div class="alerts-panel">
          <h2>Recent Alerts</h2>
          <ul class="alert-list">
            <li v-for="alert in summary.recentAlerts" :key="alert.id">
              <span>{{ alert.message }}</span>
              <span class="alert-time">{{ formatTimeAgo(alert.createdAt) }}</span>
            </li>
          </ul>
        </div>
      </div>

      <div v-if="flaggedStudents.length" class="risk-panel" data-testid="attendance-risk-panel">
        <h2>Attendance Risk <span class="muted">(≥25% absence, last 30 days)</span></h2>
        <ul class="risk-list">
          <li v-for="s in flaggedStudents" :key="s.studentId">
            <RouterLink to="/admin/students" :data-testid="`risk-student-${s.studentId}`">
              {{ s.studentName }}
            </RouterLink>
            <span class="risk-rate">{{ Math.round(s.absenceRate * 100) }}% absent</span>
          </li>
        </ul>
      </div>
    </div>
  </AppShell>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 1200px;
}
.skeleton-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-4);
}
@media (max-width: 1024px) {
  .stat-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 640px) {
  .stat-grid {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.stat-label {
  color: var(--color-muted);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  margin-bottom: var(--space-1);
}
.stat-value {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-primary);
}
.stat-unit {
  font-size: var(--font-size-lg);
  font-weight: 400;
  color: var(--color-muted);
}
.stat-hint {
  color: var(--color-muted);
  font-size: var(--font-size-xs);
  margin-top: var(--space-1);
}

.secondary-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
}
@media (max-width: 768px) {
  .secondary-row {
    grid-template-columns: 1fr;
  }
}
.secondary-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-3) var(--space-4);
}
.secondary-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-sm);
  background: var(--color-muted-bg);
  color: var(--color-muted);
}
.secondary-icon.warning {
  background: color-mix(in srgb, var(--color-destructive) 12%, white);
  color: var(--color-destructive);
}
.secondary-label {
  flex: 1;
  font-weight: 500;
}
.secondary-value {
  font-size: var(--font-size-xl);
  font-weight: 700;
}

.lower-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--space-4);
}
@media (max-width: 1024px) {
  .lower-grid {
    grid-template-columns: 1fr;
  }
}

.trends-panel,
.alerts-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-4);
}
.trends-panel h2,
.alerts-panel h2 {
  font-size: var(--font-size-base);
  margin-bottom: var(--space-4);
}
.muted {
  color: var(--color-muted);
  font-weight: 400;
  font-size: var(--font-size-sm);
}

.alert-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.alert-list li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}
.alert-list li:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.alert-time {
  color: var(--color-muted);
  font-size: var(--font-size-xs);
  white-space: nowrap;
}

.risk-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-4);
}
.risk-panel h2 {
  font-size: var(--font-size-base);
  margin-bottom: var(--space-4);
}
.risk-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.risk-list li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}
.risk-list li:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.risk-rate {
  color: var(--color-destructive);
  font-weight: 600;
  white-space: nowrap;
}
</style>
