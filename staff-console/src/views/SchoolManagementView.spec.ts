import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SchoolManagementView from './SchoolManagementView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';
import { useConfirm } from '../lib/useConfirm';

vi.mock('../lib/api', () => ({
  api: {
    listSchools: vi.fn(),
    createSchool: vi.fn(),
    updateSchool: vi.fn(),
    deleteSchool: vi.fn(),
  },
}));
vi.mock('../lib/useConfirm', () => ({
  useConfirm: vi.fn(),
}));

describe('SchoolManagementView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listSchools).mockResolvedValue([
      {
        id: 's1', name: 'The Seeds School', address: '1 Main Rd', phone: '021-111', email: 'info@seeds.edu.pk',
        campusCount: 2, studentCount: 120, staffCount: 15,
      },
    ]);
    vi.mocked(useConfirm).mockReturnValue({ confirm: vi.fn().mockResolvedValue(true) });
  });

  it('lists schools with address/contact details and live stats', async () => {
    const wrapper = mount(SchoolManagementView);
    await flushPromises();

    expect(wrapper.text()).toContain('The Seeds School');
    expect(wrapper.text()).toContain('1 Main Rd');
    expect(wrapper.text()).toContain('021-111');
    expect(wrapper.text()).toContain('120');
    expect(wrapper.text()).toContain('15');
  });

  it('creates a new school with address/phone/email', async () => {
    vi.mocked(api.createSchool).mockResolvedValue(undefined);

    const wrapper = mount(SchoolManagementView);
    await flushPromises();

    expect(wrapper.find('[data-testid="add-name"]').exists()).toBe(false);

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="add-name"]').setValue('Second School');
    await wrapper.find('[data-testid="add-address"]').setValue('2 Second Rd');
    await wrapper.find('[data-testid="add-phone"]').setValue('021-222');
    await wrapper.find('[data-testid="add-email"]').setValue('second@seeds.edu.pk');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createSchool).toHaveBeenCalledWith('token-1', {
      name: 'Second School', address: '2 Second Rd', phone: '021-222', email: 'second@seeds.edu.pk',
    });
    expect(api.listSchools).toHaveBeenCalledTimes(2);
    expect(wrapper.find('[data-testid="add-name"]').exists()).toBe(false);
  });

  it('edits a school in place', async () => {
    vi.mocked(api.updateSchool).mockResolvedValue(undefined);

    const wrapper = mount(SchoolManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="edit-s1"]').trigger('click');
    await wrapper.find('[data-testid="edit-name-s1"]').setValue('Renamed School');
    await wrapper.find('[data-testid="save-s1"]').trigger('click');
    await flushPromises();

    expect(api.updateSchool).toHaveBeenCalledWith('token-1', 's1', {
      name: 'Renamed School', address: '1 Main Rd', phone: '021-111', email: 'info@seeds.edu.pk',
    });
  });

  it('deletes a school after confirmation, and does nothing if the confirmation is declined', async () => {
    vi.mocked(api.deleteSchool).mockResolvedValue(undefined);
    const confirmFn = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.mocked(useConfirm).mockReturnValue({ confirm: confirmFn });

    const wrapper = mount(SchoolManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-s1"]').trigger('click');
    await flushPromises();
    expect(api.deleteSchool).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="delete-s1"]').trigger('click');
    await flushPromises();
    expect(api.deleteSchool).toHaveBeenCalledWith('token-1', 's1');
    expect(confirmFn).toHaveBeenCalledWith({
      title: 'Delete this school?',
      message: 'This cannot be undone.',
      danger: true,
    });
  });

  it('shows the backend error when delete is blocked by dependent records', async () => {
    vi.mocked(api.deleteSchool).mockRejectedValue(new Error('Cannot delete this School: other records still reference it.'));

    const wrapper = mount(SchoolManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-s1"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Cannot delete this School');
  });
});
