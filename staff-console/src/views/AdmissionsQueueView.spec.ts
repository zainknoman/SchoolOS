import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import AdmissionsQueueView from './AdmissionsQueueView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listAcademicSessions: vi.fn(),
    listApplications: vi.fn(),
  },
}));

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/admissions', name: 'admin-admissions', component: AdmissionsQueueView },
      { path: '/admin/admissions/:id', name: 'admin-admission-detail', component: { template: '<div>detail</div>' } },
    ],
  });
}

async function mountView() {
  setActivePinia(createPinia());
  const auth = useAuthStore();
  auth.accessToken = 'token-1';
  const router = makeRouter();
  await router.push('/admin/admissions');
  await router.isReady();
  const wrapper = mount(AdmissionsQueueView, { global: { plugins: [router] } });
  await flushPromises();
  return wrapper;
}

const sessionsFixture = [
  { id: 'sess-1', label: '2026-2027', startDate: '2026-08-01', endDate: '2027-06-30', isActive: true },
];

const applicationsFixture = [
  {
    id: 'appl-1',
    applicantId: 'app-1',
    applicantName: 'Zainab Ali',
    desiredClassId: 'class-1',
    academicSessionId: 'sess-1',
    status: 'SUBMITTED',
    decisionNotes: null,
    reviewedById: null,
    createdStudentId: null,
  },
];

describe('AdmissionsQueueView', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listAcademicSessions).mockResolvedValue(sessionsFixture);
    vi.mocked(api.listApplications).mockResolvedValue(applicationsFixture);
  });

  it('loads applications for the active session by default', async () => {
    const wrapper = await mountView();
    expect(api.listApplications).toHaveBeenCalledWith('token-1', {
      academicSessionId: 'sess-1',
      status: undefined,
    });
    expect(wrapper.text()).toContain('Zainab Ali');
  });

  it('reloads applications when the status filter changes', async () => {
    const wrapper = await mountView();
    await wrapper.find('[data-testid="filter-status"]').setValue('UNDER_REVIEW');
    await flushPromises();
    expect(api.listApplications).toHaveBeenLastCalledWith('token-1', {
      academicSessionId: 'sess-1',
      status: 'UNDER_REVIEW',
    });
  });

  it('each row links to the correct detail route', async () => {
    const wrapper = await mountView();
    const link = wrapper.find('[data-testid="view-application-appl-1"]');
    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toBe('/admin/admissions/appl-1');
  });

  it('shows an error state when listApplications is rejected', async () => {
    vi.mocked(api.listApplications).mockRejectedValue(new Error('Could not load applications.'));
    const wrapper = await mountView();
    expect(wrapper.find('[role="alert"]').text()).toContain('Could not load applications.');
  });
});
