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
  api: { listAdminStaff: vi.fn() },
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
});