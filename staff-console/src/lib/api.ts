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
  classTeacherId?: string | null;
  classTeacherName?: string | null;
}

export interface SchoolSummary {
  id: string;
  name: string;
}

export interface CampusSummary {
  id: string;
  name: string;
  schoolId: string;
  schoolName: string;
}

export interface AcademicSessionSummary {
  id: string;
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

export interface StudentSummary {
  id: string;
  name: string;
  grNumber: string;
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE' | 'HOLIDAY';

export interface SubjectSummary {
  id: string;
  name: string;
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

export interface FeeStructureSummary {
  id: string;
  name: string;
  amount: number; // paisa
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
    class: { id: string; name: string; campus: { id: string; name: string } };
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
  status: 'ACTIVE' | 'LEFT' | 'GRADUATED' | 'WITHDRAWN';
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
  status?: 'ACTIVE' | 'LEFT' | 'GRADUATED' | 'WITHDRAWN';
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
  teacher: { id: string; name: string } | null;
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

export type BulkImportEntity = 'students' | 'parents' | 'teachers';

function authHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new ApiError(await parseErrorMessage(res), res.status);
  }
  return (await res.json()) as T;
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

  async refresh(refreshToken: string): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
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

  async createSchool(accessToken: string, payload: { name: string }): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/schools`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async updateSchool(accessToken: string, id: string, payload: { name?: string }): Promise<void> {
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

  async createCampus(accessToken: string, payload: { schoolId: string; name: string }): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/campuses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async updateCampus(accessToken: string, id: string, payload: { name?: string }): Promise<void> {
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
    payload: { label: string; startDate: string; endDate: string; isActive: boolean },
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

  async listSubjects(accessToken: string): Promise<SubjectSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/subjects`, { headers: authHeaders(accessToken) });
    return asJson(res);
  },

  async listTeachers(accessToken: string): Promise<TeacherSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/teachers`, { headers: authHeaders(accessToken) });
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

  async listFeeStructures(accessToken: string): Promise<FeeStructureSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/fee-structures`, { headers: authHeaders(accessToken) });
    return asJson(res);
  },

  async createFeeStructure(accessToken: string, payload: { name: string; amount: number }): Promise<void> {
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

  async createTeacher(
    accessToken: string,
    payload: { identifier: string; password: string; name: string; campusId: string },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/teachers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
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
    payload: { name?: string; phone?: string; password?: string },
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

  async deleteParent(accessToken: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/parents/${id}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async listAdminStudents(accessToken: string): Promise<StudentAdminSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/students`, { headers: authHeaders(accessToken) });
    return asJson(res);
  },

  async createStudent(
    accessToken: string,
    payload: { grNumber: string; name: string; sectionId: string; parentProfileId?: string; newParent?: NewParentInput },
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

  async listAdminStaff(accessToken: string, employeeType?: string): Promise<StaffAdminSummary[]> {
    const suffix = employeeType ? `?employeeType=${encodeURIComponent(employeeType)}` : '';
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/staff${suffix}`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
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
    payload: { title: string; startDate: string; endDate: string; campusId?: string },
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
    payload: { grNumber: string; sectionId: string; parentProfileId?: string; newParent?: NewParentInput },
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
};
