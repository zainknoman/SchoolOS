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
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('../views/ForgotPasswordView.vue'),
      meta: { public: true, title: 'Forgot password' },
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('../views/ResetPasswordView.vue'),
      meta: { public: true, title: 'Reset password' },
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
      path: '/teacher/timetable',
      name: 'teacher-timetable',
      component: () => import('../views/TeacherTimetablePageView.vue'),
      meta: { requiresRole: ['TEACHER'], title: 'Timetable' },
    },
    {
      path: '/teacher/messages',
      name: 'teacher-messages',
      component: () => import('../views/MessagesPageView.vue'),
      meta: { requiresRole: ['TEACHER'], title: 'Messages' },
    },
    {
      path: '/teacher/complaints',
      name: 'teacher-complaints',
      component: () => import('../views/TeacherComplaintsPageView.vue'),
      meta: { requiresRole: ['TEACHER'], title: 'Complaints' },
    },
    {
      path: '/teacher/report-cards',
      name: 'teacher-report-cards',
      component: () => import('../views/TeacherReportCardsPageView.vue'),
      meta: { requiresRole: ['TEACHER'], title: 'Report Cards' },
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
      path: '/admin/students/:id',
      name: 'admin-student-profile',
      component: () => import('../views/StudentProfilePageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Student Profile' },
    },
    {
      path: '/admin/staff',
      name: 'admin-staff',
      component: () => import('../views/StaffManagementPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Staff' },
    },
    {
      path: '/admin/staff/:id',
      name: 'admin-staff-profile',
      component: () => import('../views/StaffProfilePageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Staff Profile' },
    },
    {
      path: '/admin/hiring/new',
      name: 'admin-hiring-new',
      component: () => import('../views/HiringCandidateIntakePageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'New Candidate' },
    },
    {
      path: '/admin/hiring',
      name: 'admin-hiring',
      component: () => import('../views/HiringQueuePageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Hiring' },
    },
    {
      path: '/admin/hiring/:id',
      name: 'admin-hiring-detail',
      component: () => import('../views/HiringApplicationDetailPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Hiring Application' },
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
    {
      path: '/admin/holidays',
      name: 'admin-holidays',
      component: () => import('../views/HolidaysPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Holidays' },
    },
    {
      path: '/admin/complaints',
      name: 'admin-complaints',
      component: () => import('../views/ComplaintsPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'], title: 'Complaints' },
    },
    {
      path: '/admin/report-cards',
      name: 'admin-report-cards',
      component: () => import('../views/ReportCardsPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Report Cards' },
    },
    {
      path: '/admin/terms',
      name: 'admin-terms',
      component: () => import('../views/TermsManagementPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Terms' },
    },
    {
      path: '/admin/assessment-categories',
      name: 'admin-assessment-categories',
      component: () => import('../views/AssessmentCategoriesPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Assessment Categories' },
    },
    {
      path: '/teacher/gradebook',
      name: 'teacher-gradebook',
      component: () => import('../views/MarksEntryPageView.vue'),
      meta: { requiresRole: ['TEACHER'], title: 'Gradebook' },
    },
    {
      path: '/admin/admissions',
      name: 'admin-admissions',
      component: () => import('../views/AdmissionsQueuePageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'], title: 'Admissions' },
    },
    {
      path: '/admin/admissions/new',
      name: 'admin-admissions-new',
      component: () => import('../views/ApplicantIntakePageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'], title: 'New Applicant' },
    },
    {
      path: '/admin/admissions/:id',
      name: 'admin-admission-detail',
      component: () => import('../views/ApplicationDetailPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'], title: 'Application' },
    },
    {
      path: '/admin/bulk-import',
      name: 'admin-bulk-import',
      component: () => import('../views/BulkImportPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Bulk Import' },
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
