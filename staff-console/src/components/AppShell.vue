<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/auth';
import { api, type NotificationSummary } from '../lib/api';
import Icon, { type IconName } from './AppIcon.vue';
import CommandPalette from './CommandPalette.vue';
import ConfirmDialog from './ConfirmDialog.vue';
import ToastHost from './ToastHost.vue';
import { roleInitials } from '../lib/format';
import { applyTheme, loadThemePreference, saveThemePreference } from '../lib/theme';
import {
  applyLocaleToDocument,
  loadLocalePreference,
  saveLocalePreference,
  type AppLocale,
} from '../lib/i18n';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const { t, locale } = useI18n();

const currentLocale = ref<AppLocale>(loadLocalePreference());
function onLocaleChange() {
  locale.value = currentLocale.value;
  saveLocalePreference(currentLocale.value);
  applyLocaleToDocument(currentLocale.value);
}

// --- Collapsible/overlay sidebar (below a mobile breakpoint only) ---
const sidebarOpen = ref(false);
const sidenavRef = ref<HTMLElement | null>(null);
let sidebarPreviouslyFocused: HTMLElement | null = null;

function closeSidebar() {
  sidebarOpen.value = false;
  sidebarPreviouslyFocused?.focus();
  sidebarPreviouslyFocused = null;
}

async function openSidebar() {
  sidebarPreviouslyFocused = document.activeElement as HTMLElement | null;
  sidebarOpen.value = true;
  await nextTick();
  sidenavRef.value?.querySelector<HTMLElement>('a')?.focus();
}

function onSidebarKeydown(event: KeyboardEvent) {
  if (!sidebarOpen.value) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeSidebar();
    return;
  }
  if (event.key === 'Tab') {
    const focusable = sidenavRef.value ? Array.from(sidenavRef.value.querySelectorAll<HTMLElement>('a')) : [];
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

const isTeacher = computed(() => auth.role === 'TEACHER');
const isAdmin = computed(() => ['SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'].includes(auth.role ?? ''));
const isPrincipal = computed(() => auth.role === 'SCHOOL_ADMIN' && auth.isPrincipal);
const canManageLeave = computed(() => auth.role === 'SCHOOL_ADMIN' || auth.role === 'SUPER_ADMIN');
const canManagePromotions = computed(() => auth.role === 'SCHOOL_ADMIN' || auth.role === 'SUPER_ADMIN');
// Schools and Academic Sessions are SUPER_ADMIN-only; Campuses/Classes/Sections are also open to SCHOOL_ADMIN.
const canManageOrgStructure = computed(() => auth.role === 'SUPER_ADMIN');
const canViewSessions = computed(() => auth.role === 'SUPER_ADMIN' || auth.role === 'SCHOOL_ADMIN');
const canManageOrgUnits = computed(() => auth.role === 'SCHOOL_ADMIN' || auth.role === 'SUPER_ADMIN');
const canManagePeople = computed(() => auth.role === 'SCHOOL_ADMIN' || auth.role === 'SUPER_ADMIN');
// Fixes a real pre-existing bug (PROJECT-STATUS.md): the nav used to show Circulars/Timetable to
// every admin-side role, but their route guards only allow SCHOOL_ADMIN/SUPER_ADMIN — an ACCOUNTS
// user clicking either link used to silently bounce back to /admin with no explanation.
const canManageCirculars = computed(() => auth.role === 'SCHOOL_ADMIN' || auth.role === 'SUPER_ADMIN');
const canManageTimetable = computed(() => auth.role === 'SCHOOL_ADMIN' || auth.role === 'SUPER_ADMIN');
const canManageHolidays = computed(() => auth.role === 'SCHOOL_ADMIN' || auth.role === 'SUPER_ADMIN');
const canManageGradebook = computed(() => auth.role === 'SCHOOL_ADMIN' || auth.role === 'SUPER_ADMIN');
const canManageReportCards = computed(
  () => auth.role === 'SCHOOL_ADMIN' || auth.role === 'SUPER_ADMIN',
);
// BL-32: ACCOUNTS sees admissions/complaints/messages only when a school admin granted them.
const canManageAdmissions = computed(
  () =>
    auth.role === 'SCHOOL_ADMIN' ||
    auth.role === 'SUPER_ADMIN' ||
    (auth.role === 'ACCOUNTS' && auth.hasModule('ADMISSIONS')),
);
const canUseMessages = computed(() => auth.hasModule('MESSAGES'));
const canUseComplaints = computed(() => auth.hasModule('COMPLAINTS'));
const canManageBulkImport = computed(() => auth.role === 'SCHOOL_ADMIN' || auth.role === 'SUPER_ADMIN');

// Deliberately SCHOOL_ADMIN/SUPER_ADMIN only, unlike canManageAdmissions — matches
// HiringCandidatesController/HiringApplicationsController's own @Roles (no ACCOUNTS; hiring is
// an HR function, not a fee-adjacent one, per the backend plan's Global Constraints).
const canManageHiring = computed(() => auth.role === 'SCHOOL_ADMIN' || auth.role === 'SUPER_ADMIN');

const avatarInitials = computed(() => roleInitials(auth.role));
const roleLabel = computed(() => {
  switch (auth.role) {
    case 'TEACHER':
      return 'Teacher';
    case 'SCHOOL_ADMIN':
      return 'School Admin';
    case 'ACCOUNTS':
      return 'Accounts';
    case 'SUPER_ADMIN':
      return 'Super Admin';
    default:
      return '';
  }
});

const breadcrumbGroup = computed(() => (route.meta.group as string | undefined) ?? '');
const breadcrumbTitle = computed(() => (route.meta.title as string | undefined) ?? '');

// --- Notifications (two-tier: numeric badge for actionable, dot for ambient) ---
const notifications = ref<NotificationSummary[]>([]);
const isNotifOpen = ref(false);
const notifError = ref<string | null>(null);
const actionableUnreadCount = computed(
  () => notifications.value.filter((n) => !n.readAt && n.type === 'message').length,
);
const hasAmbientUnread = computed(
  () => notifications.value.some((n) => !n.readAt && n.type !== 'message'),
);

async function loadNotifications() {
  if (!auth.accessToken) return;
  try {
    notifications.value = await api.listNotifications(auth.accessToken);
  } catch {
    // Convenience only — a failed fetch just leaves the bell showing zero unread.
  }
}
onMounted(loadNotifications);

function notifIcon(type: NotificationSummary['type']): IconName {
  if (type === 'message') return 'chat';
  if (type === 'diary') return 'notebook';
  return 'megaphone';
}

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

// --- Theme toggle (persisted; falls back to OS prefers-color-scheme when unset) ---
const themeOverride = ref<'light' | 'dark' | null>(null);

themeOverride.value = loadThemePreference();
applyTheme(themeOverride.value);

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

const isDarkActive = computed(() =>
  themeOverride.value ? themeOverride.value === 'dark' : systemPrefersDark(),
);

function onToggleTheme() {
  const next: 'light' | 'dark' = isDarkActive.value ? 'light' : 'dark';
  themeOverride.value = next;
  applyTheme(next);
  saveThemePreference(next);
}

// --- Command palette ---
const isPaletteOpen = ref(false);

interface CmdkGoTo { testid: string; label: string; icon: IconName; to: string }
interface CmdkAction { testid: string; label: string; icon: IconName; to: string; query?: Record<string, string> }

const goToItems = computed<CmdkGoTo[]>(() => {
  if (isTeacher.value) {
    return [
      { testid: 'cmdk-my-day', label: 'My Day', icon: 'home', to: '/teacher' },
      { testid: 'cmdk-attendance', label: 'Attendance', icon: 'calendar', to: '/teacher/attendance' },
      { testid: 'cmdk-diary', label: 'Diary', icon: 'notebook', to: '/teacher/diary' },
      { testid: 'cmdk-messages', label: 'Messages', icon: 'chat', to: '/teacher/messages' },
    ];
  }
  if (!isAdmin.value) return [];
  const items: CmdkGoTo[] = [{ testid: 'cmdk-dashboard', label: 'Dashboard', icon: 'home', to: '/admin' }];
  if (canManageAdmissions.value) {
    items.push({ testid: 'cmdk-admissions', label: 'Admissions', icon: 'users', to: '/admin/admissions' });
  }
  if (canManageHiring.value) {
    items.push({ testid: 'cmdk-hiring', label: 'Hiring', icon: 'users', to: '/admin/hiring' });
  }
  if (canManageBulkImport.value) {
    items.push({ testid: 'cmdk-bulk-import', label: 'Bulk Import', icon: 'grid', to: '/admin/bulk-import' });
  }
  if (canManageOrgStructure.value) {
    items.push({ testid: 'cmdk-schools', label: 'Schools', icon: 'chalkboard', to: '/admin/schools' });
  }
  if (canManageOrgUnits.value) {
    items.push({ testid: 'cmdk-campuses', label: 'Campuses', icon: 'grid', to: '/admin/campuses' });
  }
  if (canManageOrgStructure.value) {
    items.push({
      testid: 'cmdk-academic-sessions',
      label: 'Academic Sessions',
      icon: 'calendar',
      to: '/admin/academic-sessions',
    });
  }
  if (canManageOrgUnits.value) {
    items.push(
      { testid: 'cmdk-classes', label: 'Classes', icon: 'grid', to: '/admin/classes' },
      { testid: 'cmdk-sections', label: 'Sections', icon: 'grid', to: '/admin/sections' },
    );
  }
  if (canManagePeople.value) {
    items.push(
      { testid: 'cmdk-students', label: 'Students', icon: 'users', to: '/admin/students' },
      { testid: 'cmdk-staff', label: 'Staff', icon: 'users', to: '/admin/staff' },
      { testid: 'cmdk-parents', label: 'Parents', icon: 'user-circle', to: '/admin/parents' },
    );
  }
  if (canManageTimetable.value) {
    items.push({ testid: 'cmdk-timetable', label: 'Timetable', icon: 'clock', to: '/admin/timetable' });
  }
  items.push({ testid: 'cmdk-fees', label: 'Fees', icon: 'receipt', to: '/admin/fees' });
  if (canManageLeave.value) {
    items.push({ testid: 'cmdk-leave', label: 'Leave', icon: 'calendar', to: '/admin/leave' });
  }
  if (canManageCirculars.value) {
    items.push({ testid: 'cmdk-circulars', label: 'Circulars', icon: 'megaphone', to: '/admin/circulars' });
  }
  if (canUseMessages.value) {
    items.push({ testid: 'cmdk-messages', label: 'Messages', icon: 'chat', to: '/admin/messages' });
  }
  return items;
});

const actionItems = computed<CmdkAction[]>(() => {
  const items: CmdkAction[] = [];
  if (canManagePeople.value) {
    items.push({
      testid: 'cmdk-action-add-student',
      label: 'Add student',
      icon: 'users',
      to: '/admin/students',
      query: { focus: 'gr-number' },
    });
  }
  if (isAdmin.value) {
    items.push({
      testid: 'cmdk-action-issue-vouchers',
      label: 'Issue fee vouchers',
      icon: 'receipt',
      to: '/admin/fees',
      query: { focus: 'issue-section' },
    });
  }
  if (canManageLeave.value) {
    items.push({
      testid: 'cmdk-action-approve-leave',
      label: 'Approve a leave request',
      icon: 'calendar',
      to: '/admin/leave',
    });
  }
  if (canManageCirculars.value) {
    items.push({
      testid: 'cmdk-action-publish-circular',
      label: 'Publish a circular',
      icon: 'megaphone',
      to: '/admin/circulars',
      query: { focus: 'title' },
    });
  }
  if (canManageAdmissions.value) {
    items.push({
      testid: 'cmdk-action-new-applicant',
      label: 'New applicant',
      icon: 'users',
      to: '/admin/admissions/new',
    });
  }
  if (canManageHiring.value) {
    items.push({
      testid: 'cmdk-action-new-candidate',
      label: 'Add hiring candidate',
      icon: 'users',
      to: '/admin/hiring/new',
    });
  }
  if (canManageBulkImport.value) {
    items.push({
      testid: 'cmdk-action-bulk-import',
      label: 'Run a bulk import',
      icon: 'grid',
      to: '/admin/bulk-import',
      query: { focus: 'entity' },
    });
  }
  return items;
});

function onGlobalKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    isPaletteOpen.value = !isPaletteOpen.value;
    return;
  }
  if (event.key === 'Escape' && isNotifOpen.value) {
    isNotifOpen.value = false;
  }
}
onMounted(() => window.addEventListener('keydown', onGlobalKeydown));
onUnmounted(() => window.removeEventListener('keydown', onGlobalKeydown));

// Click-outside for the notifications dropdown — matches the command palette's own dismiss
// behavior (Escape above, click outside here); the palette itself doesn't need this since its
// overlay already closes on a click outside the panel.
const notifWrapperRef = ref<HTMLElement | null>(null);
function onDocumentClick(event: MouseEvent) {
  if (!isNotifOpen.value) return;
  if (notifWrapperRef.value && !notifWrapperRef.value.contains(event.target as Node)) {
    isNotifOpen.value = false;
  }
}
onMounted(() => document.addEventListener('click', onDocumentClick));
onUnmounted(() => document.removeEventListener('click', onDocumentClick));
</script>

<template>
  <div class="shell">
    <a href="#main-content" class="skip-link" data-testid="skip-link">{{ t('shell.skipToContent') }}</a>
    <header class="topbar">
      <button
        type="button"
        class="hamburger-toggle"
        data-testid="hamburger-toggle"
        aria-label="Open navigation menu"
        aria-haspopup="true"
        :aria-expanded="sidebarOpen"
        @click="openSidebar"
      >
        <Icon name="grid" :size="18" />
      </button>
      <span class="brand">{{ t('shell.brand') }}</span>
      <nav class="crumbs" aria-label="Breadcrumb" data-testid="breadcrumb">
        <span v-if="breadcrumbGroup" class="crumb-group" data-testid="breadcrumb-group">{{ breadcrumbGroup }}</span>
        <span v-if="breadcrumbGroup" class="crumb-sep" aria-hidden="true">/</span>
        <b>{{ breadcrumbTitle }}</b>
      </nav>
      <div class="topbar-spacer"></div>
      <button
        type="button"
        class="cmdk-trigger"
        data-testid="cmdk-trigger"
        aria-haspopup="dialog"
        :aria-expanded="isPaletteOpen"
        @click="isPaletteOpen = true"
      >
        <Icon name="search" :size="15" />
        <span>Jump to… or search</span>
        <kbd>Ctrl K</kbd>
      </button>
      <button
        type="button"
        class="icon-button"
        data-testid="theme-toggle"
        :aria-label="isDarkActive ? 'Switch to light theme' : 'Switch to dark theme'"
        :aria-pressed="isDarkActive"
        @click="onToggleTheme"
      >
        <Icon :name="isDarkActive ? 'sun' : 'moon'" :size="18" />
      </button>
      <select
        data-testid="language-switcher"
        class="language-switcher"
        :aria-label="t('shell.language')"
        v-model="currentLocale"
        @change="onLocaleChange"
      >
        <option value="en">English</option>
        <option value="ur">اردو</option>
      </select>
      <div class="topbar-actions">
        <div ref="notifWrapperRef" class="notif-wrapper">
          <button
            data-testid="notifications"
            class="icon-button"
            :aria-label="t('shell.notifications')"
            aria-haspopup="true"
            :aria-expanded="isNotifOpen"
            @click="isNotifOpen = !isNotifOpen"
          >
            <Icon name="bell" :size="18" />
            <span v-if="actionableUnreadCount > 0" class="badge" data-testid="notif-badge">{{
              actionableUnreadCount
            }}</span>
            <span v-else-if="hasAmbientUnread" class="badge-dot" data-testid="notif-dot" aria-hidden="true"></span>
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
              <span class="notif-icon" :class="{ actionable: n.type === 'message' && !n.readAt }">
                <Icon :name="notifIcon(n.type)" :size="14" />
              </span>
              <span class="notif-item-text">
                <strong>{{ n.title }}</strong>
                <span>{{ n.body }}</span>
              </span>
            </button>
          </div>
        </div>
        <span data-testid="avatar" class="avatar" aria-hidden="true">{{ avatarInitials }}</span>
        <span class="role-label">{{ roleLabel }}</span>
        <button data-testid="logout" class="logout" @click="onLogout">
          <Icon name="logout" :size="16" />
          Log out
        </button>
      </div>
    </header>

    <div class="body">
      <div
        v-if="sidebarOpen"
        class="sidenav-backdrop"
        data-testid="sidenav-backdrop"
        @click="closeSidebar"
      ></div>
      <nav
        ref="sidenavRef"
        class="sidenav"
        :class="{ open: sidebarOpen }"
        aria-label="Main"
        @keydown="onSidebarKeydown"
        @click="(e) => { if ((e.target as HTMLElement).closest('a')) closeSidebar(); }"
      >
        <template v-if="isTeacher">
          <RouterLink data-testid="nav-my-day" to="/teacher"><Icon name="home" />{{ t('nav.myDay') }}</RouterLink>
          <RouterLink data-testid="nav-attendance" to="/teacher/attendance"><Icon name="calendar" />{{ t('nav.attendance') }}</RouterLink>
          <RouterLink data-testid="nav-diary" to="/teacher/diary"><Icon name="notebook" />{{ t('nav.diary') }}</RouterLink>
          <RouterLink data-testid="nav-timetable" to="/teacher/timetable"><Icon name="grid" />{{ t('nav.timetable') }}</RouterLink>
          <RouterLink data-testid="nav-messages" to="/teacher/messages"><Icon name="chat" />{{ t('nav.messages') }}</RouterLink>
          <RouterLink data-testid="nav-complaints" to="/teacher/complaints"><Icon name="chat" />{{ t('nav.complaints') }}</RouterLink>
          <RouterLink data-testid="nav-report-cards" to="/teacher/report-cards"><Icon name="grid" />{{ t('nav.reportCards') }}</RouterLink>
          <RouterLink data-testid="nav-gradebook" to="/teacher/gradebook"><Icon name="grid" />{{ t('nav.gradebook') }}</RouterLink>
          <RouterLink data-testid="nav-syllabus" to="/teacher/syllabus"><Icon name="notebook" />{{ t('nav.syllabus') }}</RouterLink>
        </template>
        <template v-else-if="isAdmin">
          <div class="nav-group">
            <div class="nav-group-label">Overview</div>
            <RouterLink data-testid="nav-dashboard" to="/admin"><Icon name="home" />{{ t('nav.dashboard') }}</RouterLink>
          </div>

          <div v-if="isPrincipal" class="nav-group">
            <div class="nav-group-label">Principal</div>
            <RouterLink data-testid="nav-principal-overview" to="/principal"
              ><Icon name="home" />School Overview</RouterLink
            >
            <RouterLink data-testid="nav-principal-academics-staff" to="/principal/academics-staff"
              ><Icon name="chalkboard" />Academics &amp; Staff</RouterLink
            >
          </div>

          <div v-if="canManagePeople" class="nav-group">
            <div class="nav-group-label">People</div>
            <RouterLink data-testid="nav-students" to="/admin/students"><Icon name="users" />{{ t('nav.students') }}</RouterLink>
            <RouterLink data-testid="nav-staff" to="/admin/staff"><Icon name="users" />{{ t('nav.staff') }}</RouterLink>
            <RouterLink data-testid="nav-parents" to="/admin/parents"
              ><Icon name="user-circle" />{{ t('nav.parents') }}</RouterLink
            >
          </div>

          <div class="nav-group">
            <div class="nav-group-label">Operations</div>
            <!-- Active-pipeline workflows first (Admissions/Hiring/Bulk Import are the most
                 frequently-touched Operations items day-to-day), then recurring transactional
                 tasks (Fees/Leave/Timetable/Report Cards), then periodic/seasonal tasks
                 (Promotions/Holidays), then rarely-touched per-session setup last (Terms/
                 Assessment Categories). -->
            <RouterLink v-if="canManageAdmissions" data-testid="nav-admissions" to="/admin/admissions"
              ><Icon name="users" />{{ t('nav.admissions') }}</RouterLink
            >
            <RouterLink v-if="canManageHiring" data-testid="nav-hiring" to="/admin/hiring"
              ><Icon name="users" />{{ t('nav.hiring') }}</RouterLink
            >
            <RouterLink v-if="canManageBulkImport" data-testid="nav-bulk-import" to="/admin/bulk-import"
              ><Icon name="grid" />{{ t('nav.bulkImport') }}</RouterLink
            >
            <RouterLink v-if="canManageBulkImport" data-testid="nav-accounts-access" to="/admin/accounts-access"
              ><Icon name="users" />Accounts Access</RouterLink
            >
            <RouterLink v-if="canManageBulkImport" data-testid="nav-data-export" to="/admin/data-export"
              ><Icon name="grid" />Data Export</RouterLink
            >
            <RouterLink data-testid="nav-fees" to="/admin/fees"><Icon name="receipt" />{{ t('nav.fees') }}</RouterLink>
            <RouterLink v-if="canManageLeave" data-testid="nav-leave" to="/admin/leave"
              ><Icon name="calendar" />{{ t('nav.leave') }}</RouterLink
            >
            <RouterLink v-if="canManageTimetable" data-testid="nav-timetable" to="/admin/timetable"
              ><Icon name="clock" />{{ t('nav.timetable') }}</RouterLink
            >
            <RouterLink v-if="canManageReportCards" data-testid="nav-report-cards" to="/admin/report-cards"
              ><Icon name="grid" />{{ t('nav.reportCards') }}</RouterLink
            >
            <RouterLink v-if="canManagePromotions" data-testid="nav-promotions" to="/admin/promotions"
              ><Icon name="calendar" />{{ t('nav.promotions') }}</RouterLink
            >
            <RouterLink v-if="canManageHolidays" data-testid="nav-subjects" to="/admin/subjects"
              ><Icon name="grid" />{{ t('nav.subjects') }}</RouterLink
            >
            <RouterLink v-if="canManageHolidays" data-testid="nav-holidays" to="/admin/holidays"
              ><Icon name="calendar" />{{ t('nav.holidays') }}</RouterLink
            >
            <RouterLink v-if="canManageGradebook" data-testid="nav-terms" to="/admin/terms"
              ><Icon name="calendar" />{{ t('nav.terms') }}</RouterLink
            >
            <RouterLink
              v-if="canManageGradebook"
              data-testid="nav-assessment-categories"
              to="/admin/assessment-categories"
              ><Icon name="grid" />{{ t('nav.assessmentCategories') }}</RouterLink
            >
            <RouterLink v-if="canManageGradebook" data-testid="nav-grading-scales" to="/admin/grading-scales"
              ><Icon name="grid" />{{ t('nav.gradingScales') }}</RouterLink
            >
            <RouterLink v-if="canManageGradebook" data-testid="nav-syllabus" to="/admin/syllabus"
              ><Icon name="notebook" />{{ t('nav.syllabus') }}</RouterLink
            >
          </div>

          <div class="nav-group">
            <div class="nav-group-label">Communication</div>
            <RouterLink v-if="canUseMessages" data-testid="nav-messages" to="/admin/messages"
              ><Icon name="chat" />{{ t('nav.messages') }}</RouterLink
            >
            <RouterLink v-if="canManageCirculars" data-testid="nav-circulars" to="/admin/circulars"
              ><Icon name="megaphone" />{{ t('nav.circulars') }}</RouterLink
            >
            <RouterLink v-if="canUseComplaints" data-testid="nav-complaints" to="/admin/complaints"
              ><Icon name="chat" />{{ t('nav.complaints') }}</RouterLink
            >
          </div>

          <div v-if="canManageOrgUnits" class="nav-group">
            <div class="nav-group-label">Org Structure</div>
            <!-- Moved to last: one-time-per-session setup (Schools/Campuses/Academic Sessions/
                 Classes/Sections), the least frequently visited group day-to-day. -->
            <RouterLink v-if="canManageOrgStructure" data-testid="nav-schools" to="/admin/schools"
              ><Icon name="chalkboard" />{{ t('nav.schools') }}</RouterLink
            >
            <RouterLink data-testid="nav-campuses" to="/admin/campuses"><Icon name="grid" />{{ t('nav.campuses') }}</RouterLink>
            <RouterLink v-if="canViewSessions" data-testid="nav-academic-sessions" to="/admin/academic-sessions"
              ><Icon name="calendar" />{{ t('nav.academicSessions') }}</RouterLink
            >
            <RouterLink data-testid="nav-classes" to="/admin/classes"><Icon name="grid" />{{ t('nav.classes') }}</RouterLink>
            <RouterLink data-testid="nav-sections" to="/admin/sections"><Icon name="grid" />{{ t('nav.sections') }}</RouterLink>
          </div>
        </template>
      </nav>

      <main id="main-content" class="content">
        <slot />
      </main>
    </div>

    <CommandPalette
      :open="isPaletteOpen"
      :go-to-items="goToItems"
      :action-items="actionItems"
      @close="isPaletteOpen = false"
    />
    <ConfirmDialog />
    <ToastHost />
  </div>
</template>

<style scoped>
.shell {
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.skip-link {
  position: absolute;
  top: -100%;
  left: var(--space-3);
  z-index: 200;
  padding: 0.5rem 1rem;
  background: var(--color-accent);
  color: var(--color-on-primary);
  border-radius: var(--radius-sm);
  transition: top var(--transition-fast);
}
.skip-link:focus {
  top: var(--space-2);
}
.language-switcher {
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: var(--font-size-sm);
}

.topbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  height: var(--topbar-height);
  padding: 0 var(--space-4);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.brand {
  font-weight: 700;
  color: var(--color-primary);
  white-space: nowrap;
}

.crumbs {
  color: var(--color-muted);
  font-size: var(--font-size-sm);
}
.crumbs b {
  color: var(--color-text);
  font-weight: 600;
}
.crumb-sep {
  margin: 0 var(--space-1);
}

.topbar-spacer {
  flex: 1;
}

.cmdk-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: 6px var(--space-2) 6px 10px;
  border: 1px solid var(--color-border);
  background: var(--color-background);
  color: var(--color-muted);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  cursor: pointer;
  min-width: 200px;
  transition: border-color var(--transition-fast);
}
.cmdk-trigger:hover {
  border-color: var(--color-accent);
}
.cmdk-trigger span {
  flex: 1;
  text-align: left;
}
.cmdk-trigger kbd {
  font-family: var(--font-family-mono);
  font-size: 0.68rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 5px;
  padding: 1px 5px;
  color: var(--color-muted);
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.role-label {
  font-size: var(--font-size-xs);
  color: var(--color-muted);
  white-space: nowrap;
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
  flex-shrink: 0;
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
  gap: var(--space-0);
  padding: var(--space-3);
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
  overflow-y: auto;
}

.hamburger-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
}

/* Below this breakpoint the sidebar becomes an off-canvas overlay; above it, behavior is
   unchanged from the original static-flex-child layout (no new classes/attributes apply). */
@media (max-width: 768px) {
  .hamburger-toggle {
    display: inline-flex;
  }
  .sidenav {
    position: fixed;
    inset: 0 25% 0 0;
    z-index: 150;
    transform: translateX(-100%);
    transition: transform var(--transition-fast);
    box-shadow: 0 0 0 transparent;
  }
  .sidenav.open {
    transform: translateX(0);
    box-shadow: 20px 0 40px -20px rgb(var(--shadow-color) / 0.35);
  }
  .sidenav-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(2, 6, 12, 0.5);
    z-index: 140;
  }
}

.nav-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-0);
  margin-top: var(--space-3);
}
.nav-group:first-child {
  margin-top: 0;
}
.nav-group-label {
  font-size: var(--font-size-2xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-muted);
  padding: var(--space-0-5) 0.7rem var(--space-0);
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
  border-radius: var(--radius-full);
  font-size: var(--font-size-2xs);
  min-width: 1.1rem;
  height: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.25rem;
}
.badge-dot {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-accent);
  border: 1.5px solid var(--color-surface);
}
.notif-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  width: 300px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
  z-index: 10;
  display: flex;
  flex-direction: column;
}
.notif-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: none;
  border-bottom: 1px solid var(--color-border);
  background: none;
  text-align: left;
  cursor: pointer;
  font: inherit;
}
.notif-icon {
  width: 1.6rem;
  height: 1.6rem;
  border-radius: var(--radius-sm);
  background: var(--color-muted-bg);
  color: var(--color-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.notif-icon.actionable {
  background: var(--color-status-info-tint);
  color: var(--color-status-info);
}
.notif-item-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-0-5);
  min-width: 0;
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
