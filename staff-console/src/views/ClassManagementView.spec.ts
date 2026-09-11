// staff-console/src/views/ClassManagementView.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ClassManagementView from './ClassManagementView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';
import { useConfirm } from '../lib/useConfirm';

vi.mock('../lib/api', () => ({
  api: {
    listCampuses: vi.fn(),
    listAcademicSessions: vi.fn(),
    listClasses: vi.fn(),
    createClass: vi.fn(),
    updateClass: vi.fn(),
    deleteClass: vi.fn(),
  },
}));
vi.mock('../lib/useConfirm', () => ({
  useConfirm: vi.fn(),
}));

describe('ClassManagementView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listCampuses).mockResolvedValue([
      { id: 'c1', name: 'Gulistan-e-Jauhar', schoolId: 's1', schoolName: 'The Seeds School' },
    ]);
    vi.mocked(api.listAcademicSessions).mockResolvedValue([
      { id: 'as1', label: '2026-2027', startDate: '2026-08-01', endDate: '2027-06-30', isActive: true },
    ]);
    vi.mocked(api.listClasses).mockResolvedValue([
      { id: 'cl1', name: 'Grade 3', campusId: 'c1', campusName: 'Gulistan-e-Jauhar', academicSessionId: 'as1', academicSessionLabel: '2026-2027' },
    ]);
    vi.mocked(useConfirm).mockReturnValue({ confirm: vi.fn().mockResolvedValue(true) });
  });

  it('lists classes (with campus + session names) and creates a new one', async () => {
    vi.mocked(api.createClass).mockResolvedValue(undefined);

    const wrapper = mount(ClassManagementView);
    await flushPromises();

    expect(wrapper.text()).toContain('Grade 3');
    expect(wrapper.text()).toContain('Gulistan-e-Jauhar');
    expect(wrapper.text()).toContain('2026-2027');

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="add-campus"]').setValue('c1');
    await wrapper.find('[data-testid="add-session"]').setValue('as1');
    await wrapper.find('[data-testid="add-name"]').setValue('Grade 4');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createClass).toHaveBeenCalledWith('token-1', { campusId: 'c1', academicSessionId: 'as1', name: 'Grade 4' });
  });

  it('edits only the name (campus and session are not editable)', async () => {
    vi.mocked(api.updateClass).mockResolvedValue(undefined);

    const wrapper = mount(ClassManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="edit-cl1"]').trigger('click');
    expect(wrapper.find('[data-testid="edit-campus-cl1"]').exists()).toBe(false);
    await wrapper.find('[data-testid="edit-name-cl1"]').setValue('Grade 3 (Renamed)');
    await wrapper.find('[data-testid="save-cl1"]').trigger('click');
    await flushPromises();

    expect(api.updateClass).toHaveBeenCalledWith('token-1', 'cl1', { name: 'Grade 3 (Renamed)' });
  });

  it('deletes a class after confirmation, and does nothing if the confirmation is declined', async () => {
    vi.mocked(api.deleteClass).mockResolvedValue(undefined);
    const confirmFn = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.mocked(useConfirm).mockReturnValue({ confirm: confirmFn });

    const wrapper = mount(ClassManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-cl1"]').trigger('click');
    await flushPromises();
    expect(api.deleteClass).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="delete-cl1"]').trigger('click');
    await flushPromises();
    expect(api.deleteClass).toHaveBeenCalledWith('token-1', 'cl1');
    expect(confirmFn).toHaveBeenCalledWith({
      title: 'Delete this class?',
      message: 'This cannot be undone.',
      danger: true,
    });
  });

  it('shows the backend error when delete is blocked by dependent records', async () => {
    vi.mocked(api.deleteClass).mockRejectedValue(new Error('Cannot delete this Class: other records still reference it.'));

    const wrapper = mount(ClassManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-cl1"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Cannot delete this Class');
  });
});
