import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ApplicantIntakeView from './ApplicantIntakeView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listClasses: vi.fn(),
    listAcademicSessions: vi.fn(),
    createApplicant: vi.fn(),
    createApplication: vi.fn(),
  },
}));

describe('ApplicantIntakeView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listClasses).mockResolvedValue([
      { id: 'class-1', name: 'Grade 3', campusId: 'campus-1', campusName: 'Gulistan-e-Jauhar', academicSessionId: 'sess-1', academicSessionLabel: '2026-2027' },
    ]);
    vi.mocked(api.listAcademicSessions).mockResolvedValue([
      { id: 'sess-1', label: '2026-2027', startDate: '2026-08-01', endDate: '2027-06-30', isActive: true },
    ]);
  });

  it('creates an applicant, then an application for them, with no duplicate warning', async () => {
    vi.mocked(api.createApplicant).mockResolvedValue({
      applicant: { id: 'app-1', name: 'Zainab Ali', dateOfBirth: '2019-04-01', guardianName: 'Ali Khan', guardianPhone: '03001234567' },
      possibleDuplicate: null,
    });
    vi.mocked(api.createApplication).mockResolvedValue({
      id: 'appl-1', applicantId: 'app-1', applicantName: 'Zainab Ali', desiredClassId: 'class-1',
      academicSessionId: 'sess-1', status: 'SUBMITTED', decisionNotes: null, reviewedById: null,
      createdStudentId: null,
    });

    const wrapper = mount(ApplicantIntakeView);
    await flushPromises();

    await wrapper.find('[data-testid="applicant-name"]').setValue('Zainab Ali');
    await wrapper.find('[data-testid="applicant-dob"]').setValue('2019-04-01');
    await wrapper.find('[data-testid="applicant-guardian-name"]').setValue('Ali Khan');
    await wrapper.find('[data-testid="applicant-guardian-phone"]').setValue('03001234567');
    await wrapper.find('[data-testid="applicant-submit"]').trigger('click');
    await flushPromises();

    expect(api.createApplicant).toHaveBeenCalledWith('token-1', {
      name: 'Zainab Ali', dateOfBirth: '2019-04-01', guardianName: 'Ali Khan', guardianPhone: '03001234567',
    });
    expect(wrapper.find('[data-testid="duplicate-banner"]').exists()).toBe(false);

    await wrapper.find('[data-testid="application-class"]').setValue('class-1');
    await wrapper.find('[data-testid="application-session"]').setValue('sess-1');
    await wrapper.find('[data-testid="application-submit"]').trigger('click');
    await flushPromises();

    expect(api.createApplication).toHaveBeenCalledWith('token-1', {
      applicantId: 'app-1', desiredClassId: 'class-1', academicSessionId: 'sess-1',
    });
  });

  it('shows a duplicate banner when the create response flags a possible match', async () => {
    vi.mocked(api.createApplicant).mockResolvedValue({
      applicant: { id: 'app-2', name: 'Zainab Ali', dateOfBirth: '2019-04-01', guardianName: 'Ali Khan', guardianPhone: '03001234567' },
      possibleDuplicate: { id: 'app-1', name: 'Zainab Ali', dateOfBirth: '2019-04-01', guardianName: 'Ali Khan', guardianPhone: '03001234567' },
    });

    const wrapper = mount(ApplicantIntakeView);
    await flushPromises();
    await wrapper.find('[data-testid="applicant-name"]').setValue('Zainab Ali');
    await wrapper.find('[data-testid="applicant-dob"]').setValue('2019-04-01');
    await wrapper.find('[data-testid="applicant-guardian-name"]').setValue('Ali Khan');
    await wrapper.find('[data-testid="applicant-guardian-phone"]').setValue('03001234567');
    await wrapper.find('[data-testid="applicant-submit"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="duplicate-banner"]').text()).toContain('Zainab Ali');
  });
});
