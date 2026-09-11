import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TeacherComplaintsView from './TeacherComplaintsView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listSections: vi.fn(),
    sectionStudents: vi.fn(),
    listComplaints: vi.fn(),
    createComplaint: vi.fn(),
    updateComplaintStatus: vi.fn(),
  },
}));

describe('TeacherComplaintsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    vi.mocked(api.listSections).mockReset();
    vi.mocked(api.sectionStudents).mockReset();
    vi.mocked(api.listComplaints).mockReset();
    vi.mocked(api.createComplaint).mockReset();
    vi.mocked(api.updateComplaintStatus).mockReset();
  });

  it('loads sections, then students once a section is picked, then complaints once a student is picked', async () => {
    vi.mocked(api.listSections).mockResolvedValue([
      { id: 'sec-1', name: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
    ]);
    vi.mocked(api.sectionStudents).mockResolvedValue([
      { id: 's1', name: 'Eshaal', grNumber: 'GR-1001' },
    ]);
    vi.mocked(api.listComplaints).mockResolvedValue([
      {
        id: 'c1',
        studentId: 's1',
        raisedById: 'u1',
        subject: 'Late homework',
        description: 'Missed chapter 4 submission',
        status: 'open',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ]);

    const wrapper = mount(TeacherComplaintsView);
    await flushPromises();

    expect(wrapper.find('option[value="sec-1"]').exists()).toBe(true);
    expect(api.sectionStudents).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="section-select"]').setValue('sec-1');
    await flushPromises();

    expect(api.sectionStudents).toHaveBeenCalledWith('token-1', 'sec-1');
    expect(wrapper.find('option[value="s1"]').exists()).toBe(true);
    expect(api.listComplaints).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="student-select"]').setValue('s1');
    await flushPromises();

    expect(api.listComplaints).toHaveBeenCalledWith('token-1', 's1');
    expect(wrapper.text()).toContain('Late homework');
  });

  it('raises a complaint for the selected student', async () => {
    vi.mocked(api.listSections).mockResolvedValue([
      { id: 'sec-1', name: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
    ]);
    vi.mocked(api.sectionStudents).mockResolvedValue([
      { id: 's1', name: 'Eshaal', grNumber: 'GR-1001' },
    ]);
    vi.mocked(api.listComplaints).mockResolvedValue([]);
    vi.mocked(api.createComplaint).mockResolvedValue(undefined);

    const wrapper = mount(TeacherComplaintsView);
    await flushPromises();
    await wrapper.find('[data-testid="section-select"]').setValue('sec-1');
    await flushPromises();
    await wrapper.find('[data-testid="student-select"]').setValue('s1');
    await flushPromises();

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="add-subject"]').setValue('Uniform');
    await wrapper.find('[data-testid="add-description"]').setValue('Not wearing the school uniform');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createComplaint).toHaveBeenCalledWith('token-1', {
      studentId: 's1',
      subject: 'Uniform',
      description: 'Not wearing the school uniform',
    });
  });
});
