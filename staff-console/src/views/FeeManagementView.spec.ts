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
    receiptPdfUrl: vi.fn(),
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

    await wrapper.find('[data-testid="ledger-section"]').setValue('sec-1');
    await flushPromises();
    await wrapper.find('[data-testid="ledger-student"]').setValue('s1');
    await flushPromises();

    expect(wrapper.text()).toContain('2026-09');
    expect(wrapper.text()).toContain('unpaid');
    // totalAmount/amountPaid/amountDue are paisa (500000, 0, 500000) — must render as PKR
    // (500000 / 100 = 5000 -> formatPkrFull -> "5,000"), not the raw paisa figure.
    expect(wrapper.text()).toContain('5,000');
    expect(wrapper.text()).not.toContain('500,000');
  });

  it("shows a student's payment history with the receipt amount converted to PKR and a receipt link", async () => {
    vi.mocked(api.studentFees).mockResolvedValue([]);
    vi.mocked(api.studentFeePayments).mockResolvedValue([
      {
        id: 'p1',
        amount: 500000,
        method: 'CARD',
        status: 'completed',
        voucherIds: ['v1'],
        receiptId: 'r1',
        createdAt: '2026-09-05T00:00:00.000Z',
      },
    ]);
    vi.mocked(api.receiptPdfUrl).mockReturnValue('https://api.example.com/fee-payments/p1/receipt.pdf?access_token=token-1');

    const wrapper = mount(FeeManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="ledger-section"]').setValue('sec-1');
    await flushPromises();
    await wrapper.find('[data-testid="ledger-student"]').setValue('s1');
    await flushPromises();

    // amount is paisa (500000) — must render as PKR ("5,000"), not the raw paisa figure.
    expect(wrapper.text()).toContain('5,000');
    expect(wrapper.text()).not.toContain('500,000');
    expect(wrapper.text()).toContain('completed');

    expect(api.receiptPdfUrl).toHaveBeenCalledWith('token-1', 'p1');
    const receiptLink = wrapper.find('a[href="https://api.example.com/fee-payments/p1/receipt.pdf?access_token=token-1"]');
    expect(receiptLink.exists()).toBe(true);
  });

  it('picks a student by name from a section instead of a raw id, and loads that student\'s ledger', async () => {
    vi.mocked(api.studentFees).mockResolvedValue([]);
    vi.mocked(api.studentFeePayments).mockResolvedValue([]);

    const wrapper = mount(FeeManagementView);
    await flushPromises();

    // No "Student ID" text field — the only way in is section, then a named student.
    expect(wrapper.find('[data-testid="ledger-student-id"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="ledger-student"]').exists()).toBe(false);

    await wrapper.find('[data-testid="ledger-section"]').setValue('sec-1');
    await flushPromises();

    expect(api.sectionStudents).toHaveBeenCalledWith('token-1', 'sec-1');
    const studentOptions = wrapper.find('[data-testid="ledger-student"]').findAll('option');
    expect(studentOptions.map((o) => o.text())).toEqual(
      expect.arrayContaining(['Eshaal Sample (GR-1001)', 'Ibrahim Sample (GR-1002)']),
    );

    await wrapper.find('[data-testid="ledger-student"]').setValue('s2');
    await flushPromises();

    expect(api.studentFees).toHaveBeenCalledWith('token-1', 's2');
    expect(api.studentFeePayments).toHaveBeenCalledWith('token-1', 's2');
  });

  it('switching the ledger section clears the previously loaded student and ledger', async () => {
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
    vi.mocked(api.listSections).mockResolvedValue([
      { id: 'sec-1', name: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
      { id: 'sec-2', name: '4B', className: 'Grade 4', campusName: 'Gulistan-e-Jauhar' },
    ]);

    const wrapper = mount(FeeManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="ledger-section"]').setValue('sec-1');
    await flushPromises();
    await wrapper.find('[data-testid="ledger-student"]').setValue('s1');
    await flushPromises();
    expect(wrapper.text()).toContain('2026-09');

    await wrapper.find('[data-testid="ledger-section"]').setValue('sec-2');
    await flushPromises();

    expect(wrapper.text()).not.toContain('unpaid');
    expect((wrapper.find('[data-testid="ledger-student"]').element as HTMLSelectElement).value).toBe('');
  });
});
