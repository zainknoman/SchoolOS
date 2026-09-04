import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FeePaymentsService } from './fee-payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_GATEWAY_ADAPTER } from './payment-gateway-adapter';

describe('FeePaymentsService', () => {
  let service: FeePaymentsService;
  let prisma: {
    feeVoucher: { findUnique: jest.Mock };
    feePayment: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock; findMany: jest.Mock };
    feePaymentAllocation: { deleteMany: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let gateway: { initiate: jest.Mock; confirm: jest.Mock };

  beforeEach(async () => {
    prisma = {
      feeVoucher: { findUnique: jest.fn() },
      feePayment: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      feePaymentAllocation: { deleteMany: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    gateway = { initiate: jest.fn(), confirm: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        FeePaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PAYMENT_GATEWAY_ADAPTER, useValue: gateway },
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

    await expect(service.pay('v1', 'parent-1')).rejects.toThrow(BadRequestException);
    expect(gateway.initiate).not.toHaveBeenCalled();
  });

  it('pay() initiates against the gateway for the remaining amountDue and creates a pending payment + allocation', async () => {
    prisma.feeVoucher.findUnique.mockResolvedValue({
      id: 'v1',
      items: [{ amount: 500000 }],
      allocations: [{ amount: 200000 }],
    });
    gateway.initiate.mockResolvedValue({ redirectUrl: '/pay/x', gatewayReference: 'stub_1' });
    prisma.feePayment.create.mockResolvedValue({ id: 'pay-1' });

    const result = await service.pay('v1', 'parent-1');

    expect(gateway.initiate).toHaveBeenCalledWith(expect.objectContaining({ amount: 300000 }));
    expect(prisma.feePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 300000,
          status: 'pending',
          allocations: { create: [{ feeVoucherId: 'v1', amount: 300000 }] },
        }),
      }),
    );
    expect(result).toEqual({ redirectUrl: '/pay/x', paymentId: 'pay-1' });
  });

  it('confirm() completed creates a Receipt and marks the payment completed', async () => {
    prisma.feePayment.findUnique.mockResolvedValue({
      id: 'pay-1',
      status: 'pending',
      reference: 'stub_1',
      allocations: [],
      receipt: null,
    });
    gateway.confirm.mockResolvedValue({ status: 'completed' });
    prisma.feePayment.update.mockResolvedValue({
      id: 'pay-1',
      amount: 300000,
      method: 'jazzcash',
      status: 'completed',
      allocations: [{ feeVoucherId: 'v1' }],
      receipt: { id: 'r1' },
      createdAt: new Date('2026-09-01'),
    });

    const result = await service.confirm('pay-1', 'parent-1');

    expect(prisma.feePayment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'completed', receipt: { create: expect.anything() } }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ status: 'completed', receiptId: 'r1', voucherIds: ['v1'] }),
    );
  });

  it('confirm() failed removes the allocation instead of leaving it counted against the voucher', async () => {
    prisma.feePayment.findUnique.mockResolvedValue({
      id: 'pay-1',
      status: 'pending',
      reference: 'stub_1',
      allocations: [],
      receipt: null,
    });
    gateway.confirm.mockResolvedValue({ status: 'failed' });
    prisma.feePayment.update.mockResolvedValue({
      id: 'pay-1',
      amount: 300000,
      method: 'jazzcash',
      status: 'failed',
      allocations: [],
      receipt: null,
      createdAt: new Date('2026-09-01'),
    });

    const result = await service.confirm('pay-1', 'parent-1');

    expect(prisma.feePaymentAllocation.deleteMany).toHaveBeenCalledWith({
      where: { feePaymentId: 'pay-1' },
    });
    expect(result.status).toBe('failed');
  });

  it('confirm() is idempotent — a payment already completed is returned as-is without calling the gateway again', async () => {
    prisma.feePayment.findUnique.mockResolvedValue({
      id: 'pay-1',
      amount: 300000,
      method: 'jazzcash',
      status: 'completed',
      allocations: [{ feeVoucherId: 'v1' }],
      receipt: { id: 'r1' },
      createdAt: new Date('2026-09-01'),
    });

    const result = await service.confirm('pay-1', 'parent-1');

    expect(gateway.confirm).not.toHaveBeenCalled();
    expect(result.status).toBe('completed');
  });

  it('getById throws NotFoundException for a missing payment', async () => {
    prisma.feePayment.findUnique.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toThrow(NotFoundException);
  });
});
