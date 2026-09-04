const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

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
    payload: { name?: string; classTeacherId?: string },
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

  // Direct authenticated download links (the backend's JwtStrategy accepts ?access_token= as a
  // fallback specifically so links like this work) — not fetch calls, used directly as <a href>.
  voucherPdfUrl(accessToken: string, voucherId: string): string {
    return `${API_BASE_URL}/api/v1/fee-vouchers/${voucherId}/pdf?access_token=${encodeURIComponent(accessToken)}`;
  },

  receiptPdfUrl(accessToken: string, paymentId: string): string {
    return `${API_BASE_URL}/api/v1/fee-payments/${paymentId}/receipt.pdf?access_token=${encodeURIComponent(accessToken)}`;
  },
};
