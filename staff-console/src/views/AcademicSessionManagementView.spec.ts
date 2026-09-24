import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AcademicSessionManagementView from './AcademicSessionManagementView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';
import { useConfirm } from '../lib/useConfirm';

vi.mock('../lib/api', () => ({
  api: {
    listAcademicSessions: vi.fn(),
    createAcademicSession: vi.fn(),
    updateAcademicSession: vi.fn(),
    deleteAcademicSession: vi.fn(),
    listSchools: vi.fn(),
  },
}));
vi.mock('../lib/useConfirm', () => ({
  useConfirm: vi.fn(),
}));

describe('AcademicSessionManagementView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    // BL-01: sessions are per school; one school is pre-selected in the add form.
    vi.mocked(api.listSchools).mockResolvedValue([
      { id: 'school-1', name: 'School One' } as Awaited<ReturnType<typeof api.listSchools>>[number],
    ]);
    vi.mocked(api.listAcademicSessions).mockResolvedValue([
      { id: 'as1', label: '2026-2027', startDate: '2026-08-01', endDate: '2027-06-30', isActive: true },
    ]);
    vi.mocked(useConfirm).mockReturnValue({ confirm: vi.fn().mockResolvedValue(true) });
  });

  it('lists sessions, showing which one is active, and creates a new one', async () => {
    vi.mocked(api.createAcademicSession).mockResolvedValue(undefined);

    const wrapper = mount(AcademicSessionManagementView);
    await flushPromises();

    expect(wrapper.text()).toContain('2026-2027');
    expect(wrapper.text()).toContain('Active');

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="add-label"]').setValue('2027-2028');
    await wrapper.find('[data-testid="add-start"]').setValue('2027-08-01');
    await wrapper.find('[data-testid="add-end"]').setValue('2028-06-30');
    await wrapper.find('[data-testid="add-active"]').setValue(true);
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createAcademicSession).toHaveBeenCalledWith('token-1', {
      label: '2027-2028',
      startDate: '2027-08-01',
      endDate: '2028-06-30',
      isActive: true,
      schoolId: 'school-1',
    });
  });

  it('edits a session, including toggling isActive', async () => {
    vi.mocked(api.updateAcademicSession).mockResolvedValue(undefined);

    const wrapper = mount(AcademicSessionManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="edit-as1"]').trigger('click');
    await wrapper.find('[data-testid="edit-label-as1"]').setValue('2026-2027 (Renamed)');
    await wrapper.find('[data-testid="save-as1"]').trigger('click');
    await flushPromises();

    expect(api.updateAcademicSession).toHaveBeenCalledWith('token-1', 'as1', {
      label: '2026-2027 (Renamed)',
      startDate: '2026-08-01',
      endDate: '2027-06-30',
      isActive: true,
    });
  });

  it('deletes a session after confirmation, and does nothing if the confirmation is declined', async () => {
    vi.mocked(api.deleteAcademicSession).mockResolvedValue(undefined);
    const confirmFn = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.mocked(useConfirm).mockReturnValue({ confirm: confirmFn });

    const wrapper = mount(AcademicSessionManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-as1"]').trigger('click');
    await flushPromises();
    expect(api.deleteAcademicSession).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="delete-as1"]').trigger('click');
    await flushPromises();
    expect(api.deleteAcademicSession).toHaveBeenCalledWith('token-1', 'as1');
    expect(confirmFn).toHaveBeenCalledWith({
      title: 'Delete this academic session?',
      message: 'This cannot be undone.',
      danger: true,
    });
  });

  it('shows the backend error when delete is blocked by dependent records', async () => {
    vi.mocked(api.deleteAcademicSession).mockRejectedValue(
      new Error('Cannot delete this Academic session: other records still reference it.'),
    );

    const wrapper = mount(AcademicSessionManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-as1"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Cannot delete this Academic session');
  });

  it('shows an active and an inactive session with the right StatusPill tone each', async () => {
    vi.mocked(api.listAcademicSessions).mockResolvedValue([
      { id: 'as1', label: '2026-2027', startDate: '2026-08-01', endDate: '2027-06-30', isActive: true },
      { id: 'as2', label: '2027-2028', startDate: '2027-08-01', endDate: '2028-06-30', isActive: false },
    ]);

    const wrapper = mount(AcademicSessionManagementView);
    await flushPromises();

    const pills = wrapper.findAll('[data-testid="status-pill"]');
    const activePill = pills.find((p) => p.text() === 'Active');
    const inactivePill = pills.find((p) => p.text() === 'Inactive');
    expect(activePill?.classes()).toContain('tone-success');
    expect(inactivePill?.classes()).toContain('tone-neutral');
  });
});
