import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import CampusManagementView from './CampusManagementView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';
import { useConfirm } from '../lib/useConfirm';

vi.mock('../lib/api', () => ({
  api: {
    listSchools: vi.fn(),
    listCampuses: vi.fn(),
    createCampus: vi.fn(),
    updateCampus: vi.fn(),
    deleteCampus: vi.fn(),
  },
}));
vi.mock('../lib/useConfirm', () => ({
  useConfirm: vi.fn(),
}));

describe('CampusManagementView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listSchools).mockResolvedValue([
      { id: 's1', name: 'The Seeds School', address: null, phone: null, email: null, campusCount: 1, studentCount: 0, staffCount: 0 },
    ]);
    vi.mocked(api.listCampuses).mockResolvedValue([
      {
        id: 'c1', name: 'Gulistan-e-Jauhar', schoolId: 's1', schoolName: 'The Seeds School',
        address: '10 Campus Rd', phone: '021-333', email: 'gej@seeds.edu.pk', studentCount: 60, staffCount: 8,
      },
    ]);
    vi.mocked(useConfirm).mockReturnValue({ confirm: vi.fn().mockResolvedValue(true) });
  });

  it('lists campuses (with school name, address/contact and live stats) and creates a new one under a chosen school', async () => {
    vi.mocked(api.createCampus).mockResolvedValue(undefined);

    const wrapper = mount(CampusManagementView);
    await flushPromises();

    expect(wrapper.text()).toContain('Gulistan-e-Jauhar');
    expect(wrapper.text()).toContain('The Seeds School');
    expect(wrapper.text()).toContain('10 Campus Rd');
    expect(wrapper.text()).toContain('60');
    expect(wrapper.text()).toContain('8');

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="add-school"]').setValue('s1');
    await wrapper.find('[data-testid="add-name"]').setValue('Gulshan-e-Iqbal');
    await wrapper.find('[data-testid="add-address"]').setValue('20 New Rd');
    await wrapper.find('[data-testid="add-phone"]').setValue('021-444');
    await wrapper.find('[data-testid="add-email"]').setValue('gulshan@seeds.edu.pk');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createCampus).toHaveBeenCalledWith('token-1', {
      schoolId: 's1', name: 'Gulshan-e-Iqbal', address: '20 New Rd', phone: '021-444', email: 'gulshan@seeds.edu.pk',
    });
  });

  it('edits the name and contact fields (school is not editable)', async () => {
    vi.mocked(api.updateCampus).mockResolvedValue(undefined);

    const wrapper = mount(CampusManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="edit-c1"]').trigger('click');
    expect(wrapper.find('[data-testid="edit-school-c1"]').exists()).toBe(false);
    await wrapper.find('[data-testid="edit-name-c1"]').setValue('Gulistan-e-Jauhar (Main)');
    await wrapper.find('[data-testid="save-c1"]').trigger('click');
    await flushPromises();

    expect(api.updateCampus).toHaveBeenCalledWith('token-1', 'c1', {
      name: 'Gulistan-e-Jauhar (Main)', address: '10 Campus Rd', phone: '021-333', email: 'gej@seeds.edu.pk',
    });
  });

  it('deletes a campus after confirmation, and does nothing if the confirmation is declined', async () => {
    vi.mocked(api.deleteCampus).mockResolvedValue(undefined);
    const confirmFn = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.mocked(useConfirm).mockReturnValue({ confirm: confirmFn });

    const wrapper = mount(CampusManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-c1"]').trigger('click');
    await flushPromises();
    expect(api.deleteCampus).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="delete-c1"]').trigger('click');
    await flushPromises();
    expect(api.deleteCampus).toHaveBeenCalledWith('token-1', 'c1');
    expect(confirmFn).toHaveBeenCalledWith({
      title: 'Delete this campus?',
      message: 'This cannot be undone.',
      danger: true,
    });
  });

  it('shows the backend error when delete is blocked by dependent records', async () => {
    vi.mocked(api.deleteCampus).mockRejectedValue(new Error('Cannot delete this Campus: other records still reference it.'));

    const wrapper = mount(CampusManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-c1"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Cannot delete this Campus');
  });
});
