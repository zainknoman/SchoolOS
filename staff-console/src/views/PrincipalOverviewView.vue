<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type DashboardSummary, type AttendanceRiskSummary } from '../lib/api';
import { formatPkrShort, formatPkrFull, formatTimeAgo } from '../lib/format';
import ErrorRetry from '../components/ErrorRetry.vue';
import AppSkeleton from '../components/AppSkeleton.vue';
import TrendsSparkline from '../components/TrendsSparkline.vue';

const auth = useAuthStore();

const summary = ref<DashboardSummary | null>(null);
const flaggedStudents = ref<AttendanceRiskSummary[]>([]);
const pendingAdmissions = ref(0);
const isLoading = ref(true);
const errorMessage = ref<string | null>(null);

async function load() {
  if (!auth.accessToken) return;
  isLoading.value = true;
  errorMessage.value = null;
  try {
    summary.value = await api.dashboardSummary(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load the school overview.';
  }
  try {
    flaggedStudents.value = await api.getFlaggedStudents(auth.accessToken);
  } catch {
    // Non-critical — the rest of the overview still renders without it.
  }
  try {
    pendingAdmissions.value = (await api.operationsSummary(auth.accessToken)).admissionsPending;
  } catch {
    // Non-critical — same as above.
  }
  isLoading.value = false;
}
load();

const enrollmentTrend = () => (summary.value?.weeklyTrend.map((d) => d.attendancePercent) ?? []);
</script>

<template>
  <div class="overview">
    <h1>School Overview</h1>

    <ErrorRetry v-if="errorMessage" :message="errorMessage" @retry="load" />

    <AppSkeleton v-else-if="isLoading || !summary" height="420px" />

    <template v-else>
      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-label">Enrollment</div>
          <div class="kpi-value">{{ formatPkrFull(summary.studentsTotal) }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Attendance today</div>
          <div class="kpi-value" :class="{ good: summary.presentTodayPercent >= 90 }">{{ summary.presentTodayPercent }}%</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Fee collection (MTD)</div>
          <div class="kpi-value">{{ formatPkrShort(summary.feesCollectedPkr) }} <span class="unit">PKR</span></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Outstanding fees</div>
          <div class="kpi-value warn">{{ formatPkrShort(summary.feesOutstandingPkr) }} <span class="unit">PKR</span></div>
        </div>
      </div>

      <div class="lower-grid">
        <div class="card">
          <h2>Trends <span class="muted">(This Week)</span></h2>
          <TrendsSparkline
            :labels="summary.weeklyTrend.map((d) => d.day)"
            :series="[{ label: 'Attendance %', color: 'var(--color-accent)', unit: '%', values: enrollmentTrend() }]"
          />
        </div>

        <div class="card needs-attention">
          <h2>Needs attention</h2>
          <div class="attention-row">
            <span class="dot dot-critical"></span>
            <span class="attention-label">At-risk students</span>
            <span class="mono attention-value">{{ flaggedStudents.length }}</span>
          </div>
          <div class="attention-row">
            <span class="dot dot-warning"></span>
            <span class="attention-label">Absent today</span>
            <span class="mono attention-value">{{ summary.absentToday }}</span>
          </div>
          <div class="attention-row">
            <span class="dot dot-info"></span>
            <span class="attention-label">Pending admissions</span>
            <span class="mono attention-value">{{ pendingAdmissions }}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Recent alerts</h2>
        <ul v-if="summary.recentAlerts.length" class="alert-list">
          <li v-for="alert in summary.recentAlerts" :key="alert.id">
            <span>{{ alert.message }}</span>
            <span class="alert-time">{{ formatTimeAgo(alert.createdAt) }}</span>
          </li>
        </ul>
        <p v-else class="muted">No recent alerts.</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.overview {
  max-width: 1180px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.overview h1 {
  margin: 0;
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
}
.kpi-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  padding: var(--space-3) var(--space-4);
}
.kpi-label {
  font-size: var(--font-size-2xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-muted);
  margin-bottom: var(--space-1);
}
.kpi-value {
  font-size: var(--font-size-xl);
  font-weight: 800;
}
.kpi-value.good {
  color: var(--color-status-success);
}
.kpi-value.warn {
  color: var(--color-late);
}
.unit {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-muted);
}

.lower-grid {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: var(--space-4);
  align-items: start;
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
.muted {
  color: var(--color-muted);
  font-weight: 400;
  font-size: var(--font-size-sm);
}

.attention-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}
.attention-row:last-child {
  border-bottom: none;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-critical {
  background: var(--color-destructive);
}
.dot-warning {
  background: var(--color-late);
}
.dot-info {
  background: var(--color-accent);
}
.attention-label {
  flex-grow: 1;
  font-weight: 600;
  font-size: var(--font-size-sm);
}
.attention-value {
  font-weight: 700;
}

.alert-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.alert-list li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
}
.alert-list li:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.alert-time {
  color: var(--color-muted);
  font-size: var(--font-size-xs);
  flex-shrink: 0;
}

@media (max-width: 1024px) {
  .kpi-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .lower-grid {
    grid-template-columns: 1fr;
  }
}
</style>
