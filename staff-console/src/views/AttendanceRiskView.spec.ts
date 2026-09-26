import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AttendanceRiskView from './AttendanceRiskView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    getAttendanceRiskSettings: vi.fn(),
    updateAttendanceRiskSettings: vi.fn(),
    getFlaggedStudents: vi.fn(),
    listSchools: vi.fn(),
  },
}));

function setUser(role: string, campusId: string | null = null) {
  const auth = useAuthStore();
  auth.accessToken = 'token-1';
  auth.role = role as never;
  auth.campusId = campusId;
}

describe('AttendanceRiskView (BL-28)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(api.getAttendanceRiskSettings).mockReset().mockResolvedValue({
      schoolId: 'a',
      windowDays: 30,
      thresholdPercent: 25,
      minTrackedDays: 5,
      notifyParents: false,
    });
    vi.mocked(api.updateAttendanceRiskSettings).mockReset().mockResolvedValue({
      schoolId: 'a',
      windowDays: 14,
      thresholdPercent: 20,
      minTrackedDays: 3,
      notifyParents: true,
    });
    vi.mocked(api.getFlaggedStudents).mockReset().mockResolvedValue([
      { studentId: 's1', studentName: 'Ali', absenceRate: 0.4, flagged: true, windowStart: '2026-08-27', windowEnd: '2026-09-26' },
    ]);
    vi.mocked(api.listSchools).mockReset().mockResolvedValue([{ id: 'a', name: 'School A' } as never]);
  });

  it('shows the current settings and the flagged students', async () => {
    setUser('SCHOOL_ADMIN');
    const wrapper = mount(AttendanceRiskView);
    await flushPromises();
    expect((wrapper.find('[data-testid="risk-window"]').element as HTMLInputElement).value).toBe('30');
    expect(wrapper.find('[data-testid="risk-flagged"]').text()).toContain('Ali');
    expect(wrapper.find('[data-testid="risk-flagged"]').text()).toContain('40%');
  });

  it('a school-wide admin saves new settings including parent alerts', async () => {
    setUser('SCHOOL_ADMIN');
    const wrapper = mount(AttendanceRiskView);
    await flushPromises();
    await wrapper.find('[data-testid="risk-window"]').setValue('14');
    await wrapper.find('[data-testid="risk-threshold"]').setValue('20');
    await wrapper.find('[data-testid="risk-min-days"]').setValue('3');
    await wrapper.find('[data-testid="risk-notify-parents"]').setValue(true);
    await wrapper.find('[data-testid="risk-save"]').trigger('click');
    await flushPromises();
    expect(api.updateAttendanceRiskSettings).toHaveBeenCalledWith('token-1', {
      windowDays: 14,
      thresholdPercent: 20,
      minTrackedDays: 3,
      notifyParents: true,
    });
  });

  it('refuses a minimum above the window without calling the API', async () => {
    setUser('SCHOOL_ADMIN');
    const wrapper = mount(AttendanceRiskView);
    await flushPromises();
    await wrapper.find('[data-testid="risk-min-days"]').setValue('40');
    await wrapper.find('[data-testid="risk-save"]').trigger('click');
    await flushPromises();
    expect(api.updateAttendanceRiskSettings).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('cannot be more than the window');
  });

  it('a campus-level admin sees the settings read-only', async () => {
    setUser('SCHOOL_ADMIN', 'campus-1');
    const wrapper = mount(AttendanceRiskView);
    await flushPromises();
    expect(wrapper.find('[data-testid="risk-save"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="risk-read-only"]').exists()).toBe(true);
    expect((wrapper.find('[data-testid="risk-window"]').element as HTMLInputElement).disabled).toBe(true);
  });

  it('a super admin chooses the school first', async () => {
    setUser('SUPER_ADMIN');
    const wrapper = mount(AttendanceRiskView);
    await flushPromises();
    expect(api.getAttendanceRiskSettings).not.toHaveBeenCalled();
    await wrapper.find('[data-testid="risk-school"]').setValue('a');
    await flushPromises();
    expect(api.getAttendanceRiskSettings).toHaveBeenCalledWith('token-1', 'a');
    await wrapper.find('[data-testid="risk-save"]').trigger('click');
    await flushPromises();
    expect(vi.mocked(api.updateAttendanceRiskSettings).mock.calls[0]?.[1]).toMatchObject({ schoolId: 'a' });
  });
});
