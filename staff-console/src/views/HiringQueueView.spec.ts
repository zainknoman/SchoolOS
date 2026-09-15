import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import HiringQueueView from './HiringQueueView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/hiring', name: 'admin-hiring', component: HiringQueueView },
      { path: '/admin/hiring/:id', name: 'admin-hiring-detail', component: { template: '<div>detail</div>' } },
    ],
  });
  await router.push('/admin/hiring');
  await router.isReady();
  return mount(HiringQueueView, { global: { plugins: [router] } });
}

vi.mock('../lib/api', () => ({
  api: { listCampuses: vi.fn(), listHiringApplications: vi.fn() },
}));

describe('HiringQueueView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listCampuses).mockResolvedValue([
      { id: 'cam1', name: 'PECHS Campus', schoolId: 'sch1', schoolName: 'Seeds School' },
    ]);
    vi.mocked(api.listHiringApplications).mockResolvedValue([
      { id: 'app1', candidateId: 'cand1', candidateName: 'Bilal Hussain', employeeType: 'GUARD', campusId: 'cam1', status: 'SUBMITTED', decisionNotes: null, reviewedById: null, createdStaffId: null },
    ]);
  });

  it('lists hiring applications with candidate name and status', async () => {
    const wrapper = await mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Bilal Hussain');
    expect(wrapper.text()).toContain('SUBMITTED');
  });

  it("links each row to that application's detail page", async () => {
    const wrapper = await mountView();
    await flushPromises();

    const link = wrapper.find('[data-testid="view-application-app1"]');
    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toBe('/admin/hiring/app1');
  });

  it('reloads filtered by campus and status when either filter changes', async () => {
    const wrapper = await mountView();
    await flushPromises();
    vi.mocked(api.listHiringApplications).mockResolvedValue([]);

    await wrapper.find('[data-testid="filter-status"]').setValue('SHORTLISTED');
    await flushPromises();

    expect(api.listHiringApplications).toHaveBeenCalledWith('token-1', {
      campusId: undefined, status: 'SHORTLISTED',
    });
  });
});