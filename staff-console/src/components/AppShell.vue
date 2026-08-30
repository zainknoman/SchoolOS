<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import Icon from './AppIcon.vue';
import { roleInitials } from '../lib/format';

const auth = useAuthStore();
const router = useRouter();

const isTeacher = computed(() => auth.role === 'TEACHER');
const isAdmin = computed(() => ['SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'].includes(auth.role ?? ''));
const avatarInitials = computed(() => roleInitials(auth.role));

async function onLogout() {
  auth.logout();
  await router.push({ name: 'login' });
}
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <span class="brand">SEEDS Staff Console</span>
      <div class="topbar-actions">
        <button data-testid="notifications" class="icon-button" aria-label="Notifications">
          <Icon name="bell" :size="18" />
        </button>
        <span data-testid="avatar" class="avatar" aria-hidden="true">{{ avatarInitials }}</span>
        <button data-testid="logout" class="logout" @click="onLogout">
          <Icon name="logout" :size="16" />
          Log out
        </button>
      </div>
    </header>

    <div class="body">
      <nav class="sidenav" aria-label="Main">
        <template v-if="isTeacher">
          <RouterLink data-testid="nav-attendance" to="/teacher"><Icon name="calendar" />Attendance</RouterLink>
          <RouterLink data-testid="nav-diary" to="/teacher/diary"><Icon name="notebook" />Diary</RouterLink>
          <a data-testid="nav-timetable" href="#"><Icon name="clock" />Timetable</a>
          <RouterLink data-testid="nav-messages" to="/teacher/messages"><Icon name="chat" />Messages</RouterLink>
        </template>
        <template v-else-if="isAdmin">
          <RouterLink data-testid="nav-dashboard" to="/admin"><Icon name="home" />Dashboard</RouterLink>
          <a data-testid="nav-students" href="#"><Icon name="users" />Students</a>
          <a data-testid="nav-parents" href="#"><Icon name="user-circle" />Parents</a>
          <a data-testid="nav-teachers" href="#"><Icon name="chalkboard" />Teachers</a>
          <a data-testid="nav-classes" href="#"><Icon name="grid" />Classes</a>
          <a data-testid="nav-timetable" href="#"><Icon name="clock" />Timetable</a>
          <RouterLink data-testid="nav-circulars" to="/admin/circulars"><Icon name="megaphone" />Circulars</RouterLink>
          <RouterLink data-testid="nav-fees" to="/admin/fees"><Icon name="receipt" />Fees</RouterLink>
          <RouterLink data-testid="nav-messages" to="/admin/messages"><Icon name="chat" />Messages</RouterLink>
        </template>
      </nav>

      <main class="content">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--topbar-height);
  padding: 0 var(--space-4);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.brand {
  font-weight: 700;
  color: var(--color-primary);
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  background: transparent;
  color: var(--color-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.icon-button:hover {
  background: var(--color-muted-bg);
}

.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.logout {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text);
  border-radius: var(--radius-sm);
  padding: 0.45rem 0.8rem;
  font: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.logout:hover {
  background: var(--color-muted-bg);
}

.body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.sidenav {
  width: var(--sidebar-width);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: var(--space-3);
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
}

.sidenav a {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0.55rem 0.7rem;
  border-radius: var(--radius-sm);
  color: var(--color-text);
  text-decoration: none;
  font-size: var(--font-size-sm);
  transition: background var(--transition-fast);
}
.sidenav a:hover,
.sidenav a:focus-visible {
  background: var(--color-muted-bg);
}
.sidenav a.router-link-active {
  background: var(--color-muted-bg);
  font-weight: 600;
}

.content {
  flex: 1;
  padding: var(--space-5) var(--space-6);
  overflow-y: auto;
}
</style>
