import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_GATEWAY_ADAPTER_FACTORY } from './payment-gateway-adapter-factory';
import { lockVoucher, voucherTotals } from './voucher-ledger';
import { rethrowUniqueAsConflict } from '../common/prisma-create-guard';
import type {
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
  /** BL-08: set on a reversal (negative amount) — the payment it cancels. */
  reversesPaymentId: string | null;
  reversed: boolean;
  note: string | null;
  createdAt: string;
}

@Injectable()
export class FeePaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY_ADAPTER_FACTORY)
    private readonly gatewayFactory: PaymentGatewayAdapterFactory,
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
    const alreadyAllocated = voucher.allocations.reduce(
      (sum, a) => sum + a.amount,
      0,
    );
    const amountDue = totalAmount - alreadyAllocated;
    if (amountDue <= 0) {
      throw new BadRequestException('This voucher is already fully paid');
    }

    const reference = `pay_${randomUUID()}`;
    const adapter = this.gatewayFactory.getAdapter(method);
    const { redirectUrl, gatewayReference } = await adapter.initiate({
      amount: amountDue,
      reference,
    });

    // The allocation is created eagerly here (not on confirm) so amountDue immediately reflects a
    // payment in flight — a failed confirm removes it again (see confirmFromWebhook() below), so
    // a payment that never completes never permanently reduces what's due.
    const payment = await this.prisma.feePayment.create({
      data: {
        amount: amountDue,
        method,
        status: 'pending',
        reference: gatewayReference,
        allocations: {
          create: [{ feeVoucherId: voucherId, amount: amountDue }],
        },
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

  /**
   * The only way a payment becomes completed/failed — called exclusively from
   * PaymentsWebhookController after that controller has already verified the calling gateway's
   * signature. Looks the payment up by its unique `reference`, never by an id a client could
   * supply, so nothing outside a verified webhook can move a payment out of "pending".
   */
  async confirmFromWebhook(
    reference: string,
    status: 'completed' | 'failed',
  ): Promise<PaymentSummary> {
    const payment = await this.prisma.feePayment.findUnique({
      where: { reference },
      include: { allocations: true, receipt: true },
    });
    if (!payment) {
      throw new NotFoundException(
        `No payment found for reference "${reference}"`,
      );
    }
    if (payment.status !== 'pending') {
      // Idempotent — gateways retry webhook delivery; a repeat call for an already-resolved
      // payment must not run the transition twice.
      return this.toSummary(payment);
    }

    if (status === 'failed') {
      const updated = await this.prisma.$transaction(async (tx) => {
        // Zero the allocation's amount rather than deleting the row: FeeVouchersService's
        // amountDue = sum(items) - sum(allocations) is unaffected by a zero-amount allocation, so
        // the voucher still correctly shows as unpaid/available for a fresh attempt — but the
        // feeVoucherId FK stays intact, so FeesController can still derive studentId from
        // payment.allocations[0]?.feeVoucher.studentId for a receipt.pdf request. Deleting the
        // row instead orphans the payment: it becomes unreachable (404 "Payment not found") even
        // to its rightful owner.
        await tx.feePaymentAllocation.updateMany({
          where: { feePaymentId: payment.id },
          data: { amount: 0 },
        });
        return tx.feePayment.update({
          where: { id: payment.id },
          data: { status: 'failed' },
          include: { allocations: true, receipt: true },
        });
      });

      await this.prisma.auditLog.create({
        data: {
          userId: null,
          action: 'fee-payment.webhook-confirm',
          entity: 'FeePayment',
          entityId: payment.id,
          metadata: JSON.stringify({ status: 'failed' }),
        },
      });

      return this.toSummary(updated);
    }

    const receiptNumber = `RCPT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${payment.id.slice(0, 6)}`;
    const updated = await this.prisma.feePayment.update({
      where: { id: payment.id },
      data: { status: 'completed', receipt: { create: { receiptNumber } } },
      include: { allocations: true, receipt: true },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: null,
        action: 'fee-payment.webhook-confirm',
        entity: 'FeePayment',
        entityId: payment.id,
        metadata: JSON.stringify({ status: 'completed' }),
      },
    });

    return this.toSummary(updated);
  }

  /**
   * Staff-recorded cash/bank-transfer payment — no gateway involved, so it's created directly as
   * `completed` (staff are asserting money was already received in person/via bank), unlike
   * pay()'s gateway flow which starts `pending` and waits for the webhook.
   */
  async reconcile(
    voucherId: string,
    dto: { amount: number; method: 'cash' | 'bank_transfer'; note?: string },
    actingUserId: string,
  ): Promise<PaymentSummary> {
    const receiptNumber = `RCPT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID().slice(0, 6)}`;
    // BL-08: the voucher row is locked so two payments recorded at once cannot overpay it.
    const payment = await this.prisma.$transaction(async (tx) => {
      await lockVoucher(tx, voucherId);
      const voucher = await tx.feeVoucher.findUnique({
        where: { id: voucherId },
        include: { items: true, allocations: true },
      });
      if (!voucher) {
        throw new NotFoundException('Fee voucher not found');
      }
      const { amountDue } = voucherTotals(voucher);
      if (dto.amount > amountDue) {
        throw new BadRequestException(
          `Amount exceeds this voucher's remaining balance of ${amountDue}`,
        );
      }
      return tx.feePayment.create({
        data: {
          amount: dto.amount,
          method: dto.method,
          status: 'completed',
          reference: `manual_${randomUUID()}`,
          note: dto.note,
          recordedById: actingUserId,
          allocations: {
            create: [{ feeVoucherId: voucherId, amount: dto.amount }],
          },
          receipt: { create: { receiptNumber } },
        },
        include: { allocations: true, receipt: true },
      });
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'fee-payment.reconcile',
        entity: 'FeePayment',
        entityId: payment.id,
        metadata: JSON.stringify({
          voucherId,
          amount: dto.amount,
          method: dto.method,
          note: dto.note,
        }),
      },
    });

    return this.toSummary(payment);
  }

  /**
   * BL-08: a completed manual payment recorded by mistake is cancelled by a reversing payment
   * (negative amount, same voucher allocation, audited) — the original and its receipt stay.
   * Gateway payments are refunded through the gateway (BL-24), not here.
   */
  async reverse(
    paymentId: string,
    reason: string,
    actingUserId: string,
  ): Promise<PaymentSummary> {
    const reversal = await this.prisma
      .$transaction(async (tx) => {
        const original = await tx.feePayment.findUnique({
          where: { id: paymentId },
          include: { allocations: true, reversedBy: true },
        });
        if (!original) {
          throw new NotFoundException('Payment not found');
        }
        if (original.reversesPaymentId) {
          throw new BadRequestException('A reversal cannot itself be reversed');
        }
        if (original.reversedBy) {
          throw new BadRequestException(
            'This payment has already been reversed',
          );
        }
        if (
          original.status !== 'completed' ||
          !['cash', 'bank_transfer'].includes(original.method)
        ) {
          throw new BadRequestException(
            'Only a completed cash or bank-transfer payment can be reversed',
          );
        }
        for (const a of original.allocations) {
          await lockVoucher(tx, a.feeVoucherId);
        }
        return tx.feePayment.create({
          data: {
            amount: -original.amount,
            method: original.method,
            status: 'completed',
            reference: `reversal_${randomUUID()}`,
            reversesPaymentId: original.id,
            note: reason,
            recordedById: actingUserId,
            allocations: {
              create: original.allocations.map((a) => ({
                feeVoucherId: a.feeVoucherId,
                amount: -a.amount,
              })),
            },
          },
          include: { allocations: true, receipt: true, reversedBy: true },
        });
      })
      .catch((error: unknown) =>
        rethrowUniqueAsConflict(
          error,
          'This payment has already been reversed',
        ),
      );

    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'fee-payment.reverse',
        entity: 'FeePayment',
        entityId: paymentId,
        metadata: JSON.stringify({ reversalId: reversal.id, reason }),
      },
    });
    return this.toSummary(reversal);
  }

  async getForStudent(studentId: string): Promise<PaymentSummary[]> {
    const payments = await this.prisma.feePayment.findMany({
      where: { allocations: { some: { feeVoucher: { studentId } } } },
      include: { allocations: true, receipt: true, reversedBy: true },
      orderBy: { createdAt: 'desc' },
    });
    return payments.map((p) => this.toSummary(p));
  }

  async getById(id: string) {
    const payment = await this.prisma.feePayment.findUnique({
      where: { id },
      include: {
        allocations: {
          include: { feeVoucher: { include: { student: true } } },
        },
        receipt: true,
      },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  toSummary(payment: {
    id: string;
    amount: number;
    method: string;
    status: string;
    allocations: Array<{ feeVoucherId: string }>;
    receipt: { id: string } | null;
    reversesPaymentId?: string | null;
    reversedBy?: unknown;
    note?: string | null;
    createdAt: Date;
  }): PaymentSummary {
    return {
      id: payment.id,
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
      voucherIds: payment.allocations.map((a) => a.feeVoucherId),
      receiptId: payment.receipt?.id ?? null,
      reversesPaymentId: payment.reversesPaymentId ?? null,
      reversed: !!payment.reversedBy,
      note: payment.note ?? null,
      createdAt: payment.createdAt.toISOString(),
    };
  }
}
