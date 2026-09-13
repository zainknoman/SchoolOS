// staff-console/src/views/ReportCardsView.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ReportCardsView from './ReportCardsView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listAdminStudents: vi.fn(),
    listAcademicSessions: vi.fn(),
    listReportCards: vi.fn(),
    uploadReportCard: vi.fn(),
    reportCardPdfUrl: vi.fn(() => 'https://example.test/pdf'),
    listTerms: vi.fn(),
    getStudentGrades: vi.fn(),
  },
}));

describe('ReportCardsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    vi.mocked(api.listAdminStudents).mockReset();
    vi.mocked(api.listAcademicSessions).mockReset();
    vi.mocked(api.listReportCards).mockReset();
    vi.mocked(api.uploadReportCard).mockReset();
    vi.mocked(api.listTerms).mockReset();
    vi.mocked(api.getStudentGrades).mockReset();
    vi.mocked(api.listAdminStudents).mockResolvedValue([
      { id: 's1', grNumber: 'GR-1001', name: 'Eshaal Sample', sectionName: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
    ]);
    vi.mocked(api.listAcademicSessions).mockResolvedValue([
      { id: 'sess-1', label: '2026-2027', startDate: '2026-08-01', endDate: '2027-06-30', isActive: true },
    ]);
    vi.mocked(api.listTerms).mockResolvedValue([]);
    vi.mocked(api.getStudentGrades).mockResolvedValue([]);
  });

  it('lists a student\'s existing report cards once selected', async () => {
    vi.mocked(api.listReportCards).mockResolvedValue([
      { id: 'rc1', studentId: 's1', academicSessionId: 'sess-1', fileId: 'f1', createdAt: '2026-06-01T00:00:00.000Z' },
    ]);

    const wrapper = mount(ReportCardsView);
    await flushPromises();
    expect(wrapper.find('[data-testid="download-rc1"]').exists()).toBe(false);

    await wrapper.find('[data-testid="select-student"]').setValue('s1');
    await flushPromises();

    expect(api.listReportCards).toHaveBeenCalledWith('token-1', 's1');
    expect(wrapper.find('[data-testid="download-rc1"]').exists()).toBe(true);
  });

  it('shows an empty state when a student has no report cards', async () => {
    vi.mocked(api.listReportCards).mockResolvedValue([]);

    const wrapper = mount(ReportCardsView);
    await flushPromises();
    await wrapper.find('[data-testid="select-student"]').setValue('s1');
    await flushPromises();

    expect(wrapper.text()).toContain('No report cards uploaded yet.');
  });

  it('uploads a report card for the selected student and session', async () => {
    vi.mocked(api.listReportCards).mockResolvedValue([]);
    vi.mocked(api.uploadReportCard).mockResolvedValue(undefined);

    const wrapper = mount(ReportCardsView);
    await flushPromises();
    await wrapper.find('[data-testid="select-student"]').setValue('s1');
    await wrapper.find('[data-testid="select-session"]').setValue('sess-1');
    await flushPromises();

    const file = new File(['pdf-bytes'], 'card.pdf', { type: 'application/pdf' });
    const fileInput = wrapper.find('[data-testid="select-file"]').element as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', { value: [file] });
    await wrapper.find('[data-testid="select-file"]').trigger('change');

    await wrapper.find('[data-testid="upload-submit"]').trigger('click');
    await flushPromises();

    expect(api.uploadReportCard).toHaveBeenCalledWith('token-1', {
      studentId: 's1',
      academicSessionId: 'sess-1',
      file,
    });
  });

  it('shows the backend error on a duplicate upload for the same student and session', async () => {
    vi.mocked(api.listReportCards).mockResolvedValue([]);
    vi.mocked(api.uploadReportCard).mockRejectedValue(
      new Error('A report card already exists for this student and session'),
    );

    const wrapper = mount(ReportCardsView);
    await flushPromises();
    await wrapper.find('[data-testid="select-student"]').setValue('s1');
    await wrapper.find('[data-testid="select-session"]').setValue('sess-1');
    await flushPromises();

    const file = new File(['pdf-bytes'], 'card.pdf', { type: 'application/pdf' });
    const fileInput = wrapper.find('[data-testid="select-file"]').element as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', { value: [file] });
    await wrapper.find('[data-testid="select-file"]').trigger('change');
    await wrapper.find('[data-testid="upload-submit"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('already exists for this student and session');
  });

  it('shows a structured grade table when the school has adopted the gradebook for this class/term', async () => {
    vi.mocked(api.listReportCards).mockResolvedValue([]);
    vi.mocked(api.listTerms).mockResolvedValue([
      { id: 'term-1', academicSessionId: 'sess-1', label: 'Term 1', order: 1, startDate: '2026-08-01', endDate: '2026-12-15' },
    ]);
    vi.mocked(api.getStudentGrades).mockResolvedValue([
      { subjectId: 'sub-1', subjectName: 'Math', categories: [{ name: 'Quizzes', weightPercent: 30, obtainedPercent: 90 }], finalPercent: 27 },
    ]);

    const wrapper = mount(ReportCardsView);
    await flushPromises();
    await wrapper.find('[data-testid="select-student"]').setValue('s1');
    await wrapper.find('[data-testid="select-session"]').setValue('sess-1');
    await flushPromises();
    await wrapper.find('[data-testid="select-term"]').setValue('term-1');
    await flushPromises();

    expect(wrapper.text()).toContain('Math');
    expect(wrapper.text()).toContain('27%');
  });

  it('falls back to the PDF list when no structured grades exist for this term', async () => {
    vi.mocked(api.listReportCards).mockResolvedValue([
      { id: 'rc1', studentId: 's1', academicSessionId: 'sess-1', fileId: 'f1', createdAt: '2026-06-01T00:00:00.000Z' },
    ]);
    vi.mocked(api.listTerms).mockResolvedValue([
      { id: 'term-1', academicSessionId: 'sess-1', label: 'Term 1', order: 1, startDate: '2026-08-01', endDate: '2026-12-15' },
    ]);
    vi.mocked(api.getStudentGrades).mockResolvedValue([]);

    const wrapper = mount(ReportCardsView);
    await flushPromises();
    await wrapper.find('[data-testid="select-student"]').setValue('s1');
    await wrapper.find('[data-testid="select-session"]').setValue('sess-1');
    await flushPromises();
    await wrapper.find('[data-testid="select-term"]').setValue('term-1');
    await flushPromises();

    expect(wrapper.find('[data-testid="download-rc1"]').exists()).toBe(true);
  });
});