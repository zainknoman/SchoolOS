<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api, type MyDayClass, type MyDayDiaryDue, type ConversationSummary } from '../lib/api';
import Icon from '../components/AppIcon.vue';
import ErrorRetry from '../components/ErrorRetry.vue';
import AppSkeleton from '../components/AppSkeleton.vue';
import EmptyState from '../components/EmptyState.vue';

const auth = useAuthStore();
const router = useRouter();

const classesToday = ref<MyDayClass[]>([]);
const diaryDueToday = ref<MyDayDiaryDue[]>([]);
const conversations = ref<ConversationSummary[]>([]);
const isLoading = ref(true);
const errorMessage = ref<string | null>(null);

const todayDisplay = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
}).format(new Date());

async function load() {
  if (!auth.accessToken) return;
  isLoading.value = true;
  errorMessage.value = null;
  try {
    const [myDay, convos] = await Promise.all([
      api.teacherMyDay(auth.accessToken),
      api.listConversations(auth.accessToken),
    ]);
    classesToday.value = myDay.classesToday;
    diaryDueToday.value = myDay.diaryDueToday;
    conversations.value = convos;
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load your day.';
  } finally {
    isLoading.value = false;
  }
}
load();

const attendanceMarkedCount = computed(() => classesToday.value.filter((c) => c.attendanceMarked).length);
const unreadMessagesCount = computed(() => conversations.value.filter((c) => c.unread).length);

function goMarkAttendance() {
  router.push('/teacher/attendance');
}
</script>

<template>
  <div class="my-day">
    <div class="page-header">
      <h1>My Day</h1>
      <p class="subtitle">{{ todayDisplay }}</p>
    </div>

    <ErrorRetry v-if="errorMessage" :message="errorMessage" @retry="load" />

    <template v-else-if="isLoading">
      <div class="stat-row">
        <div v-for="n in 3" :key="n" class="stat-card"><AppSkeleton height="2.5rem" /></div>
      </div>
      <AppSkeleton height="240px" />
    </template>

    <template v-else>
      <div class="stat-row">
        <div class="stat-card">
          <span class="stat-icon stat-icon-info"><Icon name="grid" :size="16" /></span>
          <div class="stat-mini">
            <span class="stat-value">{{ classesToday.length }}</span>
            <span class="stat-label">Classes today</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icon stat-icon-success"><Icon name="check" :size="16" /></span>
          <div class="stat-mini">
            <span class="stat-value">{{ attendanceMarkedCount }} of {{ classesToday.length }}</span>
            <span class="stat-label">Attendance marked</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icon stat-icon-warning"><Icon name="chat" :size="16" /></span>
          <div class="stat-mini">
            <span class="stat-value">{{ unreadMessagesCount }}</span>
            <span class="stat-label">Unread messages</span>
          </div>
        </div>
      </div>

      <div class="day-layout">
        <div class="card timeline-card">
          <h2>Today's classes</h2>
          <EmptyState v-if="!classesToday.length" icon="calendar" title="No classes scheduled today." />
          <div v-else class="class-row" v-for="c in classesToday" :key="c.timetableId">
            <span class="mono class-time">{{ c.startTime }}</span>
            <div class="class-info">
              <div class="class-title">{{ c.className }} · {{ c.sectionName }} — {{ c.subjectName }}</div>
              <div class="class-room" v-if="c.room">Room {{ c.room }}</div>
            </div>
            <span v-if="c.attendanceMarked" class="pill pill-success">Attendance marked</span>
            <button v-else type="button" class="btn-mini" :data-testid="`mark-attendance-${c.timetableId}`" @click="goMarkAttendance">
              Mark attendance
            </button>
          </div>
        </div>

        <div class="card diary-card">
          <h2>Diary due today</h2>
          <EmptyState v-if="!diaryDueToday.length" icon="notebook" title="Nothing due today." />
          <div v-else class="diary-row" v-for="d in diaryDueToday" :key="d.id">
            <div class="diary-title">{{ d.className }} · {{ d.sectionName }} — {{ d.subjectName }}</div>
            <div class="diary-text">{{ d.text }}</div>
          </div>
          <RouterLink to="/teacher/diary" class="btn-mini-ghost">+ Add diary entry</RouterLink>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.my-day {
  max-width: 1180px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.page-header h1 {
  margin: 0 0 var(--space-1);
}
.subtitle {
  color: var(--color-muted);
  font-size: var(--font-size-sm);
}

.stat-row {
  display: flex;
  gap: var(--space-3);
}
.stat-card {
  flex: 1;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  padding: var(--space-3) var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.stat-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}
.stat-icon-info {
  background: var(--color-status-info-tint);
  color: var(--color-accent);
}
.stat-icon-success {
  background: var(--color-status-success-tint);
  color: var(--color-status-success);
}
.stat-icon-warning {
  background: var(--color-status-warning-tint);
  color: var(--color-status-warning);
}
.stat-mini {
  display: flex;
  flex-direction: column;
}
.stat-value {
  font-size: var(--font-size-lg);
  font-weight: 800;
}
.stat-label {
  font-size: var(--font-size-xs);
  color: var(--color-muted);
}

.day-layout {
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
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.card h2 {
  margin: 0 0 var(--space-2);
  font-size: var(--font-size-base);
}
.timeline-card {
  flex: 1;
  min-width: 0;
}
.diary-card {
  width: 320px;
  flex-shrink: 0;
}

.class-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}
.class-row:last-child {
  border-bottom: none;
}
.class-time {
  width: 3.5rem;
  flex-shrink: 0;
  color: var(--color-muted);
  font-size: var(--font-size-sm);
}
.class-info {
  flex-grow: 1;
  min-width: 0;
}
.class-title {
  font-weight: 700;
}
.class-room {
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
.pill-success {
  background: var(--color-status-success-tint);
  color: var(--color-status-success);
}
.btn-mini {
  flex-shrink: 0;
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-on-primary);
  font-weight: 600;
  font-size: var(--font-size-xs);
  cursor: pointer;
}
.btn-mini-ghost {
  align-self: flex-start;
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font-weight: 600;
  font-size: var(--font-size-xs);
  text-decoration: none;
}

.diary-row {
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}
.diary-title {
  font-weight: 600;
  font-size: var(--font-size-sm);
}
.diary-text {
  color: var(--color-muted);
  font-size: var(--font-size-xs);
}

@media (max-width: 900px) {
  .stat-row {
    flex-direction: column;
  }
  .day-layout {
    flex-direction: column;
  }
  .diary-card {
    width: 100%;
  }
}
</style>
