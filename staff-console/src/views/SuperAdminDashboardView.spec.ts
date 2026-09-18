import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import SuperAdminDashboardView from './SuperAdminDashboardView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: { networkOverview: vi.fn() },
}));

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin', name: 'admin-home', component: SuperAdminDashboardView },
      { path: '/admin/:pathMatch(.*)*', name: 'admin-any', component: { template: '<div />' } },
    ],
  });
}

async function mountView() {
  setActivePinia(createPinia());
  const auth = useAuthStore();
  auth.role = 'SUPER_ADMIN';
  auth.accessToken = 'token-1';
  const router = makeRouter();
  await router.push('/admin');
  await router.isReady();
  const wrapper = mount(SuperAdminDashboardView, { global: { plugins: [router] } });
  await flushPromises();
  return wrapper;
}

const fixture = {
  totalSchools: 5,
  totalStudents: 8420,
  totalStaff: 612,
  schools: [
    { id: 'school-1', name: 'Riverdale Grammar', status: 'ACTIVE', campusesCount: 3, studentsCount: 2140, feeCollectionPercent: 96 },
    { id: 'school-2', name: 'Crescent High', status: 'INACTIVE', campusesCount: 1, studentsCount: 940, feeCollectionPercent: 71 },
  ],
};

describe('SuperAdminDashboardView', () => {
  beforeEach(() => {
    vi.mocked(api.networkOverview).mockReset();
  });

  it('renders the network-wide KPI row', async () => {
    vi.mocked(api.networkOverview).mockResolvedValue(fixture);

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('5');
    expect(wrapper.text()).toContain('8,420');
    expect(wrapper.text()).toContain('612');
  });

  it('renders one row per school with its status pill', async () => {
    vi.mocked(api.networkOverview).mockResolvedValue(fixture);

    const wrapper = await mountView();

    const activeRow = wrapper.find('[data-testid="school-row-school-1"]');
    expect(activeRow.text()).toContain('Riverdale Grammar');
    expect(activeRow.text()).toContain('96%');
    expect(activeRow.text()).toContain('Active');

    const inactiveRow = wrapper.find('[data-testid="school-row-school-2"]');
    expect(inactiveRow.text()).toContain('Inactive');
  });

  it('links quick actions to real existing pages, not placeholder features', async () => {
    vi.mocked(api.networkOverview).mockResolvedValue(fixture);

    const wrapper = await mountView();

    expect(wrapper.find('[data-testid="qa-manage-schools"]').attributes('href')).toBe('/admin/schools');
    expect(wrapper.find('[data-testid="qa-manage-campuses"]').attributes('href')).toBe('/admin/campuses');
  });

  it('shows an error message when the network overview fails to load', async () => {
    vi.mocked(api.networkOverview).mockRejectedValue(new Error('Network down'));

    const wrapper = await mountView();

    expect(wrapper.find('[role="alert"]').text()).toContain('Network down');
  });
});
