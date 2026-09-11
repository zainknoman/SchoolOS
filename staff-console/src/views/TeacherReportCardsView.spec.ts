import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TeacherReportCardsView from './TeacherReportCardsView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listSections: vi.fn(),
    sectionStudents: vi.fn(),
    listAcademicSessions: vi.fn(),
    listReportCards: vi.fn(),
    uploadReportCard: vi.fn(),
    reportCardPdfUrl: vi.fn(() => 'https://example.test/pdf'),
  },
}));

describe('TeacherReportCardsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    vi.mocked(api.listSections).mockReset();
    vi.mocked(api.sectionStudents).mockReset();
    vi.mocked(api.listAcademicSessions).mockReset();
    vi.mocked(api.listReportCards).mockReset();
    vi.mocked(api.uploadReportCard).mockReset();
  });

  it('loads sections and academic sessions, then students once a section is picked', async () => {
    vi.mocked(api.listSections).mockResolvedValue([
      { id: 'sec-1', name: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
    ]);
    vi.mocked(api.listAcademicSessions).mockResolvedValue([
      { id: 'sess-1', label: '2026-2027', startDate: '2026-08-01', endDate: '2027-06-30', isActive: true },
    ]);
    vi.mocked(api.sectionStudents).mockResolvedValue([{ id: 's1', name: 'Eshaal', grNumber: 'GR-1001' }]);
    vi.mocked(api.listReportCards).mockResolvedValue([]);

    const wrapper = mount(TeacherReportCardsView);
    await flushPromises();

    expect(wrapper.find('option[value="sec-1"]').exists()).toBe(true);
    expect(wrapper.find('option[value="sess-1"]').exists()).toBe(true);
    expect(api.sectionStudents).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="section-select"]').setValue('sec-1');
    await flushPromises();

    expect(api.sectionStudents).toHaveBeenCalledWith('token-1', 'sec-1');
    expect(wrapper.find('option[value="s1"]').exists()).toBe(true);
  });

  it('uploads a report card for the selected student and session', async () => {
    vi.mocked(api.listSections).mockResolvedValue([
      { id: 'sec-1', name: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
    ]);
    vi.mocked(api.listAcademicSessions).mockResolvedValue([
      { id: 'sess-1', label: '2026-2027', startDate: '2026-08-01', endDate: '2027-06-30', isActive: true },
    ]);
    vi.mocked(api.sectionStudents).mockResolvedValue([{ id: 's1', name: 'Eshaal', grNumber: 'GR-1001' }]);
    vi.mocked(api.listReportCards).mockResolvedValue([]);
    vi.mocked(api.uploadReportCard).mockResolvedValue(undefined);

    const wrapper = mount(TeacherReportCardsView);
    await flushPromises();
    await wrapper.find('[data-testid="section-select"]').setValue('sec-1');
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
});
