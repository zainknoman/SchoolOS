import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrincipalOverviewView from './PrincipalOverviewView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: { dashboardSummary: vi.fn(), getFlaggedStudents: vi.fn(), operationsSummary: vi.fn() },
}));

async function mountView() {
  setActivePinia(createPinia());
  const auth = useAuthStore();
  auth.role = 'SCHOOL_ADMIN';
  auth.isPrincipal = true;
  auth.accessToken = 'token-1';
  const wrapper = mount(PrincipalOverviewView);
  await flushPromises();
  return wrapper;
}

const summaryFixture = {
  studentsTotal: 1284,
  presentTodayPercent: 93.5,
  absentToday: 84,
  feesCollectedPkr: 2400000,
  feesOutstandingPkr: 680000,
  weeklyTrend: [{ day: 'Mon', attendancePercent: 90, feesCollectedPkr: 100000 }],
  recentAlerts: [{ id: 'n1', message: 'Mid-term exam schedule published', createdAt: '2020-01-01T00:00:00.000Z' }],
};

describe('PrincipalOverviewView', () => {
  beforeEach(() => {
    vi.mocked(api.dashboardSummary).mockReset();
    vi.mocked(api.getFlaggedStudents).mockReset();
    vi.mocked(api.operationsSummary).mockReset();
  });

  it('renders the KPI cards from the shared dashboard-summary endpoint', async () => {
    vi.mocked(api.dashboardSummary).mockResolvedValue(summaryFixture);
    vi.mocked(api.getFlaggedStudents).mockResolvedValue([]);
    vi.mocked(api.operationsSummary).mockResolvedValue({
      admissionsPending: 12,
      feeDefaulters: 0,
      leaveRequestsPending: 0,
      documentsToVerify: 0,
      recentActivity: [],
    });

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('1,284');
    expect(wrapper.text()).toContain('93.5%');
  });

  it("renders the Needs Attention panel from flagged students, absences, and pending admissions", async () => {
    vi.mocked(api.dashboardSummary).mockResolvedValue(summaryFixture);
    vi.mocked(api.getFlaggedStudents).mockResolvedValue([
      { studentId: 's1', studentName: 'Eshaal', absenceRate: 0.3, flagged: true, windowStart: '', windowEnd: '' },
    ]);
    vi.mocked(api.operationsSummary).mockResolvedValue({
      admissionsPending: 12,
      feeDefaulters: 0,
      leaveRequestsPending: 0,
      documentsToVerify: 0,
      recentActivity: [],
    });

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('At-risk students');
    expect(wrapper.text()).toContain('Pending admissions');
    expect(wrapper.text()).toContain('12');
  });

  it('still renders the KPIs when the non-critical admissions count fails to load', async () => {
    vi.mocked(api.dashboardSummary).mockResolvedValue(summaryFixture);
    vi.mocked(api.getFlaggedStudents).mockResolvedValue([]);
    vi.mocked(api.operationsSummary).mockRejectedValue(new Error('down'));

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('1,284');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('shows an error message when the dashboard summary itself fails to load', async () => {
    vi.mocked(api.dashboardSummary).mockRejectedValue(new Error('Network down'));
    vi.mocked(api.getFlaggedStudents).mockResolvedValue([]);
    vi.mocked(api.operationsSummary).mockResolvedValue({
      admissionsPending: 0,
      feeDefaulters: 0,
      leaveRequestsPending: 0,
      documentsToVerify: 0,
      recentActivity: [],
    });

    const wrapper = await mountView();

    expect(wrapper.find('[role="alert"]').text()).toContain('Network down');
  });
});
