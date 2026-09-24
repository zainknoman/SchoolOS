import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SubjectsView from './SubjectsView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listSubjects: vi.fn(),
    listSchools: vi.fn(),
    createSubject: vi.fn(),
    updateSubject: vi.fn(),
    deleteSubject: vi.fn(),
  },
}));
const confirmMock = vi.fn();
vi.mock('../lib/useConfirm', () => ({ useConfirm: () => ({ confirm: confirmMock }) }));

describe('SubjectsView (BL-02)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    auth.role = 'SCHOOL_ADMIN';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listSubjects).mockResolvedValue([
      { id: 's1', name: 'Urdu', schoolId: 'school-a', isActive: true },
      { id: 's2', name: 'Calligraphy', schoolId: 'school-a', isActive: false },
    ]);
  });

  it('lists active and inactive subjects of the school', async () => {
    const wrapper = mount(SubjectsView);
    await flushPromises();
    expect(api.listSubjects).toHaveBeenCalledWith('token-1', { includeInactive: true });
    expect(wrapper.text()).toContain('Urdu');
    expect(wrapper.text()).toContain('Inactive');
  });

  it('adds a subject for the own school (no school picker for a school admin)', async () => {
    vi.mocked(api.createSubject).mockResolvedValue({ id: 's3', name: 'Physics' });
    const wrapper = mount(SubjectsView);
    await flushPromises();
    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="add-school"]').exists()).toBe(false);
    await wrapper.find('[data-testid="add-name"]').setValue('Physics');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();
    expect(api.createSubject).toHaveBeenCalledWith('token-1', { name: 'Physics' });
  });

  it('deactivates and reactivates', async () => {
    vi.mocked(api.updateSubject).mockResolvedValue({ id: 's1', name: 'Urdu' });
    const wrapper = mount(SubjectsView);
    await flushPromises();
    await wrapper.find('[data-testid="toggle-s1"]').trigger('click');
    await flushPromises();
    expect(api.updateSubject).toHaveBeenCalledWith('token-1', 's1', { isActive: false });
    await wrapper.find('[data-testid="toggle-s2"]').trigger('click');
    await flushPromises();
    expect(api.updateSubject).toHaveBeenCalledWith('token-1', 's2', { isActive: true });
  });

  it('shows the server message when deleting a subject in use', async () => {
    confirmMock.mockResolvedValue(true);
    vi.mocked(api.deleteSubject).mockRejectedValue(new Error('This subject is in use — deactivate it instead.'));
    const wrapper = mount(SubjectsView);
    await flushPromises();
    await wrapper.find('[data-testid="delete-s1"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="subjects-error"]').text()).toContain('deactivate it instead');
  });
});
