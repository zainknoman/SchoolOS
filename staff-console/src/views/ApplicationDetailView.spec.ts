import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import ApplicationDetailView from './ApplicationDetailView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    getApplication: vi.fn(),
    listSections: vi.fn(),
    listAdminParents: vi.fn(),
    updateApplicationStatus: vi.fn(),
    rejectApplication: vi.fn(),
    approveApplication: vi.fn(),
  },
}));

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/admissions/:id', name: 'admin-admission-detail', component: ApplicationDetailView },
      { path: '/admin/admissions', name: 'admin-admissions', component: { template: '<div />' } },
    ],
  });
}

const applicationFixture = {
  id: 'appl-1',
  applicantId: 'app-1',
  applicantName: 'Zainab Ali',
  desiredClassId: 'class-1',
  academicSessionId: 'sess-1',
  status: 'SUBMITTED',
  decisionNotes: null,
  reviewedById: null,
  createdStudentId: null,
};

const sectionsFixture = [
  { id: 'section-1', name: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
];

const parentsFixture = [{ id: 'parent-1', identifier: 'parent-1@schoolos.edu.pk', name: 'Existing Parent', phone: null, childrenCount: 1 }];

async function mountView() {
  setActivePinia(createPinia());
  const auth = useAuthStore();
  auth.accessToken = 'token-1';
  const router = makeRouter();
  await router.push('/admin/admissions/appl-1');
  await router.isReady();
  const wrapper = mount(ApplicationDetailView, { global: { plugins: [router] } });
  await flushPromises();
  return wrapper;
}

describe('ApplicationDetailView', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.getApplication).mockResolvedValue(applicationFixture);
    vi.mocked(api.listSections).mockResolvedValue(sectionsFixture);
    vi.mocked(api.listAdminParents).mockResolvedValue(parentsFixture);
  });

  it('loads and displays the application', async () => {
    const wrapper = await mountView();
    expect(api.getApplication).toHaveBeenCalledWith('token-1', 'appl-1');
    expect(wrapper.text()).toContain('Zainab Ali');
    expect(wrapper.text()).toContain('Submitted');
  });

  it('"Mark Under Review" calls api.updateApplicationStatus', async () => {
    vi.mocked(api.updateApplicationStatus).mockResolvedValue({ ...applicationFixture, status: 'UNDER_REVIEW' });
    const wrapper = await mountView();
    await wrapper.find('[data-testid="mark-under-review"]').trigger('click');
    await flushPromises();
    expect(api.updateApplicationStatus).toHaveBeenCalledWith('token-1', 'appl-1', { status: 'UNDER_REVIEW' });
  });

  it('reject flow calls api.rejectApplication with the entered notes', async () => {
    vi.mocked(api.rejectApplication).mockResolvedValue({ ...applicationFixture, status: 'REJECTED', decisionNotes: 'No seats' });
    const wrapper = await mountView();
    await wrapper.find('[data-testid="open-reject-modal"]').trigger('click');
    await wrapper.find('[data-testid="reject-decision-notes"]').setValue('No seats');
    await wrapper.find('[data-testid="reject-submit"]').trigger('click');
    await flushPromises();
    expect(api.rejectApplication).toHaveBeenCalledWith('token-1', 'appl-1', 'No seats');
  });

  it('approve flow with the new-parent toggle submits the exactly-one-of parent shape', async () => {
    vi.mocked(api.approveApplication).mockResolvedValue({ ...applicationFixture, status: 'APPROVED', createdStudentId: 'stu-1' });
    const wrapper = await mountView();

    await wrapper.find('[data-testid="open-approve-modal"]').trigger('click');
    await wrapper.find('[data-testid="approve-gr-number"]').setValue('ADM-STU-1');
    await wrapper.find('[data-testid="approve-section"]').setValue('section-1');
    await wrapper.find('[data-testid="toggle-new-parent"]').setValue(true);
    await wrapper.find('[data-testid="new-parent-identifier"]').setValue('new-parent');
    await wrapper.find('[data-testid="new-parent-password"]').setValue('CorrectHorseBattery9!');
    await wrapper.find('[data-testid="new-parent-name"]').setValue('New Parent');
    await wrapper.find('[data-testid="approve-submit"]').trigger('click');
    await flushPromises();

    expect(api.approveApplication).toHaveBeenCalledWith('token-1', 'appl-1', {
      grNumber: 'ADM-STU-1',
      sectionId: 'section-1',
      newParent: {
        identifier: 'new-parent',
        password: 'CorrectHorseBattery9!',
        name: 'New Parent',
        phone: undefined,
      },
    });
  });

  it('a rejected approve call surfaces the backend error via role="alert"', async () => {
    vi.mocked(api.approveApplication).mockRejectedValue(
      new Error('This GR number or parent identifier is already in use.'),
    );
    const wrapper = await mountView();

    await wrapper.find('[data-testid="open-approve-modal"]').trigger('click');
    await wrapper.find('[data-testid="approve-gr-number"]').setValue('ADM-STU-1');
    await wrapper.find('[data-testid="approve-section"]').setValue('section-1');
    await wrapper.find('[data-testid="add-parent-select"]').setValue('parent-1');
    await wrapper.find('[data-testid="approve-submit"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('This GR number or parent identifier is already in use.');
  });
});
