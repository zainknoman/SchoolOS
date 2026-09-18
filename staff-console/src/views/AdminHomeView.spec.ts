// staff-console/src/views/AdminHomeView.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import AdminHomeView from './AdminHomeView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: { dashboardSummary: vi.fn(), getFlaggedStudents: vi.fn(), operationsSummary: vi.fn(), networkOverview: vi.fn() },
}));

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: { template: '<div>login</div>' } },
      { path: '/admin', name: 'admin-home', component: AdminHomeView },
      { path: '/admin/fees', name: 'admin-fees', component: { template: '<div>fees</div>' } },
      { path: '/admin/students', name: 'admin-students', component: { template: '<div>students</div>' } },
    ],
  });
}

async function mountAs(role: string) {
  setActivePinia(createPinia());
  const auth = useAuthStore();
  auth.role = role;
  auth.accessToken = 'token-1';
  const router = makeRouter();
  await router.push('/admin');
  await router.isReady();
  const wrapper = mount(AdminHomeView, { global: { plugins: [router] } });
  await flushPromises();
  return wrapper;
}

describe('AdminHomeView (role dispatcher)', () => {
  beforeEach(() => {
    vi.mocked(api.dashboardSummary).mockReset();
    vi.mocked(api.getFlaggedStudents).mockReset();
    vi.mocked(api.operationsSummary).mockReset().mockResolvedValue({
      admissionsPending: 0,
      feeDefaulters: 0,
      leaveRequestsPending: 0,
      documentsToVerify: 0,
      recentActivity: [],
    });
    vi.mocked(api.networkOverview).mockReset().mockResolvedValue({
      totalSchools: 0,
      totalStudents: 0,
      totalStaff: 0,
      schools: [],
    });
  });

  it('renders SuperAdminDashboardView for SUPER_ADMIN', async () => {
    const wrapper = await mountAs('SUPER_ADMIN');
    expect(wrapper.text()).toContain('Network Overview');
    expect(api.networkOverview).toHaveBeenCalled();
    expect(api.operationsSummary).not.toHaveBeenCalled();
  });

  it('renders SchoolAdminDashboardView for SCHOOL_ADMIN', async () => {
    const wrapper = await mountAs('SCHOOL_ADMIN');
    expect(wrapper.text()).toContain('Operations');
    expect(api.operationsSummary).toHaveBeenCalled();
    expect(api.networkOverview).not.toHaveBeenCalled();
  });

  it('renders SchoolAdminDashboardView for ACCOUNTS too', async () => {
    const wrapper = await mountAs('ACCOUNTS');
    expect(wrapper.text()).toContain('Operations');
    expect(api.operationsSummary).toHaveBeenCalled();
  });
});
