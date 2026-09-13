import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import LeaveManagementView from './LeaveManagementView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';
import { useConfirm } from '../lib/useConfirm';

vi.mock('../lib/api', () => ({
  api: {
    listLeaveRequests: vi.fn(),
    approveLeaveRequest: vi.fn(),
    rejectLeaveRequest: vi.fn(),
  },
}));
vi.mock('../lib/useConfirm', () => ({
  useConfirm: vi.fn(),
}));

describe('LeaveManagementView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    vi.mocked(api.listLeaveRequests).mockReset();
    vi.mocked(api.approveLeaveRequest).mockReset();
    vi.mocked(api.rejectLeaveRequest).mockReset();
    vi.mocked(useConfirm).mockReturnValue({ confirm: vi.fn().mockResolvedValue(true) });
  });

  it('lists pending requests and approves one', async () => {
    vi.mocked(api.listLeaveRequests).mockResolvedValueOnce([
      {
        id: 'lr-1',
        studentId: 's1',
        studentName: 'Eshaal Sample',
        startDate: '2026-09-05',
        endDate: '2026-09-06',
        reason: 'Family trip',
        status: 'pending',
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    ]);
    vi.mocked(api.approveLeaveRequest).mockResolvedValue(undefined);
    vi.mocked(api.listLeaveRequests).mockResolvedValueOnce([]);

    const wrapper = mount(LeaveManagementView);
    await flushPromises();

    expect(wrapper.text()).toContain('Eshaal Sample');
    expect(wrapper.text()).toContain('Family trip');

    await wrapper.find('[data-testid="approve-lr-1"]').trigger('click');
    await flushPromises();

    expect(api.approveLeaveRequest).toHaveBeenCalledWith('token-1', 'lr-1');
  });

  it('rejects a request after confirmation, and does nothing if declined', async () => {
    vi.mocked(api.listLeaveRequests).mockResolvedValueOnce([
      {
        id: 'lr-2',
        studentId: 's2',
        studentName: 'Ibrahim Sample',
        startDate: '2026-09-10',
        endDate: '2026-09-10',
        reason: 'Doctor appointment',
        status: 'pending',
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    ]);
    vi.mocked(api.rejectLeaveRequest).mockResolvedValue(undefined);
    vi.mocked(api.listLeaveRequests).mockResolvedValueOnce([]);
    const confirmFn = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.mocked(useConfirm).mockReturnValue({ confirm: confirmFn });

    const wrapper = mount(LeaveManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="reject-lr-2"]').trigger('click');
    await flushPromises();
    expect(api.rejectLeaveRequest).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="reject-lr-2"]').trigger('click');
    await flushPromises();

    expect(api.rejectLeaveRequest).toHaveBeenCalledWith('token-1', 'lr-2');
    expect(confirmFn).toHaveBeenCalledWith({
      title: 'Reject this leave request?',
      message: 'This cannot be undone.',
      danger: true,
    });
  });

  it('shows an error message when the list fails to load', async () => {
    vi.mocked(api.listLeaveRequests).mockRejectedValue(new Error('Network down'));

    const wrapper = mount(LeaveManagementView);
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Network down');
  });

  it('renders each leave-request status through StatusPill with the right tone', async () => {
    vi.mocked(api.listLeaveRequests).mockResolvedValue([
      { id: 'lr1', studentId: 's1', studentName: 'Eshaal', startDate: '2026-09-01', endDate: '2026-09-02', reason: 'Trip', status: 'pending', createdAt: '2026-08-30T00:00:00.000Z' },
    ]);

    const wrapper = mount(LeaveManagementView);
    await flushPromises();

    const pill = wrapper.find('[data-testid="status-pill"]');
    expect(pill.classes()).toContain('tone-warning');
    expect(pill.text()).toBe('pending');
  });
});
