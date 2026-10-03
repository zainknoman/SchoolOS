// The in-console Help Document (header menu → Help Document, route /help).
// One entry per screen or header control: its menu group, name, what it is for, and how to use
// it. `roles` (and `grant`, for ACCOUNTS) decide who sees the entry, mirroring AppShell's nav.
// Keep this in step with docs/user-guides/* when a screen's behaviour changes.

import type { StaffRole } from '../stores/auth';

export interface HelpEntry {
  id: string;
  group: string;
  name: string;
  description: string;
  steps: string[];
  roles: StaffRole[];
  /** BL-32: an ACCOUNTS user sees the entry only with this module grant. */
  grant?: string;
  /** Principal-only screens (a SCHOOL_ADMIN with the principal flag). */
  principalOnly?: boolean;
  /** The screen's route, per role family, for the "Open screen" link. */
  to?: { admin?: string; teacher?: string };
}

const ADMINS: StaffRole[] = ['SCHOOL_ADMIN', 'SUPER_ADMIN'];
const ADMIN_SIDE: StaffRole[] = ['SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'];
const EVERYONE: StaffRole[] = ['TEACHER', 'SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'];
const TEACHER: StaffRole[] = ['TEACHER'];

/** Display order of the groups on the help page. */
export const HELP_GROUPS = [
  'Header',
  'Overview',
  'Principal',
  'Teaching',
  'People',
  'Admissions & Hiring',
  'Finance',
  'Academics',
  'Attendance',
  'Data & Access',
  'Communication',
  'Org Structure',
] as const;

export const HELP_ENTRIES: HelpEntry[] = [
  // --- Header -------------------------------------------------------------------------------
  {
    id: 'notifications',
    group: 'Header',
    name: 'Notifications',
    description:
      'The bell in the header. A number counts unread messages that need a reply; a dot means other unread updates.',
    roles: EVERYONE,
    steps: [
      'Click the bell to open the list of your notifications.',
      'Click a notification to open the screen it is about; it is marked as read.',
      'Use "Mark all read" to clear the list in one go.',
    ],
  },
  {
    id: 'search',
    group: 'Header',
    name: 'Jump to / search (Ctrl K)',
    description: 'A quick way to open any screen or start a common task without using the menu.',
    roles: EVERYONE,
    steps: [
      'Click "Jump to… or search" in the header, or press Ctrl K (Cmd K on a Mac).',
      'Type part of a screen or task name, e.g. "fees" or "add student".',
      'Use the arrow keys and Enter, or click, to go there. Esc closes the box.',
    ],
  },
  {
    id: 'user-menu',
    group: 'Header',
    name: 'Profile menu',
    description:
      'Your picture (or initials) and name at the right of the header. It holds language, theme, this Help Document and Log out.',
    roles: EVERYONE,
    steps: [
      'Click your picture or name to open the menu; click again, click elsewhere or press Esc to close it.',
      'Your picture comes from your staff profile (People → Staff → your profile → photo).',
    ],
  },
  {
    id: 'language',
    group: 'Header',
    name: 'Language',
    description: 'Switches the console between English and Urdu (right-to-left).',
    roles: EVERYONE,
    steps: [
      'Open the profile menu.',
      'Under Language, choose English or اردو. The choice is remembered on this browser.',
    ],
  },
  {
    id: 'theme',
    group: 'Header',
    name: 'Theme',
    description: 'Light or dark colours. Until you choose, the console follows your device setting.',
    roles: EVERYONE,
    steps: ['Open the profile menu.', 'Click Theme to switch between light and dark. The choice is remembered on this browser.'],
  },
  {
    id: 'help',
    group: 'Header',
    name: 'Help Document',
    description: 'This page: every screen you can use, grouped as in the menu, with how to use it.',
    roles: EVERYONE,
    steps: [
      'Open the profile menu → Help Document.',
      'Type in the search box or pick a group to narrow the list.',
      'Use "Open screen" on an entry to go straight to that screen.',
    ],
  },
  {
    id: 'change-password',
    group: 'Header',
    name: 'Change password',
    description:
      'A new login must choose its own password at first sign-in. Changing it signs you out on every other device.',
    roles: EVERYONE,
    steps: [
      'You are taken to Change password automatically when your password must be changed.',
      'Enter your current password and the new one twice, then save.',
    ],
  },
  {
    id: 'logout',
    group: 'Header',
    name: 'Log out',
    description: 'Ends your session on this browser.',
    roles: EVERYONE,
    steps: ['Open the profile menu.', 'Click Log out (the last item). You return to the sign-in page.'],
  },

  // --- Overview -----------------------------------------------------------------------------
  {
    id: 'dashboard',
    group: 'Overview',
    name: 'Dashboard',
    description:
      'Summary cards for your school (or, for a super admin, all schools): attendance, fees and what needs attention.',
    roles: ADMIN_SIDE,
    to: { admin: '/admin' },
    steps: ['Open Overview → Dashboard; it is also your home screen after signing in.', 'Click a card to go to the screen behind it.'],
  },

  // --- Principal ----------------------------------------------------------------------------
  {
    id: 'principal-overview',
    group: 'Principal',
    name: 'School Overview',
    description: "A read-only summary of the whole school for the principal.",
    roles: ['SCHOOL_ADMIN'],
    principalOnly: true,
    to: { admin: '/principal' },
    steps: ['Open Principal → School Overview.', 'Review the figures; nothing here can be changed.'],
  },
  {
    id: 'principal-academics-staff',
    group: 'Principal',
    name: 'Academics & Staff',
    description: 'A read-only view of results and staffing across the school.',
    roles: ['SCHOOL_ADMIN'],
    principalOnly: true,
    to: { admin: '/principal/academics-staff' },
    steps: ['Open Principal → Academics & Staff.', 'Review the figures; nothing here can be changed.'],
  },

  // --- Teaching (teacher console) -----------------------------------------------------------
  {
    id: 'my-day',
    group: 'Teaching',
    name: 'My Day',
    description: "Today's periods and to-dos at a glance. Your home screen.",
    roles: TEACHER,
    to: { teacher: '/teacher' },
    steps: ['Open My Day after signing in.', 'Click a period or to-do to go to the matching screen.'],
  },
  {
    id: 'teacher-attendance',
    group: 'Teaching',
    name: 'Attendance',
    description: 'Mark daily attendance for the sections you teach.',
    roles: TEACHER,
    to: { teacher: '/teacher/attendance' },
    steps: [
      'Choose the section and the date.',
      'Mark each student Present, Absent, Late or Leave.',
      'Save. Attendance cannot be marked on a declared holiday.',
    ],
  },
  {
    id: 'teacher-diary',
    group: 'Teaching',
    name: 'Diary',
    description: 'Post homework and class activities; parents read them in the parent app.',
    roles: TEACHER,
    to: { teacher: '/teacher/diary' },
    steps: ['Choose the section and the subject.', 'Write the entry and an optional due date.', 'Post it.'],
  },
  {
    id: 'teacher-timetable',
    group: 'Teaching',
    name: 'Timetable',
    description: 'Your weekly periods. Read-only; the school admin edits timetables.',
    roles: TEACHER,
    to: { teacher: '/teacher/timetable' },
    steps: ['Open Timetable to see your week by day and period.'],
  },
  {
    id: 'teacher-leave',
    group: 'Teaching',
    name: 'Leave',
    description:
      'Leave requests of students in your sections. You recommend; the school admin decides.',
    roles: TEACHER,
    to: { teacher: '/teacher/leave' },
    steps: [
      'Open a pending request.',
      'Click Recommend approval or Recommend rejection, with an optional note for the admin.',
    ],
  },
  {
    id: 'teacher-report-cards',
    group: 'Teaching',
    name: 'Report Cards',
    description: "A student's grades and every report card the school generated (with PDF).",
    roles: TEACHER,
    to: { teacher: '/teacher/report-cards' },
    steps: [
      'Choose the section and the student.',
      'Open a report card or its PDF; earlier versions are kept and marked superseded.',
      'Optionally attach an uploaded report-card document for a session.',
    ],
  },
  {
    id: 'teacher-gradebook',
    group: 'Teaching',
    name: 'Gradebook',
    description: 'Create assessments and enter marks for your classes.',
    roles: TEACHER,
    to: { teacher: '/teacher/gradebook' },
    steps: [
      'Create an assessment: name, subject, maximum marks, under a category set by the admin.',
      'Open Enter Marks, pick the assessment and type each student\'s marks (never above the maximum).',
      'Save. Parents see a term\'s grades only after the admin publishes results.',
    ],
  },
  {
    id: 'teacher-syllabus',
    group: 'Teaching',
    name: 'Syllabus',
    description: 'The yearly plan per subject for the classes you teach. Read-only.',
    roles: TEACHER,
    to: { teacher: '/teacher/syllabus' },
    steps: [
      'Choose a class you teach.',
      'Click a subject to read its overview and units (term, planned dates, topics).',
    ],
  },

  // --- People -------------------------------------------------------------------------------
  {
    id: 'students',
    group: 'People',
    name: 'Students',
    description: 'Add, find, edit and archive students; open a student profile.',
    roles: ADMINS,
    to: { admin: '/admin/students' },
    steps: [
      'Click Add student. An active academic session and a section are required; the GR number must be unique.',
      'Link an existing parent or create a new parent login (exactly one).',
      'Open the student profile to add address, medical info, emergency contacts and documents.',
      'Archive takes a student out of the lists without losing anything; Show archived → Restore brings them back.',
    ],
  },
  {
    id: 'staff',
    group: 'People',
    name: 'Staff',
    description: 'Staff and teacher records, profiles, documents and teaching history.',
    roles: ADMINS,
    to: { admin: '/admin/staff' },
    steps: [
      'Click Add staff and fill in the details; for a teacher, provide a login.',
      'Open a profile to upload a photo, add experience and documents.',
      'Teaching History on a teacher\'s profile lists every class and subject they were assigned.',
      'Archive a staff member to remove them from lists; an archived teacher can no longer sign in.',
    ],
  },
  {
    id: 'parents',
    group: 'People',
    name: 'Parents',
    description: 'Parent accounts and their links to students.',
    roles: ADMINS,
    to: { admin: '/admin/parents' },
    steps: [
      'Create a parent, or use Find existing parent (exact login or CNIC) for one who already has children at another school.',
      'On the parent profile, Add child links another student; set the relationship and up to two primary guardians.',
      'Reset password gives a one-time password, shown once — read it to the parent.',
    ],
  },

  // --- Admissions & Hiring, Finance, Academics, Attendance, Data & Access ---------------------------------------------------------------------------
  {
    id: 'admissions',
    group: 'Admissions & Hiring',
    name: 'Admissions',
    description: 'The applicant queue: new applications, review, approve or reject.',
    roles: ADMIN_SIDE,
    grant: 'ADMISSIONS',
    to: { admin: '/admin/admissions' },
    steps: [
      'Click New Applicant and enter the applicant, desired class and session.',
      'Open an application to review or edit it while it is open.',
      'Approve to create the student, link or create the parent and enrol them; or Reject with notes. Decisions are final.',
    ],
  },
  {
    id: 'hiring',
    group: 'Admissions & Hiring',
    name: 'Hiring',
    description: 'Candidates and job applications through to a staff record.',
    roles: ADMINS,
    to: { admin: '/admin/hiring' },
    steps: [
      'Click New Candidate and upload the résumé first.',
      'Create an application for the candidate.',
      'Approve (creates the staff record; a teacher needs a login) or Reject. Decisions are final.',
    ],
  },
  {
    id: 'bulk-import',
    group: 'Data & Access',
    name: 'Bulk Import',
    description: 'Load many students, parents, teachers or staff from a spreadsheet.',
    roles: ADMINS,
    to: { admin: '/admin/bulk-import' },
    steps: [
      'Choose what to import and download the sample file.',
      'Fill it in and upload it.',
      'Check the preview and fix any reported errors (including duplicates in the file).',
      'Commit to save the rows.',
    ],
  },
  {
    id: 'data-export',
    group: 'Data & Access',
    name: 'Data Export',
    description: 'Download students, guardians, enrolments, attendance, results or vouchers as a CSV file.',
    roles: ADMINS,
    to: { admin: '/admin/data-export' },
    steps: [
      'Choose the data set; a super admin also chooses the school.',
      'Optionally narrow by session, or by dates for attendance.',
      'Tick Include sensitive fields only when the purpose needs them (principal or super admin).',
      'Download. Every export is recorded in the audit log.',
    ],
  },
  {
    id: 'accounts-access',
    group: 'Data & Access',
    name: 'Accounts Access',
    description: 'Choose which extra modules each accounts user may use beyond fees.',
    roles: ADMINS,
    to: { admin: '/admin/accounts-access' },
    steps: [
      'Find the accounts user.',
      'Tick Admissions, Complaints or Parent messages as needed. Changes apply immediately and are recorded.',
    ],
  },
  {
    id: 'fees',
    group: 'Finance',
    name: 'Fees',
    description: 'Fee structures, vouchers, payments, receipts and each student\'s ledger.',
    roles: ADMIN_SIDE,
    to: { admin: '/admin/fees' },
    steps: [
      'Create a fee structure (a Draft) and Activate it. It locks once invoiced; Archive hides it.',
      'Issue vouchers: month, due date, structures and either students or a whole section.',
      'Record payment on a voucher for cash or bank receipts; part payments leave the rest due.',
      'Student Ledger → Add line for a discount, scholarship, waiver or late fee; Reverse to cancel one.',
    ],
  },
  {
    id: 'fee-balances',
    group: 'Finance',
    name: 'Fee Balances',
    description: 'Outstanding balances and defaulters, the late-fee rule and carry-forward.',
    roles: ADMIN_SIDE,
    to: { admin: '/admin/fee-balances' },
    steps: [
      'Review balances; tick Defaulters only, or filter by section.',
      'Set the late fee and grace days, then Apply late fees now (a voucher never gets a second one).',
      'At the start of a new session, Carry forward moves unpaid balances into an opening-balance voucher.',
    ],
  },
  {
    id: 'admin-leave',
    group: 'Attendance',
    name: 'Leave Applications',
    description: 'Approve or reject student leave requests from parents.',
    roles: ADMINS,
    to: { admin: '/admin/leave' },
    steps: [
      'Open a pending request; the class teacher\'s recommendation is shown if there is one.',
      'Add an optional note (the parent sees it).',
      'Approve or Reject. A request is decided once.',
    ],
  },
  {
    id: 'attendance-risk',
    group: 'Attendance',
    name: 'Attendance Risk',
    description: 'Students flagged for low attendance, and your school\'s risk settings.',
    roles: ADMINS,
    to: { admin: '/admin/attendance-risk' },
    steps: [
      'Review the students flagged right now.',
      'School-wide admins set the window, threshold, minimum days and whether guardians are alerted.',
      'Changes apply from the next nightly check.',
    ],
  },
  {
    id: 'holidays',
    group: 'Attendance',
    name: 'Holidays',
    description: 'School or campus holidays; attendance cannot be marked on them.',
    roles: ADMINS,
    to: { admin: '/admin/holidays' },
    steps: [
      'Add a holiday with its dates and name.',
      'Leave the campus empty to apply it to every campus of your school, or choose one campus.',
    ],
  },


  {
    id: 'subjects',
    group: 'Academics',
    name: 'Subjects',
    description: "Your school's subject list used by timetable, diary, gradebook and syllabus.",
    roles: ADMINS,
    to: { admin: '/admin/subjects' },
    steps: [
      'Add a subject (a super admin chooses the school).',
      'Rename it, or Deactivate one no longer taught — it leaves the pickers, history stays.',
      'Delete is possible only for an unused subject.',
    ],
  },
  {
    id: 'terms',
    group: 'Academics',
    name: 'Terms',
    description: 'The terms of an academic session (e.g. Mid-term, Final).',
    roles: ADMINS,
    to: { admin: '/admin/terms' },
    steps: ['Choose the session.', 'Add each term with its dates.'],
  },
  {
    id: 'admin-syllabus',
    group: 'Academics',
    name: 'Syllabus',
    description:
      'The yearly plan per class and subject: an overview and units in teaching order. Teachers of the class can read it.',
    roles: ADMINS,
    to: { admin: '/admin/syllabus' },
    steps: [
      'Create: choose the Class, pick a subject in "Add a subject\'s syllabus" and click Add syllabus.',
      'View: click a subject in the list to open its syllabus below.',
      'Update: edit the Overview; Add unit for each unit (title, term, planned start/end, topics); use ↑/↓ to reorder and Remove to drop one; click Save.',
      'Delete: open the syllabus → Delete → confirm. Its units are removed too.',
      'A syllabus of an ended session is kept as history and is read-only. Copy structure to a new session copies syllabi.',
    ],
  },
  {
    id: 'admin-timetable',
    group: 'Academics',
    name: 'Timetable',
    description: "Build each section's weekly timetable.",
    roles: ADMINS,
    to: { admin: '/admin/timetable' },
    steps: [
      'Choose the section.',
      'For each day and period, set the subject, teacher, time and room.',
      'Save. A teacher or room double-booked in the same period is refused.',
    ],
  },
  {
    id: 'assessment-categories',
    group: 'Academics',
    name: 'Assessment Categories',
    description: 'Weights per class and term (e.g. Tests 30%, Exam 70%), and publishing results.',
    roles: ADMINS,
    to: { admin: '/admin/assessment-categories' },
    steps: [
      'Choose the class and term, then add categories with weights totalling 100%.',
      'When marks are in, Publish results — parents see grades only after this.',
      'Then Generate report cards on the same panel. Unpublish results to change categories.',
    ],
  },
  {
    id: 'grading-scales',
    group: 'Academics',
    name: 'Grading Scales',
    description: 'The bands that turn a percentage into a letter grade, remark and grade point.',
    roles: ADMINS,
    to: { admin: '/admin/grading-scales' },
    steps: [
      'Click New scale; it starts from a typical A+…F scale you can change.',
      'One band must start at 0. Mark one scale as the default — it is used when results are published.',
    ],
  },
  {
    id: 'admin-report-cards',
    group: 'Academics',
    name: 'Report Cards',
    description: "A student's generated report cards (with PDF) and uploaded historical cards.",
    roles: ADMINS,
    to: { admin: '/admin/report-cards' },
    steps: [
      'Generate cards from Assessment Categories after publishing results.',
      'Here, choose the student to see every version and download the PDF.',
      'Attach an uploaded report-card document for older sessions if needed.',
    ],
  },
  {
    id: 'promotions',
    group: 'Academics',
    name: 'Promotions',
    description: 'Move students into the new session at year end, with promotion rules.',
    roles: ADMINS,
    to: { admin: '/admin/promotions' },
    steps: [
      'Make sure the new session, its classes and sections exist.',
      'Pick the source section → Load students; review attendance, results and fees warnings.',
      'Choose an outcome per row (or Apply outcome to all) and a target section where needed.',
      'Confirm decisions. History is kept and cannot be edited.',
    ],
  },

  // --- Communication ------------------------------------------------------------------------
  {
    id: 'messages',
    group: 'Communication',
    name: 'Messages',
    description: 'Conversations with parents.',
    roles: EVERYONE,
    grant: 'MESSAGES',
    to: { admin: '/admin/messages', teacher: '/teacher/messages' },
    steps: ['Open a conversation from the list.', 'Type your reply and send it; the parent sees it in the app.'],
  },
  {
    id: 'circulars',
    group: 'Communication',
    name: 'Circulars',
    description: 'Notices to parents of the whole school or one section, with read counts.',
    roles: ADMINS,
    to: { admin: '/admin/circulars' },
    steps: [
      'Choose whole school (a super admin picks the school) or one section.',
      'Write the title and message and Publish.',
      'Check the read count on each circular.',
    ],
  },
  {
    id: 'complaints',
    group: 'Communication',
    name: 'Complaints',
    description: 'The complaint queue: owners, internal notes, replies to parents and resolution.',
    roles: EVERYONE,
    grant: 'COMPLAINTS',
    to: { admin: '/admin/complaints', teacher: '/teacher/complaints' },
    steps: [
      'Filter by status, category or owner; teachers see complaints assigned to them.',
      'Open one to assign an owner, add an internal note (staff only) or a reply the parent sees, and attach files.',
      'Resolve with a written resolution, which the parent sees.',
      '+ Record complaint logs one about a student (e.g. behaviour).',
    ],
  },

  // --- Org Structure ------------------------------------------------------------------------
  {
    id: 'schools',
    group: 'Org Structure',
    name: 'Schools',
    description: 'All schools on the platform and their profiles.',
    roles: ['SUPER_ADMIN'],
    to: { admin: '/admin/schools' },
    steps: [
      'Add School: enter the profile and optionally provision the first admin login (the password is shown once).',
      'Open a school to edit its profile. A school still in use cannot be deleted.',
    ],
  },
  {
    id: 'campuses',
    group: 'Org Structure',
    name: 'Campuses',
    description: 'The branches of a school.',
    roles: ADMINS,
    to: { admin: '/admin/campuses' },
    steps: [
      'Add Campus, choose the school, and optionally provision a campus principal login.',
      'Open a campus to see its profile; editing or deleting a campus needs a super admin.',
    ],
  },
  {
    id: 'academic-sessions',
    group: 'Org Structure',
    name: 'Academic Sessions',
    description: 'School years (e.g. 2026-2027) and copying last year\'s structure.',
    roles: ADMINS,
    to: { admin: '/admin/academic-sessions' },
    steps: [
      'A super admin creates a session: label, start and end dates, school; tick Active for the running one.',
      'On a new session, Copy structure here copies classes, sections, terms, categories, timetable and syllabi.',
    ],
  },
  {
    id: 'classes',
    group: 'Org Structure',
    name: 'Classes',
    description: 'Grade levels per campus and session.',
    roles: ADMINS,
    to: { admin: '/admin/classes' },
    steps: ['Click Add class, choose the campus and session, and name it (e.g. Class 5).'],
  },
  {
    id: 'sections',
    group: 'Org Structure',
    name: 'Sections',
    description: 'Sections of a class, each with an optional class teacher.',
    roles: ADMINS,
    to: { admin: '/admin/sections' },
    steps: [
      'Click Add section, choose the class and name it (e.g. 5-A).',
      'Assign a class teacher from the same campus; they get attendance-risk alerts and recommend on leave.',
    ],
  },
];

/** Entries the given user can use, in group order. */
export function helpEntriesFor(user: {
  role: string | null;
  isPrincipal: boolean;
  hasModule: (grant: string) => boolean;
}): HelpEntry[] {
  const role = user.role as StaffRole | null;
  if (!role) return [];
  return HELP_ENTRIES.filter(
    (e) =>
      e.roles.includes(role) &&
      (!e.principalOnly || user.isPrincipal) &&
      (!e.grant || user.hasModule(e.grant)),
  ).sort((a, b) => HELP_GROUPS.indexOf(a.group as never) - HELP_GROUPS.indexOf(b.group as never));
}
