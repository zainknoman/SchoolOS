import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const STAFF_ROLES = ['TEACHER', 'SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'];

function homeRouteForRole(role: string | null, isPrincipal: boolean): string {
  if (role === 'TEACHER') return '/teacher';
  // A Principal is a SCHOOL_ADMIN user with isPrincipal=true, not a separate role — they land on
  // their own overview instead of the generic admin dashboard, but keep full SCHOOL_ADMIN access.
  if (role === 'SCHOOL_ADMIN' && isPrincipal) return '/principal';
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
      path: '/change-password',
      name: 'change-password',
      component: () => import('../views/ChangePasswordView.vue'),
      meta: { title: 'Change password' },
    },
    {
      path: '/teacher',
      name: 'teacher-home',
      component: () => import('../views/TeacherHomeView.vue'),
      meta: { requiresRole: ['TEACHER'], title: 'My Day' },
    },
    {
      path: '/teacher/attendance',
      name: 'teacher-attendance',
      component: () => import('../views/AttendancePageView.vue'),
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
      meta: { requiresRole: ['SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'], title: 'Dashboard', group: 'Overview' },
    },
    {
      path: '/admin/schools',
      name: 'admin-schools',
      component: () => import('../views/SchoolManagementPageView.vue'),
      meta: { requiresRole: ['SUPER_ADMIN'], title: 'Schools', group: 'Org Structure' },
    },
    {
      path: '/admin/schools/new',
      name: 'admin-school-new',
      component: () => import('../views/SchoolProfilePageView.vue'),
      meta: { requiresRole: ['SUPER_ADMIN'], title: 'Add School', group: 'Org Structure' },
    },
    {
      path: '/admin/schools/:id',
      name: 'admin-school-profile',
      component: () => import('../views/SchoolProfilePageView.vue'),
      meta: { requiresRole: ['SUPER_ADMIN'], title: 'School Profile', group: 'Org Structure' },
    },
    {
      path: '/admin/campuses',
      name: 'admin-campuses',
      component: () => import('../views/CampusManagementPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Campuses', group: 'Org Structure' },
    },
    {
      path: '/admin/campuses/new',
      name: 'admin-campus-new',
      component: () => import('../views/CampusProfilePageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], requiresSchoolWide: true, title: 'Add Campus', group: 'Org Structure' },
    },
    {
      path: '/admin/campuses/:id',
      name: 'admin-campus-profile',
      component: () => import('../views/CampusProfilePageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Campus Profile', group: 'Org Structure' },
    },
    {
      path: '/admin/academic-sessions',
      name: 'admin-academic-sessions',
      component: () => import('../views/AcademicSessionManagementPageView.vue'),
      meta: { requiresRole: ['SUPER_ADMIN'], title: 'Academic Sessions', group: 'Org Structure' },
    },
    {
      path: '/admin/classes',
      name: 'admin-classes',
      component: () => import('../views/ClassManagementPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Classes', group: 'Org Structure' },
    },
    {
      path: '/admin/sections',
      name: 'admin-sections',
      component: () => import('../views/SectionManagementPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Sections', group: 'Org Structure' },
    },
    {
      path: '/admin/parents',
      name: 'admin-parents',
      component: () => import('../views/ParentManagementPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Parents', group: 'People' },
    },
    {
      path: '/admin/parents/:id',
      name: 'admin-parent-profile',
      component: () => import('../views/ParentProfilePageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Parent Profile', group: 'People' },
    },
    {
      path: '/admin/students',
      name: 'admin-students',
      component: () => import('../views/StudentManagementPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Students', group: 'People' },
    },
    {
      path: '/admin/students/:id',
      name: 'admin-student-profile',
      component: () => import('../views/StudentProfilePageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Student Profile', group: 'People' },
    },
    {
      path: '/admin/staff',
      name: 'admin-staff',
      component: () => import('../views/StaffManagementPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Staff', group: 'People' },
    },
    {
      path: '/admin/staff/:id',
      name: 'admin-staff-profile',
      component: () => import('../views/StaffProfilePageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Staff Profile', group: 'People' },
    },
    {
      path: '/admin/hiring/new',
      name: 'admin-hiring-new',
      component: () => import('../views/HiringCandidateIntakePageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'New Candidate', group: 'Operations' },
    },
    {
      path: '/admin/hiring',
      name: 'admin-hiring',
      component: () => import('../views/HiringQueuePageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Hiring', group: 'Operations' },
    },
    {
      path: '/admin/hiring/:id',
      name: 'admin-hiring-detail',
      component: () => import('../views/HiringApplicationDetailPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Hiring Application', group: 'Operations' },
    },
    {
      path: '/admin/fees',
      name: 'admin-fees',
      component: () => import('../views/FeeManagementPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'], title: 'Fees', group: 'Operations' },
    },
    {
      path: '/admin/circulars',
      name: 'admin-circulars',
      component: () => import('../views/CircularsPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Circulars', group: 'Communication' },
    },
    {
      path: '/admin/timetable',
      name: 'admin-timetable',
      component: () => import('../views/TimetablePageView.vue'),
      // Matches POST/PATCH/DELETE /api/v1/timetable's own @Roles — ACCOUNTS can't write a
      // timetable, so it doesn't get this screen either (same precedent as admin-circulars).
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Timetable', group: 'Operations' },
    },
    {
      path: '/admin/messages',
      name: 'admin-messages',
      component: () => import('../views/MessagesPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'], title: 'Messages', group: 'Communication' },
    },
    {
      path: '/admin/leave',
      name: 'admin-leave',
      component: () => import('../views/LeaveManagementPageView.vue'),
      // Matches POST /api/v1/leave-requests/:id/approve's own @Roles — ACCOUNTS can't decide
      // leave, so it doesn't get this screen either (same precedent as admin-circulars/admin-timetable).
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Leave Applications', group: 'Operations' },
    },
    {
      path: '/admin/promotions',
      name: 'admin-promotions',
      component: () => import('../views/PromotionPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Promotions', group: 'Operations' },
    },
    {
      path: '/admin/subjects',
      name: 'admin-subjects',
      component: () => import('../views/SubjectsPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Subjects', group: 'Operations' },
    },
    {
      path: '/admin/holidays',
      name: 'admin-holidays',
      component: () => import('../views/HolidaysPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Holidays', group: 'Operations' },
    },
    {
      path: '/admin/complaints',
      name: 'admin-complaints',
      component: () => import('../views/ComplaintsPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'], title: 'Complaints', group: 'Communication' },
    },
    {
      path: '/admin/report-cards',
      name: 'admin-report-cards',
      component: () => import('../views/ReportCardsPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Report Cards', group: 'Operations' },
    },
    {
      path: '/admin/terms',
      name: 'admin-terms',
      component: () => import('../views/TermsManagementPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Terms', group: 'Operations' },
    },
    {
      path: '/admin/assessment-categories',
      name: 'admin-assessment-categories',
      component: () => import('../views/AssessmentCategoriesPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Assessment Categories', group: 'Operations' },
    },
    {
      path: '/teacher/gradebook',
      name: 'teacher-gradebook',
      component: () => import('../views/TeacherGradebookOverviewPageView.vue'),
      meta: { requiresRole: ['TEACHER'], title: 'Gradebook' },
    },
    {
      path: '/teacher/gradebook/entry',
      name: 'teacher-gradebook-entry',
      component: () => import('../views/MarksEntryPageView.vue'),
      meta: { requiresRole: ['TEACHER'], title: 'Enter Marks', group: 'Gradebook' },
    },
    {
      path: '/principal',
      name: 'principal-overview',
      component: () => import('../views/PrincipalOverviewPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN'], requiresPrincipal: true, title: 'School Overview', group: 'Principal' },
    },
    {
      path: '/principal/academics-staff',
      name: 'principal-academics-staff',
      component: () => import('../views/PrincipalAcademicsStaffPageView.vue'),
      meta: {
        requiresRole: ['SCHOOL_ADMIN'],
        requiresPrincipal: true,
        title: 'Academics & Staff',
        group: 'Principal',
      },
    },
    {
      path: '/admin/admissions',
      name: 'admin-admissions',
      component: () => import('../views/AdmissionsQueuePageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'], title: 'Admissions', group: 'Operations' },
    },
    {
      path: '/admin/admissions/new',
      name: 'admin-admissions-new',
      component: () => import('../views/ApplicantIntakePageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'], title: 'New Applicant', group: 'Operations' },
    },
    {
      path: '/admin/admissions/:id',
      name: 'admin-admission-detail',
      component: () => import('../views/ApplicationDetailPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'], title: 'Application', group: 'Operations' },
    },
    {
      path: '/admin/bulk-import',
      name: 'admin-bulk-import',
      component: () => import('../views/BulkImportPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Bulk Import', group: 'Operations' },
    },
    { path: '/', redirect: '/login' },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();

  if (to.meta.public) {
    // Already logged in and heading to /login — send them straight to their own home instead.
    if (auth.isAuthenticated && to.name === 'login') {
      return homeRouteForRole(auth.role, auth.isPrincipal);
    }
    return true;
  }

  if (!auth.isAuthenticated) {
    return { name: 'login' };
  }

  // A provisioned login must set its own password before reaching anything else.
  if (auth.mustChangePassword && to.name !== 'change-password') {
    return { name: 'change-password' };
  }

  const requiresRole = to.meta.requiresRole as string[] | undefined;
  if (requiresRole && !requiresRole.includes(auth.role ?? '')) {
    // Wrong-role staff hitting the other console's route — send them home, not a blank/denied page.
    return homeRouteForRole(auth.role, auth.isPrincipal);
  }

  // Creating a campus needs a school-wide caller: a campus-scoped SCHOOL_ADMIN is sent home.
  if (to.meta.requiresSchoolWide && auth.role === 'SCHOOL_ADMIN' && auth.campusId) {
    return homeRouteForRole(auth.role, auth.isPrincipal);
  }

  if (to.meta.requiresPrincipal && !auth.isPrincipal) {
    return homeRouteForRole(auth.role, auth.isPrincipal);
  }

  return true;
});

export default router;
