import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import HiringCandidateIntakeView from './HiringCandidateIntakeView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listCampuses: vi.fn(),
    createHiringCandidate: vi.fn(),
    createHiringApplication: vi.fn(),
    uploadFile: vi.fn(),
  },
}));

describe('HiringCandidateIntakeView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listCampuses).mockResolvedValue([
      { id: 'cam1', name: 'PECHS Campus', schoolId: 'sch1', schoolName: 'SchoolOS School', code: null, campusType: null, logoFileId: null, principalName: null, principalPhone: null, principalEmail: null, openingDate: null, capacity: null, latitude: null, longitude: null, status: 'ACTIVE' as const, departments: [], alternatePhone: null, addressId: null, address: null, phone: null, email: null, studentCount: 0, staffCount: 0 },
    ]);
  });

  it('creates a candidate, then an application once the candidate exists', async () => {
    vi.mocked(api.createHiringCandidate).mockResolvedValue({
      candidate: { id: 'cand1', name: 'Bilal Hussain', dateOfBirth: null, cnic: null, contactPhone: '0333-4445566', contactEmail: null, resumeFileId: null },
      possibleDuplicate: null,
    });
    vi.mocked(api.createHiringApplication).mockResolvedValue({
      id: 'app1', candidateId: 'cand1', candidateName: 'Bilal Hussain', employeeType: 'GUARD',
      campusId: 'cam1', status: 'SUBMITTED', decisionNotes: null, reviewedById: null, createdStaffId: null,
    });

    const wrapper = mount(HiringCandidateIntakeView);
    await flushPromises();

    await wrapper.find('[data-testid="candidate-name"]').setValue('Bilal Hussain');
    await wrapper.find('[data-testid="candidate-phone"]').setValue('0333-4445566');
    await wrapper.find('[data-testid="candidate-submit"]').trigger('click');
    await flushPromises();

    expect(api.createHiringCandidate).toHaveBeenCalledWith('token-1', {
      name: 'Bilal Hussain', dateOfBirth: undefined, cnic: undefined,
      contactPhone: '0333-4445566', contactEmail: undefined, resumeFileId: undefined,
    });
    expect(wrapper.find('[data-testid="application-employee-type"]').exists()).toBe(true);

    await wrapper.find('[data-testid="application-employee-type"]').setValue('GUARD');
    await wrapper.find('[data-testid="application-campus"]').setValue('cam1');
    await wrapper.find('[data-testid="application-submit"]').trigger('click');
    await flushPromises();

    expect(api.createHiringApplication).toHaveBeenCalledWith('token-1', {
      candidateId: 'cand1', employeeType: 'GUARD', campusId: 'cam1',
    });
    expect(wrapper.text()).toContain('Application created.');
  });

  it('shows a duplicate-candidate banner without blocking submission', async () => {
    vi.mocked(api.createHiringCandidate).mockResolvedValue({
      candidate: { id: 'cand2', name: 'Sana Malik', dateOfBirth: null, cnic: null, contactPhone: '0333-7778899', contactEmail: null, resumeFileId: null },
      possibleDuplicate: { id: 'cand1', name: 'Sana Malik', dateOfBirth: null, cnic: null, contactPhone: '0333-7778899', contactEmail: null, resumeFileId: null },
    });

    const wrapper = mount(HiringCandidateIntakeView);
    await flushPromises();

    await wrapper.find('[data-testid="candidate-name"]').setValue('Sana Malik');
    await wrapper.find('[data-testid="candidate-phone"]').setValue('0333-7778899');
    await wrapper.find('[data-testid="candidate-submit"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="duplicate-banner"]').text()).toContain('Sana Malik');
  });
});