<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type ClassHealthRow, type ExamScheduleStatusRow } from '../lib/api';
import ErrorRetry from '../components/ErrorRetry.vue';
import EmptyState from '../components/EmptyState.vue';
import AppSkeleton from '../components/AppSkeleton.vue';

const auth = useAuthStore();

const classHealth = ref<ClassHealthRow[]>([]);
const examScheduleStatus = ref<ExamScheduleStatusRow[]>([]);
const isLoading = ref(true);
const errorMessage = ref<string | null>(null);

async function load() {
  if (!auth.accessToken) return;
  isLoading.value = true;
  errorMessage.value = null;
  try {
    const summary = await api.principalAcademicsSummary(auth.accessToken);
    classHealth.value = summary.classHealth;
    examScheduleStatus.value = summary.examScheduleStatus;
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load Academics & Staff.';
  } finally {
    isLoading.value = false;
  }
}
load();
</script>

<template>
  <div class="academics-staff">
    <h1>Academics &amp; Staff</h1>

    <ErrorRetry v-if="errorMessage" :message="errorMessage" @retry="load" />

    <AppSkeleton v-else-if="isLoading" height="420px" />

    <div v-else class="layout">
      <div class="card class-health-card">
        <h2>Class health</h2>
        <EmptyState v-if="!classHealth.length" icon="chalkboard" title="No classes found yet." />
        <table v-else class="health-table">
          <thead>
            <tr>
              <th>Class / Section</th>
              <th>Attendance</th>
              <th>Avg. marks</th>
              <th>Teacher</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in classHealth" :key="row.sectionId">
              <td class="row-title">{{ row.className }} · {{ row.sectionName }}</td>
              <td class="mono" :class="{ warn: row.attendancePercent < 85 }">{{ row.attendancePercent }}%</td>
              <td class="mono">{{ row.averageMarksPercent !== null ? `${row.averageMarksPercent}%` : '—' }}</td>
              <td>{{ row.teacherName ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card exam-status-card">
        <h2>Exam schedule status</h2>
        <EmptyState v-if="!examScheduleStatus.length" icon="calendar" title="No assessment categories set up yet." />
        <div v-else class="exam-status-row" v-for="cat in examScheduleStatus" :key="cat.categoryId">
          <div>
            <div class="exam-status-title">{{ cat.categoryName }} — {{ cat.className }}</div>
            <div class="muted">{{ cat.termLabel }}</div>
          </div>
          <span class="pill" :class="cat.status === 'ready' ? 'pill-ready' : 'pill-pending'">
            {{ cat.status === 'ready' ? 'Ready' : 'Pending' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.academics-staff {
  max-width: 1180px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.academics-staff h1 {
  margin: 0;
}
.layout {
  display: flex;
  gap: var(--space-4);
  align-items: flex-start;
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
.class-health-card {
  flex: 1;
  min-width: 0;
}
.exam-status-card {
  width: 320px;
  flex-shrink: 0;
}

.health-table {
  width: 100%;
  border-collapse: collapse;
}
.health-table th {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-2xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-muted);
  border-bottom: 1px solid var(--color-border);
}
.health-table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
}
.health-table tbody tr:last-child td {
  border-bottom: none;
}
.row-title {
  font-weight: 700;
}
.warn {
  color: var(--color-late);
}

.exam-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}
.exam-status-row:last-child {
  border-bottom: none;
}
.exam-status-title {
  font-weight: 600;
  font-size: var(--font-size-sm);
}
.muted {
  color: var(--color-muted);
  font-size: var(--font-size-xs);
}
.pill {
  flex-shrink: 0;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-full);
  font-size: var(--font-size-2xs);
  font-weight: 700;
}
.pill-ready {
  background: var(--color-status-success-tint);
  color: var(--color-status-success);
}
.pill-pending {
  background: var(--color-status-warning-tint);
  color: var(--color-late);
}

@media (max-width: 900px) {
  .layout {
    flex-direction: column;
  }
  .exam-status-card {
    width: 100%;
  }
}
</style>
