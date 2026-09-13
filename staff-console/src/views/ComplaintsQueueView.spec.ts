// staff-console/src/views/ComplaintsQueueView.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ComplaintsQueueView from './ComplaintsQueueView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listAdminStudents: vi.fn(),
    listComplaints: vi.fn(),
    createComplaint: vi.fn(),
    updateComplaintStatus: vi.fn(),
  },
}));

describe('ComplaintsQueueView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listAdminStudents).mockResolvedValue([
      { id: 's1', grNumber: 'GR-1001', name: 'Eshaal Sample', sectionName: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar', parentNames: ['Sample Parent'] },
    ]);
  });

  it('loads a student\'s complaints once selected, and raises a new one', async () => {
    vi.mocked(api.listComplaints).mockResolvedValue([
      { id: 'cm1', studentId: 's1', raisedById: 'u1', subject: 'Late pickup', description: 'Repeated late pickup', status: 'open', createdAt: '2026-06-01T00:00:00.000Z', updatedAt: '2026-06-01T00:00:00.000Z' },
    ]);
    vi.mocked(api.createComplaint).mockResolvedValue(undefined);

    const wrapper = mount(ComplaintsQueueView);
    await flushPromises();
    expect(api.listComplaints).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="select-student"]').setValue('s1');
    await flushPromises();

    expect(api.listComplaints).toHaveBeenCalledWith('token-1', 's1');
    expect(wrapper.text()).toContain('Late pickup');

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="add-subject"]').setValue('Uniform issue');
    await wrapper.find('[data-testid="add-description"]').setValue('Missing badge');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createComplaint).toHaveBeenCalledWith('token-1', {
      studentId: 's1',
      subject: 'Uniform issue',
      description: 'Missing badge',
    });
  });

  it('transitions a complaint\'s status and reloads the list', async () => {
    vi.mocked(api.listComplaints).mockResolvedValue([
      { id: 'cm1', studentId: 's1', raisedById: 'u1', subject: 'Late pickup', description: 'Repeated late pickup', status: 'open', createdAt: '2026-06-01T00:00:00.000Z', updatedAt: '2026-06-01T00:00:00.000Z' },
    ]);
    vi.mocked(api.updateComplaintStatus).mockResolvedValue(undefined);

    const wrapper = mount(ComplaintsQueueView);
    await flushPromises();
    await wrapper.find('[data-testid="select-student"]').setValue('s1');
    await flushPromises();

    await wrapper.find('[data-testid="status-cm1"]').setValue('in_progress');
    await flushPromises();

    expect(api.updateComplaintStatus).toHaveBeenCalledWith('token-1', 'cm1', 'in_progress');
    expect(api.listComplaints).toHaveBeenCalledTimes(2);
  });

  it('shows an error message when a call fails', async () => {
    vi.mocked(api.listComplaints).mockRejectedValue(new Error('Network down'));

    const wrapper = mount(ComplaintsQueueView);
    await flushPromises();
    await wrapper.find('[data-testid="select-student"]').setValue('s1');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Network down');
  });
});