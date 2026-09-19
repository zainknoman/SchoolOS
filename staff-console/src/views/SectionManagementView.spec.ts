// staff-console/src/views/SectionManagementView.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SectionManagementView from './SectionManagementView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';
import { useConfirm } from '../lib/useConfirm';

vi.mock('../lib/api', () => ({
  api: {
    listClasses: vi.fn(),
    listTeachers: vi.fn(),
    listSections: vi.fn(),
    createSection: vi.fn(),
    updateSection: vi.fn(),
    deleteSection: vi.fn(),
  },
}));
vi.mock('../lib/useConfirm', () => ({
  useConfirm: vi.fn(),
}));

describe('SectionManagementView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listClasses).mockResolvedValue([
      { id: 'cl1', name: 'Grade 3', campusId: 'c1', campusName: 'Gulistan-e-Jauhar', academicSessionId: 'as1', academicSessionLabel: '2026-2027' },
    ]);
    vi.mocked(api.listTeachers).mockResolvedValue([{ id: 't1', name: 'Ms. Ayesha' }]);
    vi.mocked(api.listSections).mockResolvedValue([
      { id: 'sec1', name: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar', classId: 'cl1', classTeacherId: 't1', classTeacherName: 'Ms. Ayesha' },
    ]);
    vi.mocked(useConfirm).mockReturnValue({ confirm: vi.fn().mockResolvedValue(true) });
  });

  it('lists sections (with class teacher) and creates a new one', async () => {
    vi.mocked(api.createSection).mockResolvedValue(undefined);

    const wrapper = mount(SectionManagementView);
    await flushPromises();

    expect(wrapper.text()).toContain('3A');
    expect(wrapper.text()).toContain('Ms. Ayesha');

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="add-class"]').setValue('cl1');
    await flushPromises();
    await wrapper.find('[data-testid="add-name"]').setValue('3B');
    await wrapper.find('[data-testid="add-teacher"]').setValue('t1');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createSection).toHaveBeenCalledWith('token-1', { classId: 'cl1', name: '3B', classTeacherId: 't1' });
  });

  it('loads only the selected class campus teachers and clears the chosen teacher when the class changes', async () => {
    const wrapper = mount(SectionManagementView);
    await flushPromises();
    await wrapper.find('[data-testid="open-add-form"]').trigger('click');

    await wrapper.find('[data-testid="add-class"]').setValue('cl1');
    await flushPromises();

    expect(api.listTeachers).toHaveBeenCalledWith('token-1', 'c1');
  });

  it('offers no teachers until a class is chosen', async () => {
    const wrapper = mount(SectionManagementView);
    await flushPromises();
    await wrapper.find('[data-testid="open-add-form"]').trigger('click');

    expect(api.listTeachers).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="add-teacher"]').text()).toContain('Choose a class first');
  });

  it('creates a section with no class teacher when none is chosen', async () => {
    vi.mocked(api.createSection).mockResolvedValue(undefined);

    const wrapper = mount(SectionManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="add-class"]').setValue('cl1');
    await wrapper.find('[data-testid="add-name"]').setValue('3B');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createSection).toHaveBeenCalledWith('token-1', { classId: 'cl1', name: '3B', classTeacherId: undefined });
  });

  it('edits the name and reassigns the class teacher (class is not editable)', async () => {
    vi.mocked(api.updateSection).mockResolvedValue(undefined);

    const wrapper = mount(SectionManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="edit-sec1"]').trigger('click');
    expect(wrapper.find('[data-testid="edit-class-sec1"]').exists()).toBe(false);
    await wrapper.find('[data-testid="edit-name-sec1"]').setValue('3A (Renamed)');
    await wrapper.find('[data-testid="save-sec1"]').trigger('click');
    await flushPromises();

    expect(api.updateSection).toHaveBeenCalledWith('token-1', 'sec1', { name: '3A (Renamed)', classTeacherId: 't1' });
  });

  it('clears an already-assigned class teacher by sending an explicit null', async () => {
    vi.mocked(api.updateSection).mockResolvedValue(undefined);

    const wrapper = mount(SectionManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="edit-sec1"]').trigger('click');
    await wrapper.find('[data-testid="edit-teacher-sec1"]').setValue('');
    await wrapper.find('[data-testid="save-sec1"]').trigger('click');
    await flushPromises();

    expect(api.updateSection).toHaveBeenCalledWith('token-1', 'sec1', { name: '3A', classTeacherId: null });
  });

  it('deletes a section after confirmation, and does nothing if the confirmation is declined', async () => {
    vi.mocked(api.deleteSection).mockResolvedValue(undefined);
    const confirmFn = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.mocked(useConfirm).mockReturnValue({ confirm: confirmFn });

    const wrapper = mount(SectionManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-sec1"]').trigger('click');
    await flushPromises();
    expect(api.deleteSection).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="delete-sec1"]').trigger('click');
    await flushPromises();
    expect(api.deleteSection).toHaveBeenCalledWith('token-1', 'sec1');
    expect(confirmFn).toHaveBeenCalledWith({
      title: 'Delete this section?',
      message: 'This cannot be undone.',
      danger: true,
    });
  });

  it('shows the backend error when delete is blocked by real Timetable/Diary/Circular history', async () => {
    vi.mocked(api.deleteSection).mockRejectedValue(new Error('Cannot delete this Section: other records still reference it.'));

    const wrapper = mount(SectionManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-sec1"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Cannot delete this Section');
  });
});
