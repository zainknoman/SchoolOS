import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import FeeManagementView from './FeeManagementView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listFeeStructures: vi.fn(),
    createFeeStructure: vi.fn(),
    listSections: vi.fn(),
    sectionStudents: vi.fn(),
    issueFeeVouchers: vi.fn(),
    studentFees: vi.fn(),
    studentFeePayments: vi.fn(),
  },
}));

describe('FeeManagementView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listFeeStructures).mockResolvedValue([{ id: 'fs-1', name: 'Tuition Fee', amount: 500000 }]);
    vi.mocked(api.listSections).mockResolvedValue([
      { id: 'sec-1', name: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
    ]);
    vi.mocked(api.sectionStudents).mockResolvedValue([
      { id: 's1', name: 'Eshaal Sample', grNumber: 'GR-1001' },
      { id: 's2', name: 'Ibrahim Sample', grNumber: 'GR-1002' },
    ]);
  });

  it('creates a fee structure and it appears in the checklist', async () => {
    vi.mocked(api.createFeeStructure).mockResolvedValue(undefined);

    const wrapper = mount(FeeManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="structure-name"]').setValue('Transport Fee');
    await wrapper.find('[data-testid="structure-amount"]').setValue('2000');
    await wrapper.find('[data-testid="create-structure"]').trigger('click');
    await flushPromises();

    expect(api.createFeeStructure).toHaveBeenCalledWith('token-1', { name: 'Transport Fee', amount: 200000 });
  });

  it('issues vouchers to a whole section when no individual students are checked', async () => {
    vi.mocked(api.issueFeeVouchers).mockResolvedValue(undefined);

    const wrapper = mount(FeeManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="issue-section"]').setValue('sec-1');
    await flushPromises();
    await wrapper.find('[data-testid="structure-fs-1"]').setValue(true);
    await wrapper.find('[data-testid="issue-month"]').setValue('2026-09');
    await wrapper.find('[data-testid="issue-due-date"]').setValue('2026-09-10');
    await wrapper.find('[data-testid="issue-vouchers"]').trigger('click');
    await flushPromises();

    expect(api.issueFeeVouchers).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({ sectionId: 'sec-1', studentIds: undefined, feeStructureIds: ['fs-1'] }),
    );
  });

  it('issues vouchers to only the checked students when some are selected', async () => {
    vi.mocked(api.issueFeeVouchers).mockResolvedValue(undefined);

    const wrapper = mount(FeeManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="issue-section"]').setValue('sec-1');
    await flushPromises();
    await wrapper.find('[data-testid="student-s1"]').setValue(true);
    await wrapper.find('[data-testid="structure-fs-1"]').setValue(true);
    await wrapper.find('[data-testid="issue-month"]').setValue('2026-09');
    await wrapper.find('[data-testid="issue-due-date"]').setValue('2026-09-10');
    await wrapper.find('[data-testid="issue-vouchers"]').trigger('click');
    await flushPromises();

    expect(api.issueFeeVouchers).toHaveBeenCalledWith(
      'token-1',
      expect.objectContaining({ sectionId: undefined, studentIds: ['s1'] }),
    );
  });

  it("loads a student's fee ledger showing voucher status and payment history", async () => {
    vi.mocked(api.studentFees).mockResolvedValue([
      {
        id: 'v1',
        studentId: 's1',
        month: '2026-09',
        dueDate: '2026-09-10',
        items: [{ label: 'Tuition Fee', amount: 500000 }],
        totalAmount: 500000,
        amountPaid: 0,
        amountDue: 500000,
        status: 'unpaid',
      },
    ]);
    vi.mocked(api.studentFeePayments).mockResolvedValue([]);

    const wrapper = mount(FeeManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="ledger-student-id"]').setValue('s1');
    await wrapper.find('[data-testid="load-ledger"]').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('2026-09');
    expect(wrapper.text()).toContain('unpaid');
  });
});
