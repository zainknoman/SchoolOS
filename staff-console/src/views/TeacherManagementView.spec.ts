// staff-console/src/views/TeacherManagementView.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TeacherManagementView from './TeacherManagementView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listAdminTeachers: vi.fn(),
    createTeacher: vi.fn(),
    updateTeacher: vi.fn(),
    deleteTeacher: vi.fn(),
  },
}));

describe('TeacherManagementView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listAdminTeachers).mockResolvedValue([
      { id: 't1', identifier: 'teacher-x@seeds.edu.pk', name: 'Existing Teacher' },
    ]);
  });

  it('lists teachers and creates a new one with an identifier and password', async () => {
    vi.mocked(api.createTeacher).mockResolvedValue(undefined);

    const wrapper = mount(TeacherManagementView);
    await flushPromises();

    expect(wrapper.text()).toContain('teacher-x@seeds.edu.pk');

    await wrapper.find('[data-testid="add-identifier"]').setValue('new-teacher@seeds.edu.pk');
    await wrapper.find('[data-testid="add-password"]').setValue('ChangeMe123!');
    await wrapper.find('[data-testid="add-name"]').setValue('New Teacher');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createTeacher).toHaveBeenCalledWith('token-1', {
      identifier: 'new-teacher@seeds.edu.pk', password: 'ChangeMe123!', name: 'New Teacher',
    });
  });

  it('edits the name without changing the password when the password field is left blank', async () => {
    vi.mocked(api.updateTeacher).mockResolvedValue(undefined);

    const wrapper = mount(TeacherManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="edit-t1"]').trigger('click');
    expect(wrapper.find('[data-testid="edit-identifier-t1"]').exists()).toBe(false);
    await wrapper.find('[data-testid="edit-name-t1"]').setValue('Renamed Teacher');
    await wrapper.find('[data-testid="save-t1"]').trigger('click');
    await flushPromises();

    expect(api.updateTeacher).toHaveBeenCalledWith('token-1', 't1', { name: 'Renamed Teacher' });
  });

  it('includes the new password in the update payload when the password field is filled in', async () => {
    vi.mocked(api.updateTeacher).mockResolvedValue(undefined);

    const wrapper = mount(TeacherManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="edit-t1"]').trigger('click');
    await wrapper.find('[data-testid="edit-password-t1"]').setValue('BrandNewPass1!');
    await wrapper.find('[data-testid="save-t1"]').trigger('click');
    await flushPromises();

    expect(api.updateTeacher).toHaveBeenCalledWith('token-1', 't1', {
      name: 'Existing Teacher', password: 'BrandNewPass1!',
    });
  });

  it('deletes a teacher after confirmation', async () => {
    vi.mocked(api.deleteTeacher).mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const wrapper = mount(TeacherManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-t1"]').trigger('click');
    await flushPromises();

    expect(api.deleteTeacher).toHaveBeenCalledWith('token-1', 't1');
  });

  it('shows the backend error when delete is blocked (e.g. the teacher has marked attendance)', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(api.deleteTeacher).mockRejectedValue(new Error('Cannot delete this Teacher: other records still reference it.'));

    const wrapper = mount(TeacherManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-t1"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Cannot delete this Teacher');
  });
});
