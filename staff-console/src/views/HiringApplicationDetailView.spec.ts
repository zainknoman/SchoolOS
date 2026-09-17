import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import HiringApplicationDetailView from './HiringApplicationDetailView.vue';
import { useAuthStore } from '../stores/auth';
import { api, type HiringApplicationSummary } from '../lib/api';

async function mountView(id = 'app1') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/admin/hiring/:id', name: 'admin-hiring-detail', component: HiringApplicationDetailView }],
  });
  await router.push(`/admin/hiring/${id}`);
  await router.isReady();
  return mount(HiringApplicationDetailView, { global: { plugins: [router] } });
}

function baseApplication(overrides: Partial<HiringApplicationSummary> = {}): HiringApplicationSummary {
  return {
    id: 'app1', candidateId: 'cand1', candidateName: 'Bilal Hussain', employeeType: 'GUARD',
    campusId: 'cam1', status: 'SUBMITTED', decisionNotes: null, reviewedById: null, createdStaffId: null,
    ...overrides,
  };
}

vi.mock('../lib/api', () => ({
  api: {
    getHiringApplication: vi.fn(),
    listCampuses: vi.fn(),
    updateHiringApplicationStatus: vi.fn(),
    rejectHiringApplication: vi.fn(),
    approveHiringApplication: vi.fn(),
  },
}));

describe('HiringApplicationDetailView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listCampuses).mockResolvedValue([
      { id: 'cam1', name: 'PECHS Campus', schoolId: 'sch1', schoolName: 'Seeds School', address: null, phone: null, email: null, studentCount: 0, staffCount: 0 },
    ]);
  });

  it('shows the application read-only, with campus name resolved', async () => {
    vi.mocked(api.getHiringApplication).mockResolvedValue(baseApplication());

    const wrapper = await mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Bilal Hussain');
    expect(wrapper.text()).toContain('PECHS Campus');
    expect(wrapper.text()).toContain('SUBMITTED');
  });

  it('marks the application shortlisted', async () => {
    vi.mocked(api.getHiringApplication).mockResolvedValue(baseApplication());
    vi.mocked(api.updateHiringApplicationStatus).mockResolvedValue(baseApplication({ status: 'SHORTLISTED' }));

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="mark-shortlisted"]').trigger('click');
    await flushPromises();

    expect(api.updateHiringApplicationStatus).toHaveBeenCalledWith('token-1', 'app1', { status: 'SHORTLISTED' });
    expect(wrapper.text()).toContain('SHORTLISTED');
  });

  it('rejects the application with decision notes', async () => {
    vi.mocked(api.getHiringApplication).mockResolvedValue(baseApplication());
    vi.mocked(api.rejectHiringApplication).mockResolvedValue(baseApplication({ status: 'REJECTED', decisionNotes: 'Not a fit' }));

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="open-reject-modal"]').trigger('click');
    await wrapper.find('[data-testid="reject-decision-notes"]').setValue('Not a fit');
    await wrapper.find('[data-testid="reject-submit"]').trigger('click');
    await flushPromises();

    expect(api.rejectHiringApplication).toHaveBeenCalledWith('token-1', 'app1', 'Not a fit');
    expect(wrapper.find('[data-testid="approve-submit"]').exists()).toBe(false);
  });

  it('approves a non-teacher hire without requiring a login', async () => {
    vi.mocked(api.getHiringApplication).mockResolvedValue(baseApplication());
    vi.mocked(api.approveHiringApplication).mockResolvedValue(baseApplication({ status: 'APPROVED', createdStaffId: 'st1' }));

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="open-approve-modal"]').trigger('click');
    await wrapper.find('[data-testid="approve-mobile"]').setValue('0300-1112233');
    await wrapper.find('[data-testid="approve-submit"]').trigger('click');
    await flushPromises();

    expect(api.approveHiringApplication).toHaveBeenCalledWith('token-1', 'app1', {
      dateOfBirth: undefined, cnic: undefined, mobile: '0300-1112233', email: undefined, joiningDate: undefined, login: undefined,
    });
  });

  it('requires a login identifier/password to approve a TEACHER hire', async () => {
    vi.mocked(api.getHiringApplication).mockResolvedValue(baseApplication({ employeeType: 'TEACHER' }));

    const wrapper = await mountView();
    await flushPromises();

    await wrapper.find('[data-testid="open-approve-modal"]').trigger('click');
    expect(wrapper.find('[data-testid="approve-login-identifier"]').exists()).toBe(true);

    await wrapper.find('[data-testid="approve-submit"]').trigger('click');
    await flushPromises();

    expect(api.approveHiringApplication).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="approve-login-identifier"]').setValue('new.teacher@seeds.edu.pk');
    await wrapper.find('[data-testid="approve-login-password"]').setValue('InitialPass1!');
    await wrapper.find('[data-testid="approve-submit"]').trigger('click');
    await flushPromises();

    expect(api.approveHiringApplication).toHaveBeenCalledWith('token-1', 'app1', {
      dateOfBirth: undefined, cnic: undefined, mobile: undefined, email: undefined, joiningDate: undefined,
      login: { identifier: 'new.teacher@seeds.edu.pk', password: 'InitialPass1!' },
    });
  });

  it('hides decision actions once the application is already terminal', async () => {
    vi.mocked(api.getHiringApplication).mockResolvedValue(baseApplication({ status: 'APPROVED' }));

    const wrapper = await mountView();
    await flushPromises();

    expect(wrapper.find('[data-testid="mark-shortlisted"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="reject-submit"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="approve-submit"]').exists()).toBe(false);
  });
});