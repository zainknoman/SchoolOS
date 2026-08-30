<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api, type NotificationSummary } from '../lib/api';
import Icon from './AppIcon.vue';
import { roleInitials } from '../lib/format';

const auth = useAuthStore();
const router = useRouter();

const isTeacher = computed(() => auth.role === 'TEACHER');
const isAdmin = computed(() => ['SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'].includes(auth.role ?? ''));
const avatarInitials = computed(() => roleInitials(auth.role));

const notifications = ref<NotificationSummary[]>([]);
const isNotifOpen = ref(false);
const notifError = ref<string | null>(null);
const unreadCount = computed(() => notifications.value.filter((n) => !n.readAt).length);

async function loadNotifications() {
  if (!auth.accessToken) return;
  try {
    notifications.value = await api.listNotifications(auth.accessToken);
  } catch {
    // Convenience only — a failed fetch just leaves the bell showing zero unread.
  }
}
onMounted(loadNotifications);

// Notifications for diary/circular events only ever target parents (see NotificationsService
// callers); staff will realistically only ever see 'message' type here, but this stays generic
// to match the "deep-links to the right screen" requirement for all three types.
//
// This is type-based, not role-based, so it can resolve to a route the current user's role can't
// enter (teacher-diary requires TEACHER only; admin-circulars requires SCHOOL_ADMIN/SUPER_ADMIN
// only, not ACCOUNTS). The router's global guard would silently bounce them elsewhere with no
// explanation, so fall back to the caller's own home route in those known-mismatch cases.
function routeForNotification(n: NotificationSummary): { path: string; query?: Record<string, string> } {
  if (n.type === 'message') {
    const path = isTeacher.value ? '/teacher/messages' : '/admin/messages';
    // entityRef is the conversation this notification was about — carry it through so the
    // Messages view opens that specific thread instead of just landing on the list.
    return n.entityRef ? { path, query: { conversationId: n.entityRef } } : { path };
  }
  const homeRoute = isTeacher.value ? '/teacher' : '/admin';
  if (n.type === 'diary') return { path: isTeacher.value ? '/teacher/diary' : homeRoute };
  const canViewCirculars = auth.role === 'SCHOOL_ADMIN' || auth.role === 'SUPER_ADMIN';
  return { path: canViewCirculars ? '/admin/circulars' : homeRoute };
}

async function onOpenNotification(n: NotificationSummary) {
  isNotifOpen.value = false;
  if (!auth.accessToken) return;
  if (!n.readAt) {
    try {
      await api.markNotificationRead(auth.accessToken, n.id);
      await loadNotifications();
    } catch {
      // Marking read is best-effort — don't block navigation to the relevant screen on it.
    }
  }
  await router.push(routeForNotification(n));
}

async function onMarkAllRead() {
  if (!auth.accessToken) return;
  notifError.value = null;
  try {
    await api.markAllNotificationsRead(auth.accessToken);
    await loadNotifications();
  } catch {
    notifError.value = 'Could not mark notifications read. Please try again.';
  }
}

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
        <div class="notif-wrapper">
          <button
            data-testid="notifications"
            class="icon-button"
            aria-label="Notifications"
            @click="isNotifOpen = !isNotifOpen"
          >
            <Icon name="bell" :size="18" />
            <span v-if="unreadCount > 0" class="badge" data-testid="notif-badge">{{ unreadCount }}</span>
          </button>
          <div v-if="isNotifOpen" class="notif-dropdown" data-testid="notif-dropdown">
            <p v-if="notifError" class="notif-error" data-testid="notif-error" role="alert">{{ notifError }}</p>
            <p v-if="!notifications.length" class="notif-empty">No notifications yet.</p>
            <button
              v-else
              data-testid="notif-mark-all-read"
              class="notif-mark-all"
              @click="onMarkAllRead"
            >
              Mark all read
            </button>
            <button
              v-for="n in notifications"
              :key="n.id"
              :data-testid="`notif-item-${n.id}`"
              class="notif-item"
              :class="{ unread: !n.readAt }"
              @click="onOpenNotification(n)"
            >
              <strong>{{ n.title }}</strong>
              <span>{{ n.body }}</span>
            </button>
          </div>
        </div>
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
          <RouterLink data-testid="nav-timetable" to="/admin/timetable"><Icon name="clock" />Timetable</RouterLink>
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

.notif-wrapper {
  position: relative;
}
.badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--color-destructive);
  color: white;
  border-radius: 999px;
  font-size: 0.65rem;
  min-width: 1.1rem;
  height: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.25rem;
}
.notif-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  width: 280px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 10;
  display: flex;
  flex-direction: column;
}
.notif-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  padding: var(--space-2) var(--space-3);
  border: none;
  border-bottom: 1px solid var(--color-border);
  background: none;
  text-align: left;
  cursor: pointer;
  font: inherit;
}
.notif-item.unread strong {
  font-weight: 700;
}
.notif-empty {
  padding: var(--space-3);
  color: var(--color-muted);
}
.notif-error {
  padding: var(--space-2) var(--space-3);
  color: var(--color-destructive);
  font-size: var(--font-size-sm);
}
.notif-mark-all {
  padding: var(--space-2) var(--space-3);
  border: none;
  border-bottom: 1px solid var(--color-border);
  background: none;
  text-align: left;
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-sm);
  color: var(--color-accent);
}
</style>
