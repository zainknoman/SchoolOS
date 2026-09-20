import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FeePaymentsService } from './fee-payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_GATEWAY_ADAPTER_FACTORY } from './payment-gateway-adapter-factory';

describe('FeePaymentsService', () => {
  let service: FeePaymentsService;
  let prisma: {
    feeVoucher: { findUnique: jest.Mock };
    feePayment: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
    feePaymentAllocation: { deleteMany: jest.Mock; updateMany: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let gatewayFactory: { getAdapter: jest.Mock };
  let adapter: { initiate: jest.Mock };

  beforeEach(async () => {
    prisma = {
      feeVoucher: { findUnique: jest.fn() },
      feePayment: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      feePaymentAllocation: { deleteMany: jest.fn(), updateMany: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    adapter = { initiate: jest.fn() };
    gatewayFactory = { getAdapter: jest.fn().mockReturnValue(adapter) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        FeePaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PAYMENT_GATEWAY_ADAPTER_FACTORY, useValue: gatewayFactory },
      ],
    }).compile();
    service = moduleRef.get(FeePaymentsService);
  });

  it('pay() rejects a voucher that is already fully paid', async () => {
    prisma.feeVoucher.findUnique.mockResolvedValue({
      id: 'v1',
      items: [{ amount: 500000 }],
      allocations: [{ amount: 500000 }],
    });

    await expect(service.pay('v1', 'parent-1', 'jazzcash')).rejects.toThrow(
      BadRequestException,
    );
    expect(adapter.initiate).not.toHaveBeenCalled();
  });

  it('pay() picks the adapter for the requested method and creates a pending payment tagged with it', async () => {
    prisma.feeVoucher.findUnique.mockResolvedValue({
      id: 'v1',
      items: [{ amount: 500000 }],
      allocations: [{ amount: 200000 }],
    });
    adapter.initiate.mockResolvedValue({
      redirectUrl: '/pay/x',
      gatewayReference: 'stub_1',
    });
    prisma.feePayment.create.mockResolvedValue({ id: 'pay-1' });

    const result = await service.pay('v1', 'parent-1', 'easypaisa');

    expect(gatewayFactory.getAdapter).toHaveBeenCalledWith('easypaisa');
    expect(adapter.initiate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 300000 }),
    );
    expect(prisma.feePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 300000,
          method: 'easypaisa',
          status: 'pending',
          allocations: { create: [{ feeVoucherId: 'v1', amount: 300000 }] },
        }),
      }),
    );
    expect(result).toEqual({ redirectUrl: '/pay/x', paymentId: 'pay-1' });
  });

  it('confirmFromWebhook("completed") creates a Receipt and marks the payment completed', async () => {
    prisma.feePayment.findUnique.mockResolvedValue({
      id: 'pay-1',
      status: 'pending',
      reference: 'stub_1',
      allocations: [],
      receipt: null,
    });
    prisma.feePayment.update.mockResolvedValue({
      id: 'pay-1',
      amount: 300000,
      method: 'jazzcash',
      status: 'completed',
      allocations: [{ feeVoucherId: 'v1' }],
      receipt: { id: 'r1' },
      createdAt: new Date('2026-09-01'),
    });

    const result = await service.confirmFromWebhook('stub_1', 'completed');

    expect(prisma.feePayment.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { reference: 'stub_1' } }),
    );
    expect(prisma.feePayment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'completed',
          receipt: { create: expect.anything() },
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        status: 'completed',
        receiptId: 'r1',
        voucherIds: ['v1'],
      }),
    );
  });

  it('confirmFromWebhook("failed") zeroes the allocation amount instead of leaving it counted against the voucher', async () => {
    prisma.feePayment.findUnique.mockResolvedValue({
      id: 'pay-1',
      status: 'pending',
      reference: 'stub_1',
      allocations: [],
      receipt: null,
    });
    prisma.feePayment.update.mockResolvedValue({
      id: 'pay-1',
      amount: 300000,
      method: 'jazzcash',
      status: 'failed',
      allocations: [{ feeVoucherId: 'v1' }],
      receipt: null,
      createdAt: new Date('2026-09-01'),
    });

    const result = await service.confirmFromWebhook('stub_1', 'failed');

    expect(prisma.feePaymentAllocation.updateMany).toHaveBeenCalledWith({
      where: { feePaymentId: 'pay-1' },
      data: { amount: 0 },
    });
    expect(prisma.feePaymentAllocation.deleteMany).not.toHaveBeenCalled();
    expect(result.status).toBe('failed');
  });

  it('confirmFromWebhook("failed") keeps the allocation row\'s feeVoucherId FK intact, so a subsequent getById() can still resolve ownership instead of 404ing', async () => {
    // The allocation is zeroed, not deleted — FeesController derives the ownership-check
    // studentId from payment.allocations[0]?.feeVoucher.studentId, both for the receipt.pdf
    // route. If the row had been deleted, getById() would come back with an empty allocations
    // array and that derivation would silently produce `undefined`, manifesting as a misleading
    // 404 "Payment not found" for the payment's rightful owner.
    prisma.feePayment.findUnique.mockResolvedValueOnce({
      id: 'pay-1',
      status: 'pending',
      reference: 'stub_1',
      allocations: [],
      receipt: null,
    });
    prisma.feePayment.update.mockResolvedValue({
      id: 'pay-1',
      amount: 300000,
      method: 'jazzcash',
      status: 'failed',
      allocations: [{ feeVoucherId: 'v1' }],
      receipt: null,
      createdAt: new Date('2026-09-01'),
    });

    await service.confirmFromWebhook('stub_1', 'failed');

    // Simulate the post-failure DB state a real Postgres/SQLite row would have: the allocation
    // row still exists (amount: 0) with its feeVoucher/student relation intact.
    prisma.feePayment.findUnique.mockResolvedValueOnce({
      id: 'pay-1',
      status: 'failed',
      allocations: [
        {
          feeVoucherId: 'v1',
          amount: 0,
          feeVoucher: { studentId: 's1', student: { id: 's1' } },
        },
      ],
      receipt: null,
    });

    const refetched = await service.getById('pay-1');
    const studentId = refetched.allocations[0]?.feeVoucher.studentId;

    expect(studentId).toBe('s1');
  });

  it('confirmFromWebhook is idempotent — a payment already resolved is returned as-is on a repeat webhook call', async () => {
    prisma.feePayment.findUnique.mockResolvedValue({
      id: 'pay-1',
      amount: 300000,
      method: 'jazzcash',
      status: 'completed',
      reference: 'stub_1',
      allocations: [{ feeVoucherId: 'v1' }],
      receipt: { id: 'r1' },
      createdAt: new Date('2026-09-01'),
    });

    const result = await service.confirmFromWebhook('stub_1', 'completed');

    expect(prisma.feePayment.update).not.toHaveBeenCalled();
    expect(result.status).toBe('completed');
  });

  it('confirmFromWebhook throws NotFoundException for an unknown reference', async () => {
    prisma.feePayment.findUnique.mockResolvedValue(null);
    await expect(
      service.confirmFromWebhook('unknown-ref', 'completed'),
    ).rejects.toThrow(NotFoundException);
  });

  it('getById throws NotFoundException for a missing payment', async () => {
    prisma.feePayment.findUnique.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toThrow(NotFoundException);
  });

  it('reconcile() records a completed cash payment with a receipt, without touching the gateway', async () => {
    prisma.feeVoucher.findUnique.mockResolvedValue({
      id: 'v1',
      items: [{ amount: 500000 }],
      allocations: [{ amount: 200000 }],
    });
    prisma.feePayment.create.mockResolvedValue({
      id: 'pay-2',
      amount: 300000,
      method: 'cash',
      status: 'completed',
      allocations: [{ feeVoucherId: 'v1' }],
      receipt: { id: 'r2' },
      createdAt: new Date('2026-09-10'),
    });

    const result = await service.reconcile(
      'v1',
      { amount: 300000, method: 'cash' },
      'admin-1',
    );

    expect(adapter.initiate).not.toHaveBeenCalled();
    expect(prisma.feePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 300000,
          method: 'cash',
          status: 'completed',
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ status: 'completed', receiptId: 'r2' }),
    );
  });

  it("reconcile() rejects an amount greater than the voucher's remaining balance", async () => {
    prisma.feeVoucher.findUnique.mockResolvedValue({
      id: 'v1',
      items: [{ amount: 500000 }],
      allocations: [{ amount: 200000 }],
    });

    await expect(
      service.reconcile('v1', { amount: 999999, method: 'cash' }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.feePayment.create).not.toHaveBeenCalled();
  });

  it('reconcile() throws NotFoundException for a missing voucher', async () => {
    prisma.feeVoucher.findUnique.mockResolvedValue(null);
    await expect(
      service.reconcile('missing', { amount: 100, method: 'cash' }, 'admin-1'),
    ).rejects.toThrow(NotFoundException);
  });
});
