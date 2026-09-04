import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SchoolManagementView from './SchoolManagementView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listSchools: vi.fn(),
    createSchool: vi.fn(),
    updateSchool: vi.fn(),
    deleteSchool: vi.fn(),
  },
}));

describe('SchoolManagementView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listSchools).mockResolvedValue([{ id: 's1', name: 'The Seeds School' }]);
  });

  it('lists schools and creates a new one', async () => {
    vi.mocked(api.createSchool).mockResolvedValue(undefined);

    const wrapper = mount(SchoolManagementView);
    await flushPromises();

    expect(wrapper.text()).toContain('The Seeds School');

    await wrapper.find('[data-testid="add-name"]').setValue('Second School');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createSchool).toHaveBeenCalledWith('token-1', { name: 'Second School' });
    expect(api.listSchools).toHaveBeenCalledTimes(2);
  });

  it('edits a school in place', async () => {
    vi.mocked(api.updateSchool).mockResolvedValue(undefined);

    const wrapper = mount(SchoolManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="edit-s1"]').trigger('click');
    await wrapper.find('[data-testid="edit-name-s1"]').setValue('Renamed School');
    await wrapper.find('[data-testid="save-s1"]').trigger('click');
    await flushPromises();

    expect(api.updateSchool).toHaveBeenCalledWith('token-1', 's1', { name: 'Renamed School' });
  });

  it('deletes a school after confirmation, and does nothing if the confirmation is declined', async () => {
    vi.mocked(api.deleteSchool).mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);

    const wrapper = mount(SchoolManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-s1"]').trigger('click');
    await flushPromises();
    expect(api.deleteSchool).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="delete-s1"]').trigger('click');
    await flushPromises();
    expect(api.deleteSchool).toHaveBeenCalledWith('token-1', 's1');

    confirmSpy.mockRestore();
  });

  it('shows the backend error when delete is blocked by dependent records', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(api.deleteSchool).mockRejectedValue(new Error('Cannot delete this School: other records still reference it.'));

    const wrapper = mount(SchoolManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-s1"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Cannot delete this School');
  });
});
