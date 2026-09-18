<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type GradebookClassRow, type UpcomingExamRow } from '../lib/api';
import ErrorRetry from '../components/ErrorRetry.vue';
import EmptyState from '../components/EmptyState.vue';
import AppSkeleton from '../components/AppSkeleton.vue';

const auth = useAuthStore();

const classes = ref<GradebookClassRow[]>([]);
const upcomingExams = ref<UpcomingExamRow[]>([]);
const isLoading = ref(true);
const errorMessage = ref<string | null>(null);

async function load() {
  if (!auth.accessToken) return;
  isLoading.value = true;
  errorMessage.value = null;
  try {
    const overview = await api.teacherGradebookOverview(auth.accessToken);
    classes.value = overview.classes;
    upcomingExams.value = overview.upcomingExams;
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load your gradebook.';
  } finally {
    isLoading.value = false;
  }
}
load();

function progressStatus(row: GradebookClassRow): { label: string; tone: 'complete' | 'progress' | 'due' | 'none' } {
  if (row.marksEnteredCount === 0) return { label: 'Not started', tone: 'none' };
  if (row.marksEnteredCount >= row.studentsCount) return { label: 'Complete', tone: 'complete' };
  return { label: 'In progress', tone: 'progress' };
}
</script>

<template>
  <div class="gradebook-overview">
    <h1>Gradebook</h1>

    <ErrorRetry v-if="errorMessage" :message="errorMessage" @retry="load" />

    <AppSkeleton v-else-if="isLoading" height="360px" />

    <div v-else class="layout">
      <div class="card classes-card">
        <h2>My classes — marks entry</h2>
        <EmptyState v-if="!classes.length" icon="grid" title="No classes assigned yet." />
        <div v-else class="class-item" v-for="row in classes" :key="`${row.sectionId}-${row.subjectId}`">
          <div class="class-item-info">
            <div class="class-item-title">{{ row.className }} · {{ row.sectionName }} — {{ row.subjectName }}</div>
            <div class="class-item-sub muted">
              {{ row.termLabel ?? 'No active term' }} · {{ row.studentsCount }} students
            </div>
          </div>
          <div class="class-item-progress">
            <div class="progress-track">
              <div
                class="progress-fill"
                :style="{ width: `${row.studentsCount ? Math.round((row.marksEnteredCount / row.studentsCount) * 100) : 0}%` }"
              ></div>
            </div>
            <div class="mono muted progress-label">{{ row.marksEnteredCount }} of {{ row.studentsCount }} entered</div>
          </div>
          <span class="pill" :class="`pill-${progressStatus(row).tone}`">{{ progressStatus(row).label }}</span>
          <RouterLink class="btn-mini-ghost" :to="`/teacher/gradebook/entry?sectionId=${row.sectionId}`">
            {{ row.marksEnteredCount === 0 ? 'Enter marks' : 'Review' }}
          </RouterLink>
        </div>
      </div>

      <div class="card exams-card">
        <h2>Upcoming exams</h2>
        <EmptyState v-if="!upcomingExams.length" icon="calendar" title="Nothing scheduled." />
        <div v-else class="exam-row" v-for="exam in upcomingExams" :key="exam.termId">
          <div>
            <div class="exam-title">{{ exam.label }}</div>
            <div class="muted exam-date">{{ new Date(exam.startDate).toLocaleDateString() }}</div>
          </div>
          <span class="mono exam-countdown">{{ exam.daysUntil }} days</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gradebook-overview {
  max-width: 1180px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.gradebook-overview h1 {
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
  padding: 0;
  display: flex;
  flex-direction: column;
}
.card h2 {
  margin: 0;
  font-size: var(--font-size-base);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}
.classes-card {
  flex: 1;
  min-width: 0;
}
.exams-card {
  width: 300px;
  flex-shrink: 0;
}

.class-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}
.class-item:last-child {
  border-bottom: none;
}
.class-item-info {
  flex: 1;
  min-width: 0;
}
.class-item-title {
  font-weight: 700;
  font-size: var(--font-size-sm);
}
.class-item-sub {
  font-size: var(--font-size-xs);
}
.class-item-progress {
  width: 160px;
  flex-shrink: 0;
}
.progress-track {
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--color-muted-bg);
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: var(--radius-full);
}
.progress-label {
  font-size: var(--font-size-2xs);
  margin-top: 0.2rem;
}
.pill {
  flex-shrink: 0;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-full);
  font-size: var(--font-size-2xs);
  font-weight: 700;
  white-space: nowrap;
}
.pill-complete {
  background: var(--color-status-success-tint);
  color: var(--color-status-success);
}
.pill-progress {
  background: var(--color-status-info-tint);
  color: var(--color-accent);
}
.pill-none {
  background: var(--color-muted-bg);
  color: var(--color-muted);
}
.btn-mini-ghost {
  flex-shrink: 0;
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font-weight: 600;
  font-size: var(--font-size-xs);
  text-decoration: none;
  white-space: nowrap;
}

.exam-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}
.exam-row:last-child {
  border-bottom: none;
}
.exam-title {
  font-weight: 600;
  font-size: var(--font-size-sm);
}
.exam-date {
  font-size: var(--font-size-xs);
}
.exam-countdown {
  font-weight: 700;
  color: var(--color-late);
  font-size: var(--font-size-sm);
}
.muted {
  color: var(--color-muted);
}

@media (max-width: 900px) {
  .layout {
    flex-direction: column;
  }
  .exams-card {
    width: 100%;
  }
  .class-item {
    flex-wrap: wrap;
  }
}
</style>
