// staff-console/src/views/AdminHomeView.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import AdminHomeView from './AdminHomeView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: { dashboardSummary: vi.fn(), getFlaggedStudents: vi.fn() },
}));

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: { template: '<div>login</div>' } },
      { path: '/admin', name: 'admin-home', component: AdminHomeView },
      { path: '/admin/fees', name: 'admin-fees', component: { template: '<div>fees</div>' } },
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
  const wrapper = mount(AdminHomeView, { global: { plugins: [router] } });
  await flushPromises();
  return wrapper;
}

const fixture = {
  studentsTotal: 128,
  presentTodayPercent: 93.5,
  absentToday: 8,
  feesCollectedPkr: 24000,
  feesOutstandingPkr: 7000,
  weeklyTrend: [
    { day: 'Mon', attendancePercent: 88, feesCollectedPkr: 3200 },
    { day: 'Tue', attendancePercent: 95, feesCollectedPkr: 4100 },
    { day: 'Wed', attendancePercent: 82, feesCollectedPkr: 3600 },
    { day: 'Thu', attendancePercent: 92, feesCollectedPkr: 4600 },
    { day: 'Fri', attendancePercent: 88, feesCollectedPkr: 3000 },
    { day: 'Sat', attendancePercent: 95, feesCollectedPkr: 4100 },
    { day: 'Sun', attendancePercent: 90, feesCollectedPkr: 3600 },
  ],
  // Far enough in the past that the relative-time assertion below is robust regardless of when
  // the test actually runs — avoids needing fake timers (which would fight this suite's existing
  // flushPromises()-based mountView() helper, itself timer-based in some @vue/test-utils versions).
  recentAlerts: [{ id: 'n1', message: 'New circular published', createdAt: '2020-01-01T00:00:00.000Z' }],
};

describe('AdminHomeView (Dashboard)', () => {
  beforeEach(() => {
    vi.mocked(api.dashboardSummary).mockReset();
    vi.mocked(api.getFlaggedStudents).mockReset();
  });

  it('renders the primary and secondary KPI figures from the real endpoint, with at-risk/teachers-absent dropped', async () => {
    vi.mocked(api.getFlaggedStudents).mockResolvedValue([]);
    vi.mocked(api.dashboardSummary).mockResolvedValue(fixture);

    const wrapper = await mountView();
    const text = wrapper.text();

    expect(text).toContain('128');
    expect(text).toContain('93.5%');
    expect(text).toContain('24K');
    expect(text).toContain('7K');
    expect(wrapper.findAll('.secondary-value').map((n) => n.text())).toEqual(['8']);
    expect(text).not.toContain('At-risk');
    expect(text).not.toContain('Teachers absent');
  });

  it('renders the trends chart and real recent-notification alerts with a relative timestamp', async () => {
    vi.mocked(api.getFlaggedStudents).mockResolvedValue([]);
    vi.mocked(api.dashboardSummary).mockResolvedValue(fixture);

    const wrapper = await mountView();

    expect(wrapper.findComponent({ name: 'TrendsSparkline' }).exists()).toBe(true);
    expect(wrapper.text()).toContain('New circular published');
    // createdAt is fixed at 2020-01-01 (see fixture) — however long ago "now" actually is when
    // this test runs, it's always some number of days, never minutes/hours/"just now".
    expect(wrapper.text()).toMatch(/\d+d ago/);
  });

  it('shows an error message when the dashboard summary fails to load', async () => {
    vi.mocked(api.getFlaggedStudents).mockResolvedValue([]);
    vi.mocked(api.dashboardSummary).mockRejectedValue(new Error('Network down'));

    const wrapper = await mountView();

    expect(wrapper.find('[role="alert"]').text()).toContain('Network down');
  });

  it('renders one row per flagged student in the attendance-risk panel', async () => {
    vi.mocked(api.dashboardSummary).mockResolvedValue(fixture);
    vi.mocked(api.getFlaggedStudents).mockResolvedValue([
      { studentId: 's1', studentName: 'Eshaal Sample', absenceRate: 0.32, flagged: true },
      { studentId: 's2', studentName: 'Ahmed Sample', absenceRate: 0.41, flagged: true },
    ]);

    const wrapper = await mountView();

    const panel = wrapper.find('[data-testid="attendance-risk-panel"]');
    expect(panel.exists()).toBe(true);
    expect(wrapper.find('[data-testid="risk-student-s1"]').text()).toContain('Eshaal Sample');
    expect(panel.text()).toContain('32% absent');
    expect(wrapper.find('[data-testid="risk-student-s2"]').text()).toContain('Ahmed Sample');
    expect(panel.text()).toContain('41% absent');
  });

  it('shows no attendance-risk panel when no student is flagged', async () => {
    vi.mocked(api.dashboardSummary).mockResolvedValue(fixture);
    vi.mocked(api.getFlaggedStudents).mockResolvedValue([]);

    const wrapper = await mountView();

    expect(wrapper.find('[data-testid="attendance-risk-panel"]').exists()).toBe(false);
  });

  it('still renders the rest of the dashboard when the attendance-risk fetch fails', async () => {
    vi.mocked(api.dashboardSummary).mockResolvedValue(fixture);
    vi.mocked(api.getFlaggedStudents).mockRejectedValue(new Error('Network down'));

    const wrapper = await mountView();

    expect(wrapper.find('[data-testid="attendance-risk-panel"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('128'); // KPI still rendered
    expect(wrapper.find('[role="alert"]').exists()).toBe(false); // this failure is swallowed, not surfaced
  });
});
