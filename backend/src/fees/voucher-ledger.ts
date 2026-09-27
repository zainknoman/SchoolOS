import { Prisma } from '@prisma/client';

/**
 * BL-08: what a voucher asks for is the sum of ALL its lines (charges, discounts, scholarships,
 * waivers, late fees, carried balances); what was paid is the sum of its allocations (a payment
 * reversal allocates a negative amount). Every balance in the app uses this one rule.
 */
export function voucherTotals(voucher: {
  items: Array<{ amount: number }>;
  allocations?: Array<{ amount: number }>;
}): { totalAmount: number; amountPaid: number; amountDue: number } {
  const totalAmount = voucher.items.reduce((sum, i) => sum + i.amount, 0);
  const amountPaid = (voucher.allocations ?? []).reduce(
    (sum, a) => sum + a.amount,
    0,
  );
  return { totalAmount, amountPaid, amountDue: totalAmount - amountPaid };
}

/** Kinds staff may add to a voucher by hand; reductions are stored as negative lines. */
export const REDUCING_KINDS = ['DISCOUNT', 'SCHOLARSHIP', 'WAIVER'] as const;
export const ADJUSTMENT_KINDS = [...REDUCING_KINDS, 'LATE_FEE'] as const;
export type AdjustmentKind = (typeof ADJUSTMENT_KINDS)[number];

/**
 * Serialises every balance-changing write on one voucher (payments, adjustments, reversals, late
 * fees, carry-forward): two concurrent writes can no longer both pass the "not more than is due"
 * check.
 */
export async function lockVoucher(
  tx: Prisma.TransactionClient,
  voucherId: string,
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "FeeVoucher" WHERE id = ${voucherId} FOR UPDATE`;
}
