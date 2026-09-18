import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrincipalAcademicsStaffView from './PrincipalAcademicsStaffView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: { principalAcademicsSummary: vi.fn() },
}));

async function mountView() {
  setActivePinia(createPinia());
  const auth = useAuthStore();
  auth.role = 'SCHOOL_ADMIN';
  auth.isPrincipal = true;
  auth.accessToken = 'token-1';
  const wrapper = mount(PrincipalAcademicsStaffView);
  await flushPromises();
  return wrapper;
}

describe('PrincipalAcademicsStaffView', () => {
  beforeEach(() => {
    vi.mocked(api.principalAcademicsSummary).mockReset();
  });

  it('renders one class-health row per section with attendance% and marks%', async () => {
    vi.mocked(api.principalAcademicsSummary).mockResolvedValue({
      classHealth: [
        {
          sectionId: 'sec-1',
          className: '6',
          sectionName: 'A',
          teacherName: 'Ms. Fatima',
          attendancePercent: 96,
          averageMarksPercent: 82,
        },
      ],
      examScheduleStatus: [],
    });

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('6 · A');
    expect(wrapper.text()).toContain('96%');
    expect(wrapper.text()).toContain('82%');
    expect(wrapper.text()).toContain('Ms. Fatima');
  });

  it("shows '—' for average marks when a class has no marks entered yet", async () => {
    vi.mocked(api.principalAcademicsSummary).mockResolvedValue({
      classHealth: [
        { sectionId: 'sec-1', className: '6', sectionName: 'A', teacherName: null, attendancePercent: 96, averageMarksPercent: null },
      ],
      examScheduleStatus: [],
    });

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('—');
  });

  it('renders exam schedule status pills as Ready or Pending', async () => {
    vi.mocked(api.principalAcademicsSummary).mockResolvedValue({
      classHealth: [],
      examScheduleStatus: [
        { categoryId: 'c1', categoryName: 'Mid-term', className: 'Grade 9', termLabel: 'Term 1', status: 'ready' },
        { categoryId: 'c2', categoryName: 'Mid-term', className: 'Grade 6', termLabel: 'Term 1', status: 'pending' },
      ],
    });

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('Ready');
    expect(wrapper.text()).toContain('Pending');
  });

  it('shows an error message when the summary fails to load', async () => {
    vi.mocked(api.principalAcademicsSummary).mockRejectedValue(new Error('Network down'));

    const wrapper = await mountView();

    expect(wrapper.find('[role="alert"]').text()).toContain('Network down');
  });
});
