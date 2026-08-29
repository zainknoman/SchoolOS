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

  async sectionStudents(accessToken: string, sectionId: string): Promise<StudentSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/sections/${sectionId}/students`, {
      headers: authHeaders(accessToken),
    });
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
};
