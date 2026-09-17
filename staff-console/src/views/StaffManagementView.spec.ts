import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import StaffManagementView from './StaffManagementView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/admin/staff', name: 'admin-staff', component: StaffManagementView }],
  });
  await router.push('/admin/staff');
  await router.isReady();
  return mount(StaffManagementView, { global: { plugins: [router] } });
}

vi.mock('../lib/api', () => ({
  api: { listAdminStaff: vi.fn(), listCampuses: vi.fn(), createStaff: vi.fn() },
}));

describe('StaffManagementView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listAdminStaff).mockResolvedValue([
      { id: 'st1', name: 'Nazir Ahmed', employeeType: 'JANITORIAL', employmentStatus: 'ACTIVE', campusName: 'PECHS Campus' },
    ]);
    vi.mocked(api.listCampuses).mockResolvedValue([
      { id: 'cam1', name: 'PECHS Campus', schoolId: 'sch1', schoolName: 'Beacon House', address: null, phone: null, email: null, studentCount: 0, staffCount: 0 },
    ]);
  });

  it('lists staff with their employee type and campus', async () => {
    const wrapper = await mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Nazir Ahmed');
    expect(wrapper.text()).toContain('PECHS Campus');
  });

  it("links each row to that staff member's profile page", async () => {
    const wrapper = await mountView();
    await flushPromises();

    const link = wrapper.find('[data-testid="view-profile-st1"]');
    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toBe('/admin/staff/st1');
  });

  it('reloads filtered by employee type when the filter changes', async () => {
    const wrapper = await mountView();
    await flushPromises();
    vi.mocked(api.listAdminStaff).mockResolvedValue([]);

    await wrapper.find('[data-testid="filter-employee-type"]').setValue('GUARD');
    await flushPromises();

    expect(api.listAdminStaff).toHaveBeenCalledWith('token-1', 'GUARD');
  });

  it('opens an Add New modal and creates a non-teacher staff member with no login fields', async () => {
    vi.mocked(api.createStaff).mockResolvedValue({ id: 'st2', name: 'Bilal Raza' });
    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="add-name"]').setValue('Bilal Raza');
    await wrapper.find('[data-testid="add-employee-type"]').setValue('GUARD');
    await wrapper.find('[data-testid="add-campus"]').setValue('cam1');
    expect(wrapper.find('[data-testid="add-login-identifier"]').exists()).toBe(false);

    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createStaff).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({ name: 'Bilal Raza', employeeType: 'GUARD', campusId: 'cam1' }),
    );
    expect(vi.mocked(api.createStaff).mock.calls[0]![1]).not.toHaveProperty('login');
  });

  it('requires login credentials and includes them in the payload when Employee Type is Teacher', async () => {
    vi.mocked(api.createStaff).mockResolvedValue({ id: 'st3', name: 'Ayesha Khan' });
    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="add-name"]').setValue('Ayesha Khan');
    await wrapper.find('[data-testid="add-employee-type"]').setValue('TEACHER');
    await wrapper.find('[data-testid="add-campus"]').setValue('cam1');

    expect(wrapper.find('[data-testid="add-login-identifier"]').exists()).toBe(true);

    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();
    expect(api.createStaff).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="add-login-identifier"]').setValue('ayesha.khan');
    await wrapper.find('[data-testid="add-login-password"]').setValue('a-strong-password');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createStaff).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({
        name: 'Ayesha Khan',
        employeeType: 'TEACHER',
        campusId: 'cam1',
        login: { identifier: 'ayesha.khan', password: 'a-strong-password' },
      }),
    );
  });
});