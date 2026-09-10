import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  PAYMENT_GATEWAY_ADAPTER_FACTORY,
  PaymentGatewayAdapterFactory,
  PaymentMethod,
} from './payment-gateway-adapter-factory';

export interface PaymentSummary {
  id: string;
  amount: number;
  method: string;
  status: string;
  voucherIds: string[];
  receiptId: string | null;
  createdAt: string;
}

@Injectable()
export class FeePaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY_ADAPTER_FACTORY) private readonly gatewayFactory: PaymentGatewayAdapterFactory,
  ) {}

  async pay(
    voucherId: string,
    actingUserId: string,
    method: PaymentMethod,
  ): Promise<{ redirectUrl: string; paymentId: string }> {
    const voucher = await this.prisma.feeVoucher.findUnique({
      where: { id: voucherId },
      include: { items: true, allocations: true },
    });
    if (!voucher) {
      throw new NotFoundException('Fee voucher not found');
    }
    const totalAmount = voucher.items.reduce((sum, i) => sum + i.amount, 0);
    const alreadyAllocated = voucher.allocations.reduce((sum, a) => sum + a.amount, 0);
    const amountDue = totalAmount - alreadyAllocated;
    if (amountDue <= 0) {
      throw new BadRequestException('This voucher is already fully paid');
    }

    const reference = `pay_${randomUUID()}`;
    const adapter = this.gatewayFactory.getAdapter(method);
    const { redirectUrl, gatewayReference } = await adapter.initiate({ amount: amountDue, reference });

    // The allocation is created eagerly here (not on confirm) so amountDue immediately reflects a
    // payment in flight — a failed confirm removes it again (see confirmFromWebhook() below), so
    // a payment that never completes never permanently reduces what's due.
    const payment = await this.prisma.feePayment.create({
      data: {
        amount: amountDue,
        method,
        status: 'pending',
        reference: gatewayReference,
        allocations: { create: [{ feeVoucherId: voucherId, amount: amountDue }] },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'fee-payment.initiate',
        entity: 'FeePayment',
        entityId: payment.id,
        metadata: JSON.stringify({ voucherId, amount: amountDue, method }),
      },
    });

    return { redirectUrl, paymentId: payment.id };
  }

  async confirm(paymentId: string, actingUserId: string): Promise<PaymentSummary> {
    const payment = await this.prisma.feePayment.findUnique({
      where: { id: paymentId },
      include: { allocations: true, receipt: true },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.status === 'completed') {
      // Idempotent — a retried confirm call after the first already succeeded is a no-op.
      return this.toSummary(payment);
    }
    if (payment.status !== 'pending') {
      throw new BadRequestException(`Cannot confirm a payment in status "${payment.status}"`);
    }

    const { status } = await this.gateway.confirm(payment.reference!);

    if (status === 'failed') {
      const updated = await this.prisma.$transaction(async (tx) => {
        // Zero the allocation's amount rather than deleting the row: FeeVouchersService's
        // amountDue = sum(items) - sum(allocations) is unaffected by a zero-amount allocation, so
        // the voucher still correctly shows as unpaid/available for a fresh attempt — but the
        // feeVoucherId FK stays intact, so FeesController can still derive studentId from
        // payment.allocations[0]?.feeVoucher.studentId for ownership checks on a retried
        // confirm() or a receipt.pdf request. Deleting the row instead orphans the payment: it
        // becomes unreachable (404 "Payment not found") even to its rightful owner.
        await tx.feePaymentAllocation.updateMany({
          where: { feePaymentId: paymentId },
          data: { amount: 0 },
        });
        return tx.feePayment.update({
          where: { id: paymentId },
          data: { status: 'failed' },
          include: { allocations: true, receipt: true },
        });
      });

      await this.prisma.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'fee-payment.confirm',
          entity: 'FeePayment',
          entityId: paymentId,
          metadata: JSON.stringify({ status: 'failed' }),
        },
      });

      return this.toSummary(updated);
    }

    const receiptNumber = `RCPT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${paymentId.slice(0, 6)}`;
    const updated = await this.prisma.feePayment.update({
      where: { id: paymentId },
      data: { status: 'completed', receipt: { create: { receiptNumber } } },
      include: { allocations: true, receipt: true },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'fee-payment.confirm',
        entity: 'FeePayment',
        entityId: paymentId,
        metadata: JSON.stringify({ status: 'completed' }),
      },
    });

    return this.toSummary(updated);
  }

  async getForStudent(studentId: string): Promise<PaymentSummary[]> {
    const payments = await this.prisma.feePayment.findMany({
      where: { allocations: { some: { feeVoucher: { studentId } } } },
      include: { allocations: true, receipt: true },
      orderBy: { createdAt: 'desc' },
    });
    return payments.map((p) => this.toSummary(p));
  }

  async getById(id: string) {
    const payment = await this.prisma.feePayment.findUnique({
      where: { id },
      include: {
        allocations: { include: { feeVoucher: { include: { student: true } } } },
        receipt: true,
      },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  private toSummary(payment: {
    id: string;
    amount: number;
    method: string;
    status: string;
    allocations: Array<{ feeVoucherId: string }>;
    receipt: { id: string } | null;
    createdAt: Date;
  }): PaymentSummary {
    return {
      id: payment.id,
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
      voucherIds: payment.allocations.map((a) => a.feeVoucherId),
      receiptId: payment.receipt?.id ?? null,
      createdAt: payment.createdAt.toISOString(),
    };
  }
}
