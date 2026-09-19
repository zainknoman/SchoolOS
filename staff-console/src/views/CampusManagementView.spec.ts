import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import CampusManagementView from './CampusManagementView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';
import { useConfirm } from '../lib/useConfirm';

const push = vi.hoisted(() => vi.fn());
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRouter: () => ({ push }),
}));
vi.mock('../lib/api', () => ({ api: { listCampuses: vi.fn(), deleteCampus: vi.fn() } }));
vi.mock('../lib/useConfirm', () => ({ useConfirm: vi.fn() }));

const CAMPUS = {
  id: 'c1', name: 'Gulistan-e-Jauhar', schoolId: 's1', schoolName: 'The SchoolOS School', code: 'GEJ', campusType: 'Main',
  logoFileId: null, principalName: null, principalPhone: null, principalEmail: null, openingDate: null, capacity: 600,
  latitude: null, longitude: null, status: 'ACTIVE' as const, departments: [], alternatePhone: null, addressId: null,
  address: '10 Campus Rd', phone: '021-333', email: null, studentCount: 60, staffCount: 8,
};

const mountView = () => mount(CampusManagementView);

describe('CampusManagementView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useAuthStore().accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    push.mockReset();
    vi.mocked(api.listCampuses).mockResolvedValue([CAMPUS]);
    vi.mocked(useConfirm).mockReturnValue({ confirm: vi.fn().mockResolvedValue(true) });
  });

  it('lists campuses with code/status/type columns plus school, address/contact details and live stats', async () => {
    const wrapper = mountView();
    await flushPromises();

    for (const text of ['Gulistan-e-Jauhar', 'GEJ', 'Active', 'Main', 'The SchoolOS School', '10 Campus Rd', '021-333', '60', '8']) {
      expect(wrapper.text()).toContain(text);
    }
  });

  it('has no add/edit popup — Add New, View and Edit navigate to the profile screen', async () => {
    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    expect(push).toHaveBeenLastCalledWith('/admin/campuses/new');

    await wrapper.find('[data-testid="view-profile-c1"]').trigger('click');
    expect(push).toHaveBeenLastCalledWith('/admin/campuses/c1');

    await wrapper.find('[data-testid="edit-c1"]').trigger('click');
    expect(push).toHaveBeenLastCalledWith({ path: '/admin/campuses/c1', query: { edit: '1' } });

    expect(wrapper.find('[data-testid="field-name"]').exists()).toBe(false);
  });

  it('renders View, Edit and Delete as the same kind of button', async () => {
    const wrapper = mountView();
    await flushPromises();

    for (const id of ['view-profile-c1', 'edit-c1', 'delete-c1']) {
      expect(wrapper.find(`[data-testid="${id}"]`).element.tagName).toBe('BUTTON');
    }
  });

  it('deletes a campus after confirmation, and does nothing if the confirmation is declined', async () => {
    vi.mocked(api.deleteCampus).mockResolvedValue(undefined);
    const confirmFn = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.mocked(useConfirm).mockReturnValue({ confirm: confirmFn });

    const wrapper = mountView();
    await flushPromises();

    await wrapper.find('[data-testid="delete-c1"]').trigger('click');
    await flushPromises();
    expect(api.deleteCampus).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="delete-c1"]').trigger('click');
    await flushPromises();
    expect(api.deleteCampus).toHaveBeenCalledWith('token-1', 'c1');
  });

  it('shows the backend error when delete is blocked by dependent records', async () => {
    vi.mocked(api.deleteCampus).mockRejectedValue(new Error('Cannot delete this Campus: other records still reference it.'));

    const wrapper = mountView();
    await flushPromises();
    await wrapper.find('[data-testid="delete-c1"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Cannot delete this Campus');
  });
});
