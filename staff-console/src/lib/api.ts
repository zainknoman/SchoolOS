export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === 'object' && 'message' in body) {
      const message = (body as { message: unknown }).message;
      if (typeof message === 'string') return message;
      if (Array.isArray(message)) return message.join(', ');
    }
  } catch {
    // response wasn't JSON — fall through to the generic message below
  }
  return 'Something went wrong. Please try again.';
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  role: string;
  isPrincipal: boolean;
  mustChangePassword: boolean;
  campusId: string | null;
  schoolId: string | null;
  /** BL-32: module grants of an ACCOUNTS user (absent on older servers). */
  grants?: string[];
}

/** BL-32: modules an ACCOUNTS user reaches only when granted. */
export const STAFF_GRANTS = ['ADMISSIONS', 'COMPLAINTS', 'MESSAGES'] as const;
export type StaffGrant = (typeof STAFF_GRANTS)[number];

export interface AccountAccessStatus {
  id: string;
  identifier: string;
  role: string;
  disabled: boolean;
  lockedUntil: string | null;
  grants: string[];
}

export interface ChildSummary {
  id: string;
  name: string;
  grNumber: string;
  campus: string;
  class: string;
  section: string;
}

export interface SectionSummary {
  id: string;
  name: string;
  className: string;
  campusName: string;
  classId?: string;
  academicSessionId?: string;
  classTeacherId?: string | null;
  classTeacherName?: string | null;
}

export type OrgStatus = 'ACTIVE' | 'INACTIVE';

export interface SchoolSummary {
  id: string;
  name: string;
  code: string | null;
  registrationNumber: string | null;
  website: string | null;
  logoFileId: string | null;
  principalName: string | null;
  principalPhone: string | null;
  principalEmail: string | null;
  establishedDate: string | null;
  schoolType: string | null;
  educationBoard: string | null;
  status: OrgStatus;
  timezone: string | null;
  currency: string | null;
  alternatePhone: string | null;
  addressId: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  campusCount: number;
  studentCount: number;
  staffCount: number;
}

export interface CampusSummary {
  id: string;
  name: string;
  schoolId: string;
  schoolName: string;
  code: string | null;
  campusType: string | null;
  logoFileId: string | null;
  principalName: string | null;
  principalPhone: string | null;
  principalEmail: string | null;
  openingDate: string | null;
  capacity: number | null;
  latitude: number | null;
  longitude: number | null;
  status: OrgStatus;
  departments: string[];
  alternatePhone: string | null;
  addressId: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  studentCount: number;
  staffCount: number;
}

/** BL-33: what a copy-structure run created (0s on a repeat run) and skipped. */
export interface CopyStructureResult {
  classesCreated: number;
  sectionsCreated: number;
  termsCreated?: number;
  assessmentCategoriesCreated?: number;
  syllabiCreated?: number;
  timetableEntriesCreated?: number;
  timetableEntriesSkipped?: number;
}

/** BL-41: datasets of the controlled export (`GET /api/v1/admin/exports/:dataset`). */
export const DATA_EXPORT_DATASETS = ['students', 'guardians', 'enrolments', 'attendance', 'results', 'fees'] as const;
export type DataExportDataset = (typeof DATA_EXPORT_DATASETS)[number];

export interface DataExportParams {
  schoolId?: string;
  campusId?: string;
  academicSessionId?: string;
  from?: string;
  to?: string;
  includeSensitive?: boolean;
}

export interface AcademicSessionSummary {
  id: string;
  /** BL-01: sessions belong to a school (null only for legacy rows awaiting the M3 backfill). */
  schoolId?: string | null;
  label: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface ClassSummary {
  id: string;
  name: string;
  campusId: string;
  campusName: string;
  academicSessionId: string;
  academicSessionLabel: string;
}

export interface DashboardWeeklyPoint {
  day: string;
  attendancePercent: number;
  feesCollectedPkr: number;
}

export interface DashboardAlert {
  id: string;
  message: string;
  createdAt: string;
}

export interface DashboardSummary {
  studentsTotal: number;
  presentTodayPercent: number;
  absentToday: number;
  feesCollectedPkr: number;
  feesOutstandingPkr: number;
  weeklyTrend: DashboardWeeklyPoint[];
  recentAlerts: DashboardAlert[];
}

export interface OperationsSummary {
  admissionsPending: number;
  feeDefaulters: number;
  leaveRequestsPending: number;
  documentsToVerify: number;
  recentActivity: DashboardAlert[];
}

export interface SchoolOverviewRow {
  id: string;
  name: string;
  status: string;
  campusesCount: number;
  studentsCount: number;
  feeCollectionPercent: number;
}

export interface NetworkOverview {
  totalSchools: number;
  totalStudents: number;
  totalStaff: number;
  schools: SchoolOverviewRow[];
}

export interface ClassHealthRow {
  sectionId: string;
  className: string;
  sectionName: string;
  teacherName: string | null;
  attendancePercent: number;
  averageMarksPercent: number | null;
}

export interface ExamScheduleStatusRow {
  categoryId: string;
  categoryName: string;
  className: string;
  termLabel: string;
  status: 'ready' | 'pending';
}

export interface PrincipalAcademicsSummary {
  classHealth: ClassHealthRow[];
  examScheduleStatus: ExamScheduleStatusRow[];
}

export interface MyDayClass {
  timetableId: string;
  sectionId: string;
  className: string;
  sectionName: string;
  subjectName: string;
  period: number;
  startTime: string;
  endTime: string;
  room: string | null;
  attendanceMarked: boolean;
}

export interface MyDayDiaryDue {
  id: string;
  className: string;
  sectionName: string;
  subjectName: string;
  text: string;
}

export interface MyDaySummary {
  classesToday: MyDayClass[];
  diaryDueToday: MyDayDiaryDue[];
}

export interface GradebookClassRow {
  sectionId: string;
  subjectId: string;
  className: string;
  sectionName: string;
  subjectName: string;
  termLabel: string | null;
  studentsCount: number;
  marksEnteredCount: number;
}

export interface UpcomingExamRow {
  termId: string;
  label: string;
  startDate: string;
  daysUntil: number;
}

export interface GradebookOverview {
  classes: GradebookClassRow[];
  upcomingExams: UpcomingExamRow[];
}

export interface StudentSummary {
  id: string;
  name: string;
  grNumber: string;
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE' | 'HOLIDAY';

export interface SubjectSummary {
  id: string;
  name: string;
  /** BL-02: the owning school (null only for legacy rows awaiting the M4 backfill). */
  schoolId?: string | null;
  isActive?: boolean;
}

export interface TeacherSummary {
  id: string;
  name: string;
}

export interface TimetableEntrySummary {
  id: string;
  dayOfWeek: number;
  period: number;
  startTime: string;
  endTime: string;
  subject: string;
  teacher: string | null;
  room: string | null;
}

export interface TimetableEntryInput {
  subjectId: string;
  teacherId?: string;
  dayOfWeek: number;
  period: number;
  startTime: string;
  endTime: string;
  room?: string;
}

export interface HolidaySummary {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  campusId: string | null;
  /** BL-20: the owning school (null only on legacy rows awaiting review). */
  schoolId?: string | null;
}

export interface ComplaintSummary {
  id: string;
  studentId: string;
  raisedById: string;
  subject: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportCardSummary {
  id: string;
  studentId: string;
  academicSessionId: string;
  fileId: string;
  createdAt: string;
}

/** BL-26: yearly syllabus of one subject in one class (and so one session). */
export interface SyllabusSummary {
  id: string;
  classId: string;
  className: string;
  academicSessionId: string;
  subjectId: string;
  subjectName: string;
  unitCount: number;
  updatedAt: string;
}

export interface SyllabusUnit {
  id?: string;
  order?: number;
  title: string;
  topics: string | null;
  termId: string | null;
  termLabel?: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
}

export interface SyllabusDetail {
  id: string;
  classId: string;
  className: string;
  academicSessionId: string;
  sessionLabel: string;
  /** false once the session has ended (kept as history) */
  editable: boolean;
  subjectId: string;
  subjectName: string;
  overview: string | null;
  units: SyllabusUnit[];
  updatedAt: string;
}

export type SyllabusUnitInput = Pick<SyllabusUnit, 'title' | 'topics' | 'termId' | 'plannedStart' | 'plannedEnd'>;

export interface TermSummary {
  id: string;
  academicSessionId: string;
  label: string;
  order: number;
  startDate: string;
  endDate: string;
}

export interface AssessmentCategorySummary {
  id: string;
  classId: string;
  termId: string;
  name: string;
  weightPercent: number;
  weightTotalWarning?: string | null;
}

export interface AssessmentSummary {
  id: string;
  assessmentCategoryId: string;
  subjectId: string;
  label: string;
  maxMarks: number;
}

export interface SubjectGrade {
  subjectId: string;
  subjectName: string;
  categories: { name: string; weightPercent: number; obtainedPercent: number }[];
  finalPercent: number;
}

export interface AttendanceRiskSummary {
  studentId: string;
  studentName: string;
  absenceRate: number;
  flagged: boolean;
  windowStart: string;
  windowEnd: string;
}

export interface DiaryAttachmentSummary {
  id: string;
  originalName: string;
  mimeType: string;
}

export interface DiaryEntrySummary {
  id: string;
  date: string;
  dueDate: string | null;
  subject: string;
  text: string;
  attachments: DiaryAttachmentSummary[];
}

export interface CircularSummary {
  id: string;
  title: string;
  description: string;
  scope: 'school' | 'section';
  priority: string;
  publishedAt: string;
  expiresAt: string | null;
  attachments: DiaryAttachmentSummary[];
  readAt: string | null;
}

export interface ConversationSummary {
  id: string;
  recipientType: 'CLASS_TEACHER' | 'SCHOOL_ADMIN' | 'ACCOUNTS' | 'PRINCIPAL';
  studentId: string | null;
  otherPartyName: string;
  lastMessageAt: string;
  unread: boolean;
}

export interface MessageSummary {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
}

export interface ConversationDetail {
  id: string;
  recipientType: string;
  studentId: string | null;
  messages: MessageSummary[];
}

export interface NotificationSummary {
  id: string;
  type: 'diary' | 'circular' | 'message';
  title: string;
  body: string;
  entityRef: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface LeaveRequestSummary {
  id: string;
  studentId: string;
  studentName: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

// BL-05: indicators are warnings; a row is `blocked` only when the school turned a rule into a block,
// and a block stops only a plain PROMOTED decision.
export interface PromotionPolicy {
  minAttendancePercent: number;
  minResultPercent: number;
  blockOnAttendance: boolean;
  blockOnResults: boolean;
  blockOnFees: boolean;
}

export interface PromotionWarning {
  code: 'LOW_ATTENDANCE' | 'NO_ATTENDANCE_DATA' | 'LOW_RESULTS' | 'NO_RESULTS_DATA' | 'FEES_OUTSTANDING';
  message: string;
  blocking: boolean;
}

export interface StudentPromotionIndicators {
  attendance: { present: number; late: number; absent: number; leave: number; percent: number | null };
  results: { obtained: number; max: number; assessments: number; percent: number | null };
  fees: { outstanding: number; unpaidVouchers: number };
  warnings: PromotionWarning[];
  blocked: boolean;
}

export interface PromotionPreviewRow {
  studentId: string;
  name: string;
  grNumber: string;
  currentRollNumber: string | null;
  indicators: StudentPromotionIndicators;
}

export interface PromotionPreview {
  schoolId: string;
  sourceAcademicSessionId: string;
  policy: PromotionPolicy;
  rows: PromotionPreviewRow[];
}

export type PromotionDecision =
  | 'PROMOTED'
  | 'PROMOTED_WITH_CONDITIONS'
  | 'RETAINED'
  | 'TRANSFERRED'
  | 'GRADUATED'
  | 'WITHDRAWN';

export interface PromotionDecisionInput {
  studentId: string;
  decision: PromotionDecision;
  targetSectionId?: string;
  rollNumber?: string;
  remarks?: string;
  conditions?: string;
}

export interface PromotionHistoryRow {
  id: string;
  decision: PromotionDecision;
  decidedAt: string;
  remarks: string | null;
  conditions: string | null;
  indicators: StudentPromotionIndicators | null;
  from: { sectionName: string; className: string; sessionLabel: string };
  to: { sectionName: string; className: string; sessionLabel: string } | null;
}

// BL-25 (Q15): a row of the teaching-assignment history (written by the database, read-only here).
export interface TeachingAssignmentRow {
  id: string;
  role: 'CLASS_TEACHER' | 'SUBJECT_TEACHER';
  teacherId: string | null;
  teacherName: string;
  academicSessionId: string | null;
  sessionLabel: string;
  classId: string | null;
  className: string;
  sectionId: string | null;
  sectionName: string;
  subjectId: string | null;
  subjectName: string | null;
  startDate: string;
  startDateUnknown: boolean;
  endDate: string | null;
}

export type FeeStructureStatus = 'DRAFT' | 'ACTIVE' | 'LOCKED' | 'ARCHIVED';

export interface FeeStructureSummary {
  id: string;
  name: string;
  amount: number; // paisa
  /** BL-03: lifecycle — only ACTIVE/LOCKED structures can be issued. */
  status?: FeeStructureStatus;
  schoolId?: string | null;
}

export interface FeeVoucherSummary {
  id: string;
  studentId: string;
  month: string;
  dueDate: string;
  items: Array<{ label: string; amount: number }>;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue';
}

export interface FeePaymentSummary {
  id: string;
  amount: number;
  method: string;
  status: string;
  voucherIds: string[];
  receiptId: string | null;
  createdAt: string;
}

export interface TeacherAdminSummary {
  id: string;
  identifier: string;
  name: string;
}

export interface ParentSummary {
  id: string;
  identifier: string;
  name: string;
  phone: string | null;
  childrenCount: number;
}

export interface ParentAddressDetail {
  line1: string;
  line2: string | null;
  area: string | null;
  city: string | null;
  district: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;
}

export interface ParentChildLink {
  studentId: string;
  studentName: string;
  grNumber: string;
  className: string | null;
  sectionName: string | null;
  relationship: string;
  /** BL-04: FATHER | MOTHER | GUARDIAN | OTHER (free text of OTHER in relationshipNote). */
  relationshipType?: string;
  relationshipNote?: string | null;
  /** 1 or 2 for one of the student's (at most two) primary guardians, else null. */
  primarySlot?: number | null;
  isPrimary: boolean;
  isEmergencyContact: boolean;
  schoolName?: string | null;
}

/** BL-04 (Q4): the relationship a guardian has to a student — required on every new link. */
export const GUARDIAN_RELATIONSHIP_OPTIONS = [
  { value: 'FATHER', label: 'Father' },
  { value: 'MOTHER', label: 'Mother' },
  { value: 'GUARDIAN', label: 'Guardian' },
  { value: 'OTHER', label: 'Other' },
];

/** BL-23: what a lookup by exact login/CNIC reveals about an existing guardian. */
export interface ParentLookupResult {
  id: string;
  identifier: string;
  name: string;
}

export interface ParentProfileDetail extends ParentSummary {
  cnic: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  alternatePhone: string | null;
  whatsappNumber: string | null;
  email: string | null;
  occupation: string | null;
  employerName: string | null;
  designation: string | null;
  currentAddress: ParentAddressDetail | null;
  permanentAddress: ParentAddressDetail | null;
  children: ParentChildLink[];
}

export interface UpdateParentInput {
  name?: string;
  phone?: string;
  password?: string;
  cnic?: string;
  gender?: string;
  dateOfBirth?: string;
  alternatePhone?: string;
  whatsappNumber?: string;
  email?: string;
  occupation?: string;
  employerName?: string;
  designation?: string;
  currentAddress?: { line1: string; area?: string; city?: string };
  permanentAddress?: { line1: string; area?: string; city?: string };
}

export interface NewParentInput {
  identifier: string;
  password: string;
  name: string;
  phone?: string;
}

export interface StudentAdminSummary {
  id: string;
  grNumber: string;
  name: string;
  sectionName: string | null;
  className: string | null;
  campusName: string | null;
  parentNames: string[];
}

export interface AddressDetail {
  id: string;
  line1: string;
  line2: string | null;
  area: string | null;
  city: string | null;
  district: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;
}

export interface AddressInput {
  line1: string;
  line2?: string;
  area?: string;
  city?: string;
  district?: string;
  province?: string;
  postalCode?: string;
  country?: string;
}

export interface StudentPreviousSchoolDetail {
  id: string;
  schoolName: string;
  address: AddressDetail | null;
  contactNumber: string | null;
  email: string | null;
  lastClassAttended: string | null;
  admissionDate: string | null;
  leavingDate: string | null;
  leavingCertificateNumber: string | null;
  leavingCertificateDate: string | null;
  reasonForLeaving: string | null;
  academicRemarks: string | null;
}

export interface StudentEmergencyContactDetail {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  alternatePhone: string | null;
  email: string | null;
  address: AddressDetail | null;
  priority: number;
  isPrimary: boolean;
}

export interface StudentMedicalInfoDetail {
  id: string;
  bloodGroup: string | null;
  allergies: string | null;
  medicalConditions: string | null;
  specialEducationalNeeds: string | null;
  medicationNotes: string | null;
  emergencyMedicalNotes: string | null;
}

export interface StudentDocumentDetail {
  id: string;
  documentType: string;
  file: { id: string; originalName: string; mimeType: string; sizeBytes: number };
  expiryDate: string | null;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  verifiedById: string | null;
  verifiedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface StudentCurrentEnrollmentDetail {
  id: string;
  rollNumber: string | null;
  remarks: string | null;
  section: {
    id: string;
    name: string;
    class: { id: string; name: string; campus: { id: string; name: string; code: string | null; school: { id: string; name: string } } };
  };
}

export interface StudentProfileDetail {
  id: string;
  grNumber: string;
  name: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  preferredName: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  dateOfBirth: string | null;
  placeOfBirth: string | null;
  nationality: string | null;
  religion: string | null;
  bFormNumber: string | null;
  profilePhotoFileId: string | null;
  status: 'ACTIVE' | 'TRANSFERRED' | 'WITHDRAWN' | 'GRADUATED' | 'LEFT'; // LEFT: retired, read-only (BL-61)
  admissionDate: string | null;
  leavingDate: string | null;
  leavingReason: string | null;
  studentMobile: string | null;
  studentEmail: string | null;
  currentAddress: AddressDetail | null;
  permanentAddress: AddressDetail | null;
  previousSchool: StudentPreviousSchoolDetail | null;
  emergencyContacts: StudentEmergencyContactDetail[];
  medicalInfo: StudentMedicalInfoDetail | null;
  documents: StudentDocumentDetail[];
  // The backend's PROFILE_INCLUDE filters to the active enrollment with `take: 1` — 0 or 1 items.
  enrollments: StudentCurrentEnrollmentDetail[];
}

export interface UpdateStudentProfilePayload {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  preferredName?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth?: string;
  placeOfBirth?: string;
  nationality?: string;
  religion?: string;
  bFormNumber?: string;
  status?: 'ACTIVE' | 'TRANSFERRED' | 'WITHDRAWN' | 'GRADUATED';
  admissionDate?: string;
  leavingDate?: string;
  leavingReason?: string;
  studentMobile?: string;
  studentEmail?: string;
  profilePhotoFileId?: string;
  currentAddress?: AddressInput;
  permanentAddress?: AddressInput;
}

export interface UpdateCurrentEnrollmentPayload {
  rollNumber?: string;
  remarks?: string;
}

export interface UpdatePreviousSchoolPayload {
  schoolName: string;
  contactNumber?: string;
  email?: string;
  lastClassAttended?: string;
  admissionDate?: string;
  leavingDate?: string;
  leavingCertificateNumber?: string;
  leavingCertificateDate?: string;
  reasonForLeaving?: string;
  academicRemarks?: string;
  address?: AddressInput;
}

export interface CreateEmergencyContactPayload {
  name: string;
  relationship: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  priority?: number;
  isPrimary?: boolean;
  address?: AddressInput;
}

export interface UpdateEmergencyContactPayload {
  name?: string;
  relationship?: string;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  priority?: number;
  isPrimary?: boolean;
}

export interface UpdateMedicalInfoPayload {
  bloodGroup?: string;
  allergies?: string;
  medicalConditions?: string;
  specialEducationalNeeds?: string;
  medicationNotes?: string;
  emergencyMedicalNotes?: string;
}

export interface AddDocumentPayload {
  documentType: string;
  fileId: string;
  expiryDate?: string;
  notes?: string;
}

export interface ApplicantSummary {
  id: string;
  name: string;
  dateOfBirth: string;
  guardianName: string;
  guardianPhone: string;
}

export interface ApplicationSummary {
  id: string;
  applicantId: string;
  applicantName: string;
  desiredClassId: string;
  academicSessionId: string;
  status: string;
  decisionNotes: string | null;
  reviewedById: string | null;
  createdStudentId: string | null;
}

export interface HiringCandidateSummary {
  id: string;
  name: string;
  dateOfBirth: string | null;
  cnic: string | null;
  contactPhone: string;
  contactEmail: string | null;
  resumeFileId: string | null;
}

export interface HiringApplicationSummary {
  id: string;
  candidateId: string;
  candidateName: string;
  employeeType: 'TEACHER' | 'OFFICE_STAFF' | 'JANITORIAL' | 'HELPER' | 'GUARD' | 'OTHER';
  campusId: string;
  status: string;
  decisionNotes: string | null;
  reviewedById: string | null;
  createdStaffId: string | null;
}

export interface StaffAdminSummary {
  id: string;
  name: string;
  employeeType: 'TEACHER' | 'OFFICE_STAFF' | 'JANITORIAL' | 'HELPER' | 'GUARD' | 'OTHER';
  employmentStatus: 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED' | 'RESIGNED';
  campusName: string;
}

export interface NewStaffInput {
  name: string;
  employeeType: StaffAdminSummary['employeeType'];
  campusId: string;
  dateOfBirth?: string;
  cnic?: string;
  mobile?: string;
  email?: string;
  joiningDate?: string;
  login?: { identifier: string; password: string };
}

export interface StaffEmergencyContactDetail {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  alternatePhone: string | null;
  email: string | null;
  address: AddressDetail | null;
  priority: number;
  isPrimary: boolean;
}

export interface StaffExperienceDetail {
  id: string;
  organization: string;
  role: string;
  fromDate: string | null;
  toDate: string | null;
  description: string | null;
}

export interface StaffDocumentDetail {
  id: string;
  documentType: string;
  file: { id: string; originalName: string; mimeType: string; sizeBytes: number };
  expiryDate: string | null;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  verifiedById: string | null;
  verifiedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface StaffProfileDetail {
  id: string;
  name: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  employeeType: 'TEACHER' | 'OFFICE_STAFF' | 'JANITORIAL' | 'HELPER' | 'GUARD' | 'OTHER';
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  dateOfBirth: string | null;
  cnic: string | null;
  mobile: string | null;
  email: string | null;
  profilePhotoFileId: string | null;
  currentAddress: AddressDetail | null;
  permanentAddress: AddressDetail | null;
  joiningDate: string | null;
  employmentStatus: 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED' | 'RESIGNED';
  leavingDate: string | null;
  leavingReason: string | null;
  campus: { id: string; name: string; code: string | null; school: { id: string; name: string } };
  teacher: { id: string; name: string; user: { identifier: string } } | null;
  emergencyContacts: StaffEmergencyContactDetail[];
  experience: StaffExperienceDetail[];
  documents: StaffDocumentDetail[];
}

export interface UpdateStaffProfilePayload {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth?: string;
  cnic?: string;
  mobile?: string;
  email?: string;
  profilePhotoFileId?: string;
  joiningDate?: string;
  employmentStatus?: 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED' | 'RESIGNED';
  leavingDate?: string;
  leavingReason?: string;
  currentAddress?: AddressInput;
  permanentAddress?: AddressInput;
}

export interface CreateStaffEmergencyContactPayload {
  name: string;
  relationship: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  priority?: number;
  isPrimary?: boolean;
}

export interface UpdateStaffEmergencyContactPayload {
  name?: string;
  relationship?: string;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  priority?: number;
  isPrimary?: boolean;
}

export interface CreateStaffExperiencePayload {
  organization: string;
  role: string;
  fromDate?: string;
  toDate?: string;
  description?: string;
}

export interface UpdateStaffExperiencePayload {
  organization?: string;
  role?: string;
  fromDate?: string;
  toDate?: string;
  description?: string;
}

export interface AddStaffDocumentPayload {
  documentType: string;
  fileId: string;
  expiryDate?: string;
  notes?: string;
}

export interface BulkImportRowOutcome {
  line: number;
  data: Record<string, string>;
  errors: string[];
}

export interface BulkImportPreviewResult {
  rows: BulkImportRowOutcome[];
  validCount: number;
  errorCount: number;
}

export type BulkImportEntity = 'students' | 'parents' | 'teachers' | 'staff';

function authHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

/** One page of a server-paged list (BL-40): the body is the rows, the total is a header. */
export interface Page<T> {
  items: T[];
  total: number;
}

export interface PageParams {
  page: number;
  limit: number;
  q?: string;
}

function pageQuery(p: PageParams): string {
  const qs = new URLSearchParams({ page: String(p.page), limit: String(p.limit) });
  if (p.q) qs.set('q', p.q);
  return qs.toString();
}

async function asPage<T>(res: Response): Promise<Page<T>> {
  const items = await asJson<T[]>(res);
  const total = Number(res.headers.get('X-Total-Count') ?? items.length);
  return { items, total: Number.isFinite(total) ? total : items.length };
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new ApiError(await parseErrorMessage(res), res.status);
  }
  return (await res.json()) as T;
}

export interface ProvisionedLogin {
  identifier: string;
  /** Set only when the server generated the password — shown once. Null when the caller supplied one. */
  temporaryPassword: string | null;
}

// The create succeeded once res.ok is true, so an empty/unparseable body must never turn into a thrown error
// (the UI would show a save failure and invite a duplicate create).
async function parseProvisioned(res: Response): Promise<{ provisionedLogin?: ProvisionedLogin }> {
  try {
    const text = await res.text();
    return text ? (JSON.parse(text) as { provisionedLogin?: ProvisionedLogin }) : {};
  } catch {
    return {};
  }
}

export const api = {
  async login(identifier: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    return asJson<LoginResponse>(res);
  },

  // Revokes this session's refresh token on the server (BL-21). Always 204; never throws on 4xx.
  async logout(refreshToken: string): Promise<void> {
    await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  },

  async refresh(refreshToken: string): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    return asJson<LoginResponse>(res);
  },

  async changePassword(
    accessToken: string,
    payload: { currentPassword: string; newPassword: string },
  ): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson<LoginResponse>(res);
  },

  async me(accessToken: string): Promise<{ id: string; role: string }> {
    const res = await fetch(`${API_BASE_URL}/api/v1/me`, { headers: authHeaders(accessToken) });
    return asJson(res);
  },

  async listSections(accessToken: string): Promise<SectionSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/sections`, { headers: authHeaders(accessToken) });
    return asJson(res);
  },

  async createSection(
    accessToken: string,
    payload: { classId: string; name: string; classTeacherId?: string },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/sections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async updateSection(
    accessToken: string,
    id: string,
    payload: { name?: string; classTeacherId?: string | null },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/sections/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async deleteSection(accessToken: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/sections/${id}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async listSchools(accessToken: string): Promise<SchoolSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/schools`, { headers: authHeaders(accessToken) });
    return asJson(res);
  },

  async createSchool(
    accessToken: string,
    payload: {
      name: string;
      code?: string;
      registrationNumber?: string;
      website?: string;
      logoFileId?: string;
      principalName?: string;
      principalPhone?: string;
      principalEmail?: string;
      establishedDate?: string;
      schoolType?: string;
      educationBoard?: string;
      status?: OrgStatus;
      timezone?: string;
      currency?: string;
      alternatePhone?: string;
      addressId?: string;
      address?: string;
      phone?: string;
      email?: string;
      admin?: { identifier: string; password?: string };
    },
  ): Promise<{ provisionedLogin?: ProvisionedLogin }> {
    const res = await fetch(`${API_BASE_URL}/api/v1/schools`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
    return parseProvisioned(res);
  },

  async updateSchool(
    accessToken: string,
    id: string,
    payload: {
      name?: string;
      code?: string;
      registrationNumber?: string;
      website?: string;
      logoFileId?: string;
      principalName?: string;
      principalPhone?: string;
      principalEmail?: string;
      establishedDate?: string;
      schoolType?: string;
      educationBoard?: string;
      status?: OrgStatus;
      timezone?: string;
      currency?: string;
      alternatePhone?: string;
      addressId?: string;
      address?: string;
      phone?: string;
      email?: string;
    },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/schools/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async deleteSchool(accessToken: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/schools/${id}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async listCampuses(accessToken: string): Promise<CampusSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/campuses`, { headers: authHeaders(accessToken) });
    return asJson(res);
  },

  async createCampus(
    accessToken: string,
    payload: {
      schoolId: string;
      name: string;
      code?: string;
      campusType?: string;
      logoFileId?: string;
      principalName?: string;
      principalPhone?: string;
      principalEmail?: string;
      openingDate?: string;
      capacity?: number;
      latitude?: number;
      longitude?: number;
      status?: OrgStatus;
      departments?: string[];
      alternatePhone?: string;
      addressId?: string;
      address?: string;
      phone?: string;
      email?: string;
      principal?: { identifier: string; password?: string };
    },
  ): Promise<{ provisionedLogin?: ProvisionedLogin }> {
    const res = await fetch(`${API_BASE_URL}/api/v1/campuses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
    return parseProvisioned(res);
  },

  async updateCampus(
    accessToken: string,
    id: string,
    payload: {
      name?: string;
      code?: string;
      campusType?: string;
      logoFileId?: string;
      principalName?: string;
      principalPhone?: string;
      principalEmail?: string;
      openingDate?: string;
      capacity?: number;
      latitude?: number;
      longitude?: number;
      status?: OrgStatus;
      departments?: string[];
      alternatePhone?: string;
      addressId?: string;
      address?: string;
      phone?: string;
      email?: string;
    },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/campuses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async deleteCampus(accessToken: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/campuses/${id}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async listAcademicSessions(accessToken: string): Promise<AcademicSessionSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/academic-sessions`, { headers: authHeaders(accessToken) });
    return asJson(res);
  },

  async createAcademicSession(
    accessToken: string,
    payload: { label: string; startDate: string; endDate: string; isActive: boolean; schoolId: string },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/academic-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async updateAcademicSession(
    accessToken: string,
    id: string,
    payload: { label?: string; startDate?: string; endDate?: string; isActive?: boolean },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/academic-sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async deleteAcademicSession(accessToken: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/academic-sessions/${id}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async listClasses(accessToken: string): Promise<ClassSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/classes`, { headers: authHeaders(accessToken) });
    return asJson(res);
  },

  async createClass(
    accessToken: string,
    payload: { campusId: string; academicSessionId: string; name: string },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/classes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async updateClass(accessToken: string, id: string, payload: { name?: string }): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/classes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async deleteClass(accessToken: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/classes/${id}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async dashboardSummary(accessToken: string): Promise<DashboardSummary> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/dashboard-summary`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async operationsSummary(accessToken: string): Promise<OperationsSummary> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/operations-summary`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async networkOverview(accessToken: string): Promise<NetworkOverview> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/network-overview`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async principalAcademicsSummary(accessToken: string): Promise<PrincipalAcademicsSummary> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/principal-academics-summary`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async teacherMyDay(accessToken: string): Promise<MyDaySummary> {
    const res = await fetch(`${API_BASE_URL}/api/v1/teachers/me/day`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async teacherGradebookOverview(accessToken: string): Promise<GradebookOverview> {
    const res = await fetch(`${API_BASE_URL}/api/v1/teachers/me/gradebook-overview`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async sectionStudents(accessToken: string, sectionId: string): Promise<StudentSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/sections/${sectionId}/students`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  // Pre-fills the roster with whatever was already marked today, so re-opening this screen (or
  // logging back in) doesn't silently discard a teacher's earlier marks from view.
  async sectionAttendance(
    accessToken: string,
    sectionId: string,
    date: string,
  ): Promise<Record<string, AttendanceStatus>> {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/sections/${sectionId}/attendance?date=${encodeURIComponent(date)}`,
      { headers: authHeaders(accessToken) },
    );
    return asJson(res);
  },

  async markAttendance(
    accessToken: string,
    payload: { studentId: string; date: string; status: AttendanceStatus },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async listSubjects(accessToken: string, options: { includeInactive?: boolean } = {}): Promise<SubjectSummary[]> {
    const query = options.includeInactive ? '?includeInactive=true' : '';
    const res = await fetch(`${API_BASE_URL}/api/v1/subjects${query}`, { headers: authHeaders(accessToken) });
    return asJson(res);
  },

  // BL-02: school-scoped subject management.
  async createSubject(accessToken: string, payload: { name: string; schoolId?: string }): Promise<SubjectSummary> {
    const res = await fetch(`${API_BASE_URL}/api/v1/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async updateSubject(
    accessToken: string,
    id: string,
    payload: { name?: string; isActive?: boolean },
  ): Promise<SubjectSummary> {
    const res = await fetch(`${API_BASE_URL}/api/v1/subjects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async deleteSubject(accessToken: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/subjects/${id}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async listTeachers(accessToken: string, campusId?: string): Promise<TeacherSummary[]> {
    const query = campusId ? `?campusId=${encodeURIComponent(campusId)}` : '';
    const res = await fetch(`${API_BASE_URL}/api/v1/teachers${query}`, { headers: authHeaders(accessToken) });
    return asJson(res);
  },

  async sectionTimetable(accessToken: string, sectionId: string): Promise<TimetableEntrySummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/sections/${sectionId}/timetable`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async createTimetableEntry(
    accessToken: string,
    payload: TimetableEntryInput & { sectionId: string },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/timetable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async updateTimetableEntry(
    accessToken: string,
    id: string,
    payload: Partial<TimetableEntryInput>,
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/timetable/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async deleteTimetableEntry(accessToken: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/timetable/${id}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  // The grid composer's "Save Timetable" — replaces the section's ENTIRE timetable with this set
  // in one call, not an incremental add.
  async replaceSectionTimetable(
    accessToken: string,
    sectionId: string,
    entries: TimetableEntryInput[],
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/sections/${sectionId}/timetable`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify({ entries }),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async uploadFile(accessToken: string, file: File): Promise<{ id: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE_URL}/api/v1/files`, {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: formData,
    });
    return asJson(res);
  },

  async listSectionDiary(
    accessToken: string,
    sectionId: string,
    month: string,
  ): Promise<DiaryEntrySummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/sections/${sectionId}/diary?month=${month}`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async createDiaryEntry(
    accessToken: string,
    payload: {
      sectionId: string;
      subjectId: string;
      date: string;
      text: string;
      dueDate?: string;
      fileIds?: string[];
    },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/diary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async listCirculars(accessToken: string): Promise<CircularSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/circulars`, { headers: authHeaders(accessToken) });
    return asJson(res);
  },

  async publishCircular(
    accessToken: string,
    payload: {
      title: string;
      description: string;
      scope: 'school' | 'section';
      sectionId?: string;
      fileIds?: string[];
      /** BL-20: a super admin's school-wide circular must name its school. */
      schoolId?: string;
    },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/circulars`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async circularStats(
    accessToken: string,
    circularId: string,
  ): Promise<{ delivered: number; read: number }> {
    const res = await fetch(`${API_BASE_URL}/api/v1/circulars/${circularId}/stats`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async listConversations(accessToken: string, q?: string): Promise<ConversationSummary[]> {
    const suffix = q ? `?q=${encodeURIComponent(q)}` : '';
    const res = await fetch(`${API_BASE_URL}/api/v1/conversations${suffix}`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async getConversation(accessToken: string, id: string): Promise<ConversationDetail> {
    const res = await fetch(`${API_BASE_URL}/api/v1/conversations/${id}`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async replyToConversation(accessToken: string, id: string, body: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/conversations/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async markConversationRead(accessToken: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/conversations/${id}/read`, {
      method: 'POST',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async listNotifications(accessToken: string): Promise<NotificationSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/notifications`, { headers: authHeaders(accessToken) });
    return asJson(res);
  },

  async markNotificationRead(accessToken: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/notifications/${id}/read`, {
      method: 'POST',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async markAllNotificationsRead(accessToken: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/notifications/read-all`, {
      method: 'POST',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async listLeaveRequests(accessToken: string, status?: string): Promise<LeaveRequestSummary[]> {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await fetch(`${API_BASE_URL}/api/v1/leave-requests${suffix}`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async approveLeaveRequest(accessToken: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/leave-requests/${id}/approve`, {
      method: 'POST',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async rejectLeaveRequest(accessToken: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/leave-requests/${id}/reject`, {
      method: 'POST',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async previewPromotions(accessToken: string, sourceSectionId: string): Promise<PromotionPreview> {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/promotions/preview?sourceSectionId=${encodeURIComponent(sourceSectionId)}`,
      { headers: authHeaders(accessToken) },
    );
    return asJson(res);
  },

  async executePromotions(
    accessToken: string,
    payload: {
      sourceAcademicSessionId: string;
      targetAcademicSessionId: string;
      confirmed: true;
      decisions: PromotionDecisionInput[];
    },
  ): Promise<{ processed: number }> {
    const res = await fetch(`${API_BASE_URL}/api/v1/promotions/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async getPromotionPolicy(accessToken: string, schoolId?: string): Promise<PromotionPolicy & { schoolId: string }> {
    const query = schoolId ? `?schoolId=${encodeURIComponent(schoolId)}` : '';
    const res = await fetch(`${API_BASE_URL}/api/v1/promotions/policy${query}`, { headers: authHeaders(accessToken) });
    return asJson(res);
  },

  async updatePromotionPolicy(
    accessToken: string,
    payload: PromotionPolicy & { schoolId?: string },
  ): Promise<PromotionPolicy & { schoolId: string }> {
    const res = await fetch(`${API_BASE_URL}/api/v1/promotions/policy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async copySessionStructure(
    accessToken: string,
    targetSessionId: string,
    sourceSessionId: string,
  ): Promise<CopyStructureResult> {
    const res = await fetch(`${API_BASE_URL}/api/v1/academic-sessions/${targetSessionId}/copy-structure`, {
      method: 'POST',
      headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceSessionId }),
    });
    return asJson(res);
  },

  async listTeachingAssignments(
    accessToken: string,
    filters: {
      teacherId?: string;
      academicSessionId?: string;
      classId?: string;
      sectionId?: string;
      subjectId?: string;
      role?: TeachingAssignmentRow['role'];
      current?: boolean;
    },
  ): Promise<TeachingAssignmentRow[]> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '') params.set(key, String(value));
    }
    const res = await fetch(`${API_BASE_URL}/api/v1/teaching-assignments?${params.toString()}`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async getPromotionHistory(accessToken: string, studentId: string): Promise<PromotionHistoryRow[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/students/${studentId}/promotion-history`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async listFeeStructures(accessToken: string): Promise<FeeStructureSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/fee-structures`, { headers: authHeaders(accessToken) });
    return asJson(res);
  },

  async updateFeeStructure(
    accessToken: string,
    id: string,
    payload: { name?: string; amount?: number; status?: FeeStructureStatus },
  ): Promise<FeeStructureSummary> {
    const res = await fetch(`${API_BASE_URL}/api/v1/fee-structures/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async createFeeStructure(
    accessToken: string,
    payload: { name: string; amount: number; schoolId?: string },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/fee-structures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async issueFeeVouchers(
    accessToken: string,
    payload: {
      studentIds?: string[];
      sectionId?: string;
      month: string;
      dueDate: string;
      feeStructureIds: string[];
    },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/fee-vouchers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async studentFees(accessToken: string, studentId: string): Promise<FeeVoucherSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/students/${studentId}/fees`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async studentFeePayments(accessToken: string, studentId: string): Promise<FeePaymentSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/students/${studentId}/fees/payments`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async reconcileVoucher(
    accessToken: string,
    voucherId: string,
    payload: { amount: number; method: 'cash' | 'bank_transfer'; note?: string },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/fee-vouchers/${voucherId}/reconcile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  // Direct authenticated download links (the backend's JwtStrategy accepts ?access_token= as a
  // fallback specifically so links like this work) — not fetch calls, used directly as <a href>.
  voucherPdfUrl(accessToken: string, voucherId: string): string {
    return `${API_BASE_URL}/api/v1/fee-vouchers/${voucherId}/pdf?access_token=${encodeURIComponent(accessToken)}`;
  },

  receiptPdfUrl(accessToken: string, paymentId: string): string {
    return `${API_BASE_URL}/api/v1/fee-payments/${paymentId}/receipt.pdf?access_token=${encodeURIComponent(accessToken)}`;
  },

  reportCardPdfUrl(accessToken: string, reportCardId: string): string {
    return `${API_BASE_URL}/api/v1/report-cards/${reportCardId}/pdf?access_token=${encodeURIComponent(accessToken)}`;
  },

  filePreviewUrl(accessToken: string, fileId: string): string {
    return `${API_BASE_URL}/api/v1/files/${fileId}?access_token=${encodeURIComponent(accessToken)}`;
  },

  async listAdminTeachers(accessToken: string): Promise<TeacherAdminSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/teachers`, { headers: authHeaders(accessToken) });
    return asJson(res);
  },

  async updateTeacher(
    accessToken: string,
    id: string,
    payload: { name?: string; password?: string },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/teachers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async deleteTeacher(accessToken: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/teachers/${id}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async listAdminParentsPage(accessToken: string, params: PageParams): Promise<Page<ParentSummary>> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/parents?${pageQuery(params)}`, {
      headers: authHeaders(accessToken),
    });
    return asPage(res);
  },

  async listAdminParents(accessToken: string): Promise<ParentSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/parents`, { headers: authHeaders(accessToken) });
    return asJson(res);
  },

  async createParent(accessToken: string, payload: NewParentInput): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/parents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async updateParent(
    accessToken: string,
    id: string,
    payload: UpdateParentInput,
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/parents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async getParentProfile(accessToken: string, id: string): Promise<ParentProfileDetail> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/parents/${id}`, { headers: authHeaders(accessToken) });
    return asJson(res);
  },

  // BL-32: accounts staff in the caller's scope, and replacing one user's module grants.
  async listAccountsStaff(accessToken: string): Promise<AccountAccessStatus[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/users/accounts-staff`, { headers: authHeaders(accessToken) });
    return asJson(res);
  },

  async setStaffGrants(accessToken: string, userId: string, grants: string[]): Promise<AccountAccessStatus> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/users/${userId}/grants`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify({ grants }),
    });
    return asJson(res);
  },

  // BL-64: one-time temporary password for a parent (admin-assisted reset, pilot fallback).
  async resetParentPassword(
    accessToken: string,
    parentId: string,
  ): Promise<{ temporaryPassword: string; mustChangePassword: boolean }> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/parents/${parentId}/reset-password`, {
      method: 'POST',
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async updateParentChildLink(
    accessToken: string,
    parentId: string,
    studentId: string,
    payload: {
      isPrimary?: boolean;
      isEmergencyContact?: boolean;
      relationshipType?: string;
      relationshipNote?: string;
    },
  ): Promise<ParentProfileDetail> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/parents/${parentId}/children/${studentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  // BL-23: link another of the caller's students to a guardian / remove such a link.
  async linkParentChild(
    accessToken: string,
    parentId: string,
    payload: { studentId: string; relationshipType: string; relationshipNote?: string; isPrimary?: boolean },
  ): Promise<ParentProfileDetail> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/parents/${parentId}/children`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async unlinkParentChild(accessToken: string, parentId: string, studentId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/parents/${parentId}/children/${studentId}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  // BL-23: find an existing guardian by exact login or CNIC (never by name) to link, not duplicate.
  async lookupParent(
    accessToken: string,
    key: { identifier?: string; cnic?: string },
  ): Promise<ParentLookupResult> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/parents/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(key),
    });
    return asJson(res);
  },

  async deleteParent(accessToken: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/parents/${id}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  /** BL-07: `archived` lists only archived students (default: only active ones). */
  async listAdminStudentsPage(
    accessToken: string,
    params: PageParams,
    archived = false,
  ): Promise<Page<StudentAdminSummary>> {
    const suffix = archived ? '&archived=true' : '';
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/students?${pageQuery(params)}${suffix}`, {
      headers: authHeaders(accessToken),
    });
    return asPage(res);
  },

  async listAdminStudents(accessToken: string): Promise<StudentAdminSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/students`, { headers: authHeaders(accessToken) });
    return asJson(res);
  },

  async createStudent(
    accessToken: string,
    payload: {
      grNumber: string;
      name: string;
      sectionId: string;
      parentProfileId?: string;
      newParent?: NewParentInput;
      relationshipType: string;
    },
  ): Promise<StudentAdminSummary> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async updateStudent(
    accessToken: string,
    id: string,
    payload: { grNumber?: string; name?: string },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/students/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  /** BL-07: brings an archived student/staff member back into the lists. */
  async unarchiveRecord(accessToken: string, kind: 'students' | 'staff', id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/${kind}/${id}/unarchive`, {
      method: 'POST',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  /** BL-07: archives (the API never hard-deletes a student). */
  async deleteStudent(accessToken: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/students/${id}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async getStudentProfile(accessToken: string, studentId: string): Promise<StudentProfileDetail> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/students/${studentId}/profile`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async updateStudentProfile(
    accessToken: string,
    studentId: string,
    payload: UpdateStudentProfilePayload,
  ): Promise<StudentProfileDetail> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/students/${studentId}/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async updateStudentCurrentEnrollment(
    accessToken: string,
    studentId: string,
    payload: UpdateCurrentEnrollmentPayload,
  ): Promise<StudentCurrentEnrollmentDetail> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/students/${studentId}/current-enrollment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async upsertStudentPreviousSchool(
    accessToken: string,
    studentId: string,
    payload: UpdatePreviousSchoolPayload,
  ): Promise<StudentPreviousSchoolDetail> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/students/${studentId}/previous-school`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async createStudentEmergencyContact(
    accessToken: string,
    studentId: string,
    payload: CreateEmergencyContactPayload,
  ): Promise<StudentEmergencyContactDetail> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/students/${studentId}/emergency-contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async updateStudentEmergencyContact(
    accessToken: string,
    studentId: string,
    contactId: string,
    payload: UpdateEmergencyContactPayload,
  ): Promise<StudentEmergencyContactDetail> {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/admin/students/${studentId}/emergency-contacts/${contactId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
        body: JSON.stringify(payload),
      },
    );
    return asJson(res);
  },

  async deleteStudentEmergencyContact(accessToken: string, studentId: string, contactId: string): Promise<void> {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/admin/students/${studentId}/emergency-contacts/${contactId}`,
      { method: 'DELETE', headers: authHeaders(accessToken) },
    );
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async upsertStudentMedicalInfo(
    accessToken: string,
    studentId: string,
    payload: UpdateMedicalInfoPayload,
  ): Promise<StudentMedicalInfoDetail> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/students/${studentId}/medical-info`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async addStudentDocument(
    accessToken: string,
    studentId: string,
    payload: AddDocumentPayload,
  ): Promise<StudentDocumentDetail> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/students/${studentId}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async verifyStudentDocument(
    accessToken: string,
    studentId: string,
    documentId: string,
    verified: boolean,
  ): Promise<StudentDocumentDetail> {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/admin/students/${studentId}/documents/${documentId}/verify`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
        body: JSON.stringify({ verified }),
      },
    );
    return asJson(res);
  },

  async listAdminStaff(accessToken: string, employeeType?: string, archived = false): Promise<StaffAdminSummary[]> {
    const qs = new URLSearchParams();
    if (employeeType) qs.set('employeeType', employeeType);
    if (archived) qs.set('archived', 'true');
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/staff${suffix}`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async createStaff(accessToken: string, payload: NewStaffInput): Promise<{ id: string; name: string }> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async updateStaff(
    accessToken: string,
    id: string,
    payload: { name?: string; mobile?: string; email?: string; employmentStatus?: StaffAdminSummary['employmentStatus'] },
  ): Promise<StaffAdminSummary> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/staff/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async deleteStaff(accessToken: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/staff/${id}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async getStaffProfile(accessToken: string, staffId: string): Promise<StaffProfileDetail> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/staff/${staffId}/profile`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async updateStaffProfile(
    accessToken: string,
    staffId: string,
    payload: UpdateStaffProfilePayload,
  ): Promise<StaffProfileDetail> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/staff/${staffId}/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },
 
    async createStaffEmergencyContact(
    accessToken: string,
    staffId: string,
    payload: CreateStaffEmergencyContactPayload,
  ): Promise<StaffEmergencyContactDetail> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/staff/${staffId}/emergency-contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async updateStaffEmergencyContact(
    accessToken: string,
    staffId: string,
    contactId: string,
    payload: UpdateStaffEmergencyContactPayload,
  ): Promise<StaffEmergencyContactDetail> {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/admin/staff/${staffId}/emergency-contacts/${contactId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
        body: JSON.stringify(payload),
      },
    );
    return asJson(res);
  },

  async deleteStaffEmergencyContact(accessToken: string, staffId: string, contactId: string): Promise<void> {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/admin/staff/${staffId}/emergency-contacts/${contactId}`,
      { method: 'DELETE', headers: authHeaders(accessToken) },
    );
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async createStaffExperience(
    accessToken: string,
    staffId: string,
    payload: CreateStaffExperiencePayload,
  ): Promise<StaffExperienceDetail> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/staff/${staffId}/experience`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async updateStaffExperience(
    accessToken: string,
    staffId: string,
    experienceId: string,
    payload: UpdateStaffExperiencePayload,
  ): Promise<StaffExperienceDetail> {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/admin/staff/${staffId}/experience/${experienceId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
        body: JSON.stringify(payload),
      },
    );
    return asJson(res);
  },

  async deleteStaffExperience(accessToken: string, staffId: string, experienceId: string): Promise<void> {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/admin/staff/${staffId}/experience/${experienceId}`,
      { method: 'DELETE', headers: authHeaders(accessToken) },
    );
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async addStaffDocument(
    accessToken: string,
    staffId: string,
    payload: AddStaffDocumentPayload,
  ): Promise<StaffDocumentDetail> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/staff/${staffId}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async verifyStaffDocument(
    accessToken: string,
    staffId: string,
    documentId: string,
    verified: boolean,
  ): Promise<StaffDocumentDetail> {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/admin/staff/${staffId}/documents/${documentId}/verify`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
        body: JSON.stringify({ verified }),
      },
    );
    return asJson(res);
  },

  async forgotPassword(identifier: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    });
    return asJson(res);
  },

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    return asJson(res);
  },

  async markAttendanceBulk(
    accessToken: string,
    payload: { date: string; marks: { studentId: string; status: AttendanceStatus }[] },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/attendance/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async teacherTimetable(accessToken: string): Promise<TimetableEntrySummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/teachers/me/timetable`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async listHolidays(
    accessToken: string,
    params?: { campusId?: string; from?: string; to?: string },
  ): Promise<HolidaySummary[]> {
    const query = new URLSearchParams();
    if (params?.campusId) query.set('campusId', params.campusId);
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`${API_BASE_URL}/api/v1/holidays${suffix}`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async createHoliday(
    accessToken: string,
    payload: { title: string; startDate: string; endDate: string; campusId?: string; schoolId?: string },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/holidays`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async updateHoliday(
    accessToken: string,
    id: string,
    payload: { title?: string; startDate?: string; endDate?: string; campusId?: string },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/holidays/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async deleteHoliday(accessToken: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/holidays/${id}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async listComplaints(accessToken: string, studentId: string): Promise<ComplaintSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/complaints?studentId=${encodeURIComponent(studentId)}`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async createComplaint(
    accessToken: string,
    payload: { studentId: string; subject: string; description: string },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async updateComplaintStatus(accessToken: string, id: string, status: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/complaints/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async uploadReportCard(
    accessToken: string,
    payload: { studentId: string; academicSessionId: string; file: File },
  ): Promise<void> {
    const formData = new FormData();
    formData.append('studentId', payload.studentId);
    formData.append('academicSessionId', payload.academicSessionId);
    formData.append('file', payload.file);
    const res = await fetch(`${API_BASE_URL}/api/v1/report-cards`, {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: formData,
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async listReportCards(accessToken: string, studentId: string): Promise<ReportCardSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/report-cards?studentId=${encodeURIComponent(studentId)}`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async suggestCircularDraft(accessToken: string, context: string): Promise<{ suggestion: string }> {
    const res = await fetch(`${API_BASE_URL}/api/v1/circulars/draft-suggestion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify({ context }),
    });
    return asJson(res);
  },

  async suggestDiaryDraft(accessToken: string, context: string): Promise<{ suggestion: string }> {
    const res = await fetch(`${API_BASE_URL}/api/v1/diary/draft-suggestion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify({ context }),
    });
    return asJson(res);
  },

  async getFlaggedStudents(accessToken: string): Promise<AttendanceRiskSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/attendance-risk`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async listTerms(accessToken: string, academicSessionId: string): Promise<TermSummary[]> {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/terms?academicSessionId=${encodeURIComponent(academicSessionId)}`,
      { headers: authHeaders(accessToken) },
    );
    return asJson(res);
  },

  async createTerm(
    accessToken: string,
    payload: { academicSessionId: string; label: string; order: number; startDate: string; endDate: string },
  ): Promise<TermSummary> {
    const res = await fetch(`${API_BASE_URL}/api/v1/terms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async updateTerm(
    accessToken: string,
    id: string,
    payload: { label?: string; order?: number; startDate?: string; endDate?: string },
  ): Promise<TermSummary> {
    const res = await fetch(`${API_BASE_URL}/api/v1/terms/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async deleteTerm(accessToken: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/terms/${id}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async listAssessmentCategories(
    accessToken: string,
    classId: string,
    termId: string,
  ): Promise<AssessmentCategorySummary[]> {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/assessment-categories?classId=${encodeURIComponent(classId)}&termId=${encodeURIComponent(termId)}`,
      { headers: authHeaders(accessToken) },
    );
    return asJson(res);
  },

  async createAssessmentCategory(
    accessToken: string,
    payload: { classId: string; termId: string; name: string; weightPercent: number },
  ): Promise<AssessmentCategorySummary> {
    const res = await fetch(`${API_BASE_URL}/api/v1/assessment-categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async updateAssessmentCategory(
    accessToken: string,
    id: string,
    payload: { name?: string; weightPercent?: number },
  ): Promise<AssessmentCategorySummary> {
    const res = await fetch(`${API_BASE_URL}/api/v1/assessment-categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  // BL-26: syllabus per class + subject.
  async listSyllabi(accessToken: string, classId: string): Promise<SyllabusSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/syllabi?classId=${encodeURIComponent(classId)}`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async getSyllabus(accessToken: string, id: string): Promise<SyllabusDetail> {
    const res = await fetch(`${API_BASE_URL}/api/v1/syllabi/${id}`, { headers: authHeaders(accessToken) });
    return asJson(res);
  },

  async createSyllabus(
    accessToken: string,
    input: { classId: string; subjectId: string; overview?: string | null; units?: SyllabusUnitInput[] },
  ): Promise<SyllabusDetail> {
    const res = await fetch(`${API_BASE_URL}/api/v1/syllabi`, {
      method: 'POST',
      headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return asJson(res);
  },

  async updateSyllabus(
    accessToken: string,
    id: string,
    input: { overview: string | null; units: SyllabusUnitInput[] },
  ): Promise<SyllabusDetail> {
    const res = await fetch(`${API_BASE_URL}/api/v1/syllabi/${id}`, {
      method: 'PUT',
      headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return asJson(res);
  },

  async deleteSyllabus(accessToken: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/syllabi/${id}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async deleteAssessmentCategory(accessToken: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/assessment-categories/${id}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async listAssessments(accessToken: string, assessmentCategoryId: string): Promise<AssessmentSummary[]> {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/assessments?assessmentCategoryId=${encodeURIComponent(assessmentCategoryId)}`,
      { headers: authHeaders(accessToken) },
    );
    return asJson(res);
  },

  async createAssessment(
    accessToken: string,
    payload: { assessmentCategoryId: string; subjectId: string; label: string; maxMarks: number },
  ): Promise<AssessmentSummary> {
    const res = await fetch(`${API_BASE_URL}/api/v1/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async saveMarksBulk(
    accessToken: string,
    assessmentId: string,
    payload: { marks: { studentId: string; obtainedMarks: number }[] },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/assessments/${assessmentId}/marks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async getStudentGrades(accessToken: string, studentId: string, termId: string): Promise<SubjectGrade[]> {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/students/${studentId}/grades?termId=${encodeURIComponent(termId)}`,
      { headers: authHeaders(accessToken) },
    );
    return asJson(res);
  },

  async createApplicant(
    accessToken: string,
    payload: { name: string; dateOfBirth: string; guardianName: string; guardianPhone: string },
  ): Promise<{ applicant: ApplicantSummary; possibleDuplicate: ApplicantSummary | null }> {
    const res = await fetch(`${API_BASE_URL}/api/v1/applicants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async listApplicants(accessToken: string, guardianPhone: string): Promise<ApplicantSummary[]> {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/applicants?guardianPhone=${encodeURIComponent(guardianPhone)}`,
      { headers: authHeaders(accessToken) },
    );
    return asJson(res);
  },

  async createApplication(
    accessToken: string,
    payload: { applicantId: string; desiredClassId: string; academicSessionId: string },
  ): Promise<ApplicationSummary> {
    const res = await fetch(`${API_BASE_URL}/api/v1/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async listApplications(
    accessToken: string,
    params?: { academicSessionId?: string; status?: string },
  ): Promise<ApplicationSummary[]> {
    const query = new URLSearchParams();
    if (params?.academicSessionId) query.set('academicSessionId', params.academicSessionId);
    if (params?.status) query.set('status', params.status);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`${API_BASE_URL}/api/v1/applications${suffix}`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async getApplication(accessToken: string, id: string): Promise<ApplicationSummary> {
    const res = await fetch(`${API_BASE_URL}/api/v1/applications/${id}`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async updateApplicationStatus(
    accessToken: string,
    id: string,
    payload: { status?: 'UNDER_REVIEW' | 'WITHDRAWN'; decisionNotes?: string },
  ): Promise<ApplicationSummary> {
    const res = await fetch(`${API_BASE_URL}/api/v1/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async rejectApplication(accessToken: string, id: string, decisionNotes: string): Promise<ApplicationSummary> {
    const res = await fetch(`${API_BASE_URL}/api/v1/applications/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify({ decisionNotes }),
    });
    return asJson(res);
  },

  async approveApplication(
    accessToken: string,
    id: string,
    payload: {
      grNumber: string;
      sectionId: string;
      parentProfileId?: string;
      newParent?: NewParentInput;
      relationshipType: string;
    },
  ): Promise<ApplicationSummary> {
    const res = await fetch(`${API_BASE_URL}/api/v1/applications/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async createHiringCandidate(
    accessToken: string,
    payload: { name: string; dateOfBirth?: string; cnic?: string; contactPhone: string; contactEmail?: string; resumeFileId?: string },
  ): Promise<{ candidate: HiringCandidateSummary; possibleDuplicate: HiringCandidateSummary | null }> {
    const res = await fetch(`${API_BASE_URL}/api/v1/hiring/candidates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async findHiringCandidatesByPhone(accessToken: string, contactPhone: string): Promise<HiringCandidateSummary[]> {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/hiring/candidates?contactPhone=${encodeURIComponent(contactPhone)}`,
      { headers: authHeaders(accessToken) },
    );
    return asJson(res);
  },

  async createHiringApplication(
    accessToken: string,
    payload: { candidateId: string; employeeType: string; campusId: string },
  ): Promise<HiringApplicationSummary> {
    const res = await fetch(`${API_BASE_URL}/api/v1/hiring/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async listHiringApplications(
    accessToken: string,
    params?: { campusId?: string; status?: string },
  ): Promise<HiringApplicationSummary[]> {
    const query = new URLSearchParams();
    if (params?.campusId) query.set('campusId', params.campusId);
    if (params?.status) query.set('status', params.status);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`${API_BASE_URL}/api/v1/hiring/applications${suffix}`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async getHiringApplication(accessToken: string, id: string): Promise<HiringApplicationSummary> {
    const res = await fetch(`${API_BASE_URL}/api/v1/hiring/applications/${id}`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async updateHiringApplicationStatus(
    accessToken: string,
    id: string,
    payload: { status?: 'SHORTLISTED' | 'INTERVIEWED'; decisionNotes?: string },
  ): Promise<HiringApplicationSummary> {
    const res = await fetch(`${API_BASE_URL}/api/v1/hiring/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async rejectHiringApplication(accessToken: string, id: string, decisionNotes: string): Promise<HiringApplicationSummary> {
    const res = await fetch(`${API_BASE_URL}/api/v1/hiring/applications/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify({ decisionNotes }),
    });
    return asJson(res);
  },

  async approveHiringApplication(
    accessToken: string,
    id: string,
    payload: {
      dateOfBirth?: string; cnic?: string; mobile?: string; email?: string; joiningDate?: string;
      login?: { identifier: string; password: string };
    },
  ): Promise<HiringApplicationSummary> {
    const res = await fetch(`${API_BASE_URL}/api/v1/hiring/applications/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },
  
  async previewBulkImport(accessToken: string, entity: BulkImportEntity, file: File): Promise<BulkImportPreviewResult> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE_URL}/api/v1/bulk-import/${entity}/preview`, {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: formData,
    });
    return asJson(res);
  },

  async commitBulkImport(accessToken: string, entity: BulkImportEntity, file: File): Promise<{ createdCount: number }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE_URL}/api/v1/bulk-import/${entity}/commit`, {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new ApiError(body?.message ?? 'Import failed.', res.status);
    }
    return res.json();
  },

  /** BL-41: audited CSV export of one school's records; the server decides scope and sensitive columns. */
  async downloadDataExport(accessToken: string, dataset: DataExportDataset, params: DataExportParams = {}): Promise<void> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '' && value !== false) query.set(key, String(value));
    }
    const qs = query.toString();
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/exports/${dataset}${qs ? `?${qs}` : ''}`, {
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
    const filename = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? `${dataset}.csv`;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },

  async downloadBulkImportSample(accessToken: string, entity: BulkImportEntity): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/bulk-import/${entity}/sample`, {
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${entity}-sample.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },
};
