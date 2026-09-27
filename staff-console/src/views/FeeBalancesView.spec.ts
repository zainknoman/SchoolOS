import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import FeeBalancesView from './FeeBalancesView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listSections: vi.fn(),
    listSchools: vi.fn(),
    outstandingFees: vi.fn(),
    getFeePolicy: vi.fn(),
    updateFeePolicy: vi.fn(),
    applyLateFees: vi.fn(),
    carryForwardFees: vi.fn(),
  },
}));

const report = {
  schoolId: 'sch-1',
  totals: { students: 1, defaulters: 1, outstanding: 150000, overdue: 120000 },
  rows: [
    {
      studentId: 's1',
      grNumber: 'GR-1',
      name: 'Eshaal Sample',
      campusId: 'c1',
      campusName: 'Main',
      classId: 'k1',
      className: 'Grade 3',
      sectionId: 'sec-1',
      sectionName: '3A',
      vouchers: 2,
      overdueVouchers: 1,
      outstanding: 150000,
      overdueAmount: 120000,
      oldestDueDate: '2026-08-10',
    },
  ],
};

describe('FeeBalancesView (BL-08)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    auth.role = 'ACCOUNTS';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listSections).mockResolvedValue([
      { id: 'sec-1', name: '3A', className: 'Grade 3', campusName: 'Main' },
    ]);
    vi.mocked(api.outstandingFees).mockResolvedValue(report);
    vi.mocked(api.getFeePolicy).mockResolvedValue({ schoolId: 'sch-1', lateFeeAmount: 20000, lateFeeGraceDays: 5 });
  });

  it('lists defaulters with totals, and filters by section', async () => {
    const wrapper = mount(FeeBalancesView);
    await flushPromises();
    expect(api.outstandingFees).toHaveBeenCalledWith('token-1', {
      schoolId: undefined,
      sectionId: undefined,
      defaultersOnly: true,
    });
    expect(wrapper.find('[data-testid="balance-row-s1"]').text()).toContain('Eshaal Sample');
    expect(wrapper.find('[data-testid="balances-totals"]').text()).toContain('1 student');

    await wrapper.find('[data-testid="balances-section"]').setValue('sec-1');
    await flushPromises();
    expect(api.outstandingFees).toHaveBeenLastCalledWith('token-1', {
      schoolId: undefined,
      sectionId: 'sec-1',
      defaultersOnly: true,
    });
  });

  it('saves the late-fee rule in paisa and applies late fees', async () => {
    vi.mocked(api.updateFeePolicy).mockResolvedValue({ schoolId: 'sch-1', lateFeeAmount: 30000, lateFeeGraceDays: 3 });
    vi.mocked(api.applyLateFees).mockResolvedValue({ applied: 2, voucherIds: ['v1', 'v2'] });
    const wrapper = mount(FeeBalancesView);
    await flushPromises();
    expect((wrapper.find('[data-testid="late-fee-amount"]').element as HTMLInputElement).value).toBe('200');

    await wrapper.find('[data-testid="late-fee-amount"]').setValue('300');
    await wrapper.find('[data-testid="late-fee-grace"]').setValue('3');
    await wrapper.find('[data-testid="late-fee-save"]').trigger('click');
    await flushPromises();
    expect(api.updateFeePolicy).toHaveBeenCalledWith('token-1', { lateFeeAmount: 30000, lateFeeGraceDays: 3 });

    await wrapper.find('[data-testid="late-fee-apply"]').trigger('click');
    await flushPromises();
    expect(api.applyLateFees).toHaveBeenCalledWith('token-1', undefined);
  });

  it('carry-forward needs a due date', async () => {
    vi.mocked(api.carryForwardFees).mockResolvedValue({ students: 1, vouchers: 1, amount: 30000 });
    const wrapper = mount(FeeBalancesView);
    await flushPromises();
    await wrapper.find('[data-testid="carry-forward"]').trigger('click');
    await flushPromises();
    expect(api.carryForwardFees).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="carry-due-date"]').setValue('2026-10-10');
    await wrapper.find('[data-testid="carry-forward"]').trigger('click');
    await flushPromises();
    expect(api.carryForwardFees).toHaveBeenCalledWith('token-1', { dueDate: '2026-10-10' });
  });

  it('a campus-level user cannot change the school-wide rule', async () => {
    useAuthStore().campusId = 'campus-1';
    const wrapper = mount(FeeBalancesView);
    await flushPromises();
    expect(wrapper.find('[data-testid="late-fee-save"]').exists()).toBe(false);
  });
});
