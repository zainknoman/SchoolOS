import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SchoolManagementView from './SchoolManagementView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';
import { useConfirm } from '../lib/useConfirm';

const push = vi.hoisted(() => vi.fn());
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRouter: () => ({ push }),
}));
vi.mock('../lib/api', () => ({ api: { listSchools: vi.fn(), deleteSchool: vi.fn() } }));
vi.mock('../lib/useConfirm', () => ({ useConfirm: vi.fn() }));

const SCHOOL = {
  id: 's1', name: 'The SchoolOS School', code: 'TSS', registrationNumber: 'REG-001', website: null, logoFileId: null,
  principalName: null, principalPhone: null, principalEmail: null, establishedDate: null, schoolType: 'K-12',
  educationBoard: 'Cambridge', status: 'ACTIVE' as const, timezone: null, currency: null, alternatePhone: null,
  addressId: null, address: '1 Main Rd', phone: '021-111', email: null, campusCount: 2, studentCount: 120, staffCount: 15,
};

const mountView = () => mount(SchoolManagementView);

describe('SchoolManagementView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useAuthStore().accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    push.mockReset();
    vi.mocked(api.listSchools).mockResolvedValue([SCHOOL]);
    vi.mocked(useConfirm).mockReturnValue({ confirm: vi.fn().mockResolvedValue(true) });
  });

  it('lists schools with code/status columns plus address/contact details and live stats', async () => {
    const wrapper = mountView();
    await flushPromises();

    for (const text of ['The SchoolOS School', 'TSS', 'Active', '1 Main Rd', '021-111', '120', '15']) {
      expect(wrapper.text()).toContain(text);
    }
  });

  it('has no add/edit popup — Add New, View and Edit navigate to the profile screen', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    expect(push).toHaveBeenLastCalledWith('/admin/schools/new');

    await wrapper.find('[data-testid="view-profile-s1"]').trigger('click');
    expect(push).toHaveBeenLastCalledWith('/admin/schools/s1');

    await wrapper.find('[data-testid="edit-s1"]').trigger('click');
    expect(push).toHaveBeenLastCalledWith({ path: '/admin/schools/s1', query: { edit: '1' } });

    expect(wrapper.find('[data-testid="field-name"]').exists()).toBe(false);
  });

  it('renders View, Edit and Delete as the same kind of button', async () => {
    const wrapper = mountView();
    await flushPromises();

    for (const id of ['view-profile-s1', 'edit-s1', 'delete-s1']) {
      expect(wrapper.find(`[data-testid="${id}"]`).element.tagName).toBe('BUTTON');
    }
  });

  it('deletes a school after confirmation, and does nothing if the confirmation is declined', async () => {
    vi.mocked(api.deleteSchool).mockResolvedValue(undefined);
    const confirmFn = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.mocked(useConfirm).mockReturnValue({ confirm: confirmFn });

    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('[data-testid="delete-s1"]').trigger('click');
    await flushPromises();
    expect(api.deleteSchool).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="delete-s1"]').trigger('click');
    await flushPromises();
    expect(api.deleteSchool).toHaveBeenCalledWith('token-1', 's1');
    expect(confirmFn).toHaveBeenCalledWith({ title: 'Delete this school?', message: 'This cannot be undone.', danger: true });
  });

  it('shows the backend error when delete is blocked by dependent records', async () => {
    vi.mocked(api.deleteSchool).mockRejectedValue(new Error('Cannot delete this School: other records still reference it.'));

    const wrapper = mountView();
    await flushPromises();
    await wrapper.find('[data-testid="delete-s1"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Cannot delete this School');
  });
});
