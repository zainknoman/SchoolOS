import { FeesPdfService } from './fees-pdf.service';

describe('FeesPdfService', () => {
  const service = new FeesPdfService();

  it('renders a voucher as a non-empty PDF buffer', async () => {
    const buffer = await service.renderVoucherPdf({
      studentName: 'Eshaal Sample',
      grNumber: 'GR-1001',
      month: '2026-09',
      dueDate: '2026-09-10',
      items: [{ label: 'Tuition Fee', amount: 500000 }],
      totalAmount: 500000,
    });
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('renders a receipt as a non-empty PDF buffer', async () => {
    const buffer = await service.renderReceiptPdf({
      receiptNumber: 'RCPT-20260903-abc123',
      studentName: 'Eshaal Sample',
      amount: 500000,
      method: 'jazzcash',
      paidAt: '2026-09-03',
    });
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });
});
