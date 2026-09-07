import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const STAFF_ROLES = ['TEACHER', 'SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'];

function homeRouteForRole(role: string | null): string {
  if (role === 'TEACHER') return '/teacher';
  if (role && STAFF_ROLES.includes(role)) return '/admin';
  return '/login';
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { public: true, title: 'Log in' },
    },
    {
      path: '/teacher',
      name: 'teacher-home',
      component: () => import('../views/TeacherHomeView.vue'),
      meta: { requiresRole: ['TEACHER'], title: 'Attendance' },
    },
    {
      path: '/teacher/diary',
      name: 'teacher-diary',
      component: () => import('../views/DiaryPageView.vue'),
      meta: { requiresRole: ['TEACHER'], title: 'Diary' },
    },
    {
      path: '/teacher/messages',
      name: 'teacher-messages',
      component: () => import('../views/MessagesPageView.vue'),
      meta: { requiresRole: ['TEACHER'], title: 'Messages' },
    },
    {
      path: '/admin',
      name: 'admin-home',
      component: () => import('../views/AdminHomeView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'], title: 'Dashboard' },
    },
    {
      path: '/admin/schools',
      name: 'admin-schools',
      component: () => import('../views/SchoolManagementPageView.vue'),
      meta: { requiresRole: ['SUPER_ADMIN'], title: 'Schools' },
    },
    {
      path: '/admin/campuses',
      name: 'admin-campuses',
      component: () => import('../views/CampusManagementPageView.vue'),
      meta: { requiresRole: ['SUPER_ADMIN'], title: 'Campuses' },
    },
    {
      path: '/admin/academic-sessions',
      name: 'admin-academic-sessions',
      component: () => import('../views/AcademicSessionManagementPageView.vue'),
      meta: { requiresRole: ['SUPER_ADMIN'], title: 'Academic Sessions' },
    },
    {
      path: '/admin/classes',
      name: 'admin-classes',
      component: () => import('../views/ClassManagementPageView.vue'),
      meta: { requiresRole: ['SUPER_ADMIN'], title: 'Classes' },
    },
    {
      path: '/admin/sections',
      name: 'admin-sections',
      component: () => import('../views/SectionManagementPageView.vue'),
      meta: { requiresRole: ['SUPER_ADMIN'], title: 'Sections' },
    },
    {
      path: '/admin/teachers',
      name: 'admin-teachers',
      component: () => import('../views/TeacherManagementPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Teachers' },
    },
    {
      path: '/admin/parents',
      name: 'admin-parents',
      component: () => import('../views/ParentManagementPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Parents' },
    },
    {
      path: '/admin/students',
      name: 'admin-students',
      component: () => import('../views/StudentManagementPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Students' },
    },
    {
      path: '/admin/fees',
      name: 'admin-fees',
      component: () => import('../views/FeeManagementPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'], title: 'Fees' },
    },
    {
      path: '/admin/circulars',
      name: 'admin-circulars',
      component: () => import('../views/CircularsPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Circulars' },
    },
    {
      path: '/admin/timetable',
      name: 'admin-timetable',
      component: () => import('../views/TimetablePageView.vue'),
      // Matches POST/PATCH/DELETE /api/v1/timetable's own @Roles — ACCOUNTS can't write a
      // timetable, so it doesn't get this screen either (same precedent as admin-circulars).
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Timetable' },
    },
    {
      path: '/admin/messages',
      name: 'admin-messages',
      component: () => import('../views/MessagesPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'], title: 'Messages' },
    },
    {
      path: '/admin/leave',
      name: 'admin-leave',
      component: () => import('../views/LeaveManagementPageView.vue'),
      // Matches POST /api/v1/leave-requests/:id/approve's own @Roles — ACCOUNTS can't decide
      // leave, so it doesn't get this screen either (same precedent as admin-circulars/admin-timetable).
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Leave Applications' },
    },
    { path: '/', redirect: '/login' },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();

  if (to.meta.public) {
    // Already logged in and heading to /login — send them straight to their own home instead.
    if (auth.isAuthenticated && to.name === 'login') {
      return homeRouteForRole(auth.role);
    }
    return true;
  }

  if (!auth.isAuthenticated) {
    return { name: 'login' };
  }

  const requiresRole = to.meta.requiresRole as string[] | undefined;
  if (requiresRole && !requiresRole.includes(auth.role ?? '')) {
    // Wrong-role staff hitting the other console's route — send them home, not a blank/denied page.
    return homeRouteForRole(auth.role);
  }

  return true;
});

export default router;
