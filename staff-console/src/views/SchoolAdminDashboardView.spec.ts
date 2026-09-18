import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import SchoolAdminDashboardView from './SchoolAdminDashboardView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: { operationsSummary: vi.fn() },
}));

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin', name: 'admin-home', component: SchoolAdminDashboardView },
      { path: '/admin/:pathMatch(.*)*', name: 'admin-any', component: { template: '<div />' } },
    ],
  });
}

async function mountView() {
  setActivePinia(createPinia());
  const auth = useAuthStore();
  auth.role = 'SCHOOL_ADMIN';
  auth.accessToken = 'token-1';
  const router = makeRouter();
  await router.push('/admin');
  await router.isReady();
  const wrapper = mount(SchoolAdminDashboardView, { global: { plugins: [router] } });
  await flushPromises();
  return wrapper;
}

const fixture = {
  admissionsPending: 14,
  feeDefaulters: 23,
  leaveRequestsPending: 5,
  documentsToVerify: 31,
  recentActivity: [{ id: 'n1', message: "Ayesha Raza's B-Form uploaded", createdAt: '2020-01-01T00:00:00.000Z' }],
};

describe('SchoolAdminDashboardView', () => {
  beforeEach(() => {
    vi.mocked(api.operationsSummary).mockReset();
  });

  it('renders the four operational queue counts from the real endpoint', async () => {
    vi.mocked(api.operationsSummary).mockResolvedValue(fixture);

    const wrapper = await mountView();

    expect(wrapper.find('[data-testid="queue-admissions"]').text()).toContain('14');
    expect(wrapper.find('[data-testid="queue-fee-defaulters"]').text()).toContain('23');
    expect(wrapper.find('[data-testid="queue-leave-requests"]').text()).toContain('5');
    expect(wrapper.find('[data-testid="queue-documents"]').text()).toContain('31');
  });

  it('renders recent activity with a relative timestamp', async () => {
    vi.mocked(api.operationsSummary).mockResolvedValue(fixture);

    const wrapper = await mountView();

    expect(wrapper.text()).toContain("Ayesha Raza's B-Form uploaded");
    expect(wrapper.text()).toMatch(/\d+d ago/);
  });

  it('shows an error message when the operations summary fails to load', async () => {
    vi.mocked(api.operationsSummary).mockRejectedValue(new Error('Network down'));

    const wrapper = await mountView();

    expect(wrapper.find('[role="alert"]').text()).toContain('Network down');
  });

  it('renders the quick-actions grid linking to real existing admin pages', async () => {
    vi.mocked(api.operationsSummary).mockResolvedValue(fixture);

    const wrapper = await mountView();

    expect(wrapper.find('[data-testid="qa-add-student"]').attributes('href')).toBe('/admin/students');
    expect(wrapper.find('[data-testid="qa-record-payment"]').attributes('href')).toBe('/admin/fees');
  });
});
