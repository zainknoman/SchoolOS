import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { FeeLedgerService } from './fee-ledger.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { OrgScopeService } from '../common/org-scope.service';
import type { FeeVouchersService } from './fee-vouchers.service';

describe('FeeLedgerService (BL-08)', () => {
  let prisma: Record<string, any>;
  let service: FeeLedgerService;
  let scope: { resolve: jest.Mock };
  const user = { id: 'u1', role: 'ACCOUNTS' };
  const schoolScope = (campusId: string | null = null) => ({
    unrestricted: false,
    denied: false,
    schoolId: 'school-1',
    campusId,
    allows: () => true,
  });

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn(),
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
      feeVoucher: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
      },
      feeItem: { create: jest.fn(), findUnique: jest.fn() },
      feePolicy: { findUnique: jest.fn(), upsert: jest.fn() },
      enrollment: { findFirst: jest.fn(), findMany: jest.fn() },
      studentFeeConcession: { create: jest.fn() },
      academicSession: { findFirst: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    scope = { resolve: jest.fn().mockResolvedValue(schoolScope()) };
    const vouchers = { getSummary: jest.fn().mockResolvedValue({ id: 'v1' }) };
    service = new FeeLedgerService(
      prisma as unknown as PrismaService,
      scope as unknown as OrgScopeService,
      vouchers as unknown as FeeVouchersService,
    );
  });

  const voucher = (items: object[], allocations: object[] = []) => ({
    id: 'v1',
    items,
    allocations,
  });

  describe('adjust', () => {
    it('stores a discount as a negative line with the reason', async () => {
      prisma.feeVoucher.findUnique.mockResolvedValue(
        voucher([{ amount: 1000, kind: 'CHARGE' }]),
      );
      prisma.feeItem.create.mockResolvedValue({ id: 'i1', amount: -200 });
      await service.adjust(
        'v1',
        { kind: 'DISCOUNT', amount: 200, reason: 'Sibling' },
        user,
      );
      expect(prisma.$queryRaw).toHaveBeenCalled(); // row lock
      expect(prisma.feeItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          kind: 'DISCOUNT',
          amount: -200,
          reason: 'Sibling',
          createdById: 'u1',
        }),
      });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('refuses a reduction larger than what is still due', async () => {
      prisma.feeVoucher.findUnique.mockResolvedValue(
        voucher([{ amount: 1000, kind: 'CHARGE' }], [{ amount: 900 }]),
      );
      await expect(
        service.adjust(
          'v1',
          { kind: 'WAIVER', amount: 101, reason: 'x' },
          user,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.feeItem.create).not.toHaveBeenCalled();
    });

    it('refuses any line on a voucher whose balance was carried forward', async () => {
      prisma.feeVoucher.findUnique.mockResolvedValue(
        voucher([
          { amount: 1000, kind: 'CHARGE' },
          { amount: -1000, kind: 'CARRIED_FORWARD' },
        ]),
      );
      await expect(
        service.adjust(
          'v1',
          { kind: 'LATE_FEE', amount: 50, reason: 'x' },
          user,
        ),
      ).rejects.toThrow(/carried forward/);
    });
  });

  describe('reverseItem', () => {
    it('refuses to reverse a charge, a reversal, or a line already reversed', async () => {
      prisma.feeItem.findUnique.mockResolvedValueOnce({ kind: 'CHARGE' });
      await expect(service.reverseItem('i1', 'x', user)).rejects.toThrow(
        /correct a charge with a waiver/,
      );
      prisma.feeItem.findUnique.mockResolvedValueOnce({
        kind: 'DISCOUNT',
        reversesItemId: 'i0',
      });
      await expect(service.reverseItem('i1', 'x', user)).rejects.toThrow(
        /cannot itself be reversed/,
      );
      prisma.feeItem.findUnique.mockResolvedValueOnce({
        kind: 'DISCOUNT',
        reversedBy: { id: 'r' },
      });
      await expect(service.reverseItem('i1', 'x', user)).rejects.toThrow(
        /already been reversed/,
      );
    });

    it('refuses to reverse a late fee that has been paid (would leave a credit)', async () => {
      prisma.feeItem.findUnique.mockResolvedValue({
        id: 'i1',
        feeVoucherId: 'v1',
        kind: 'LATE_FEE',
        amount: 100,
        reversesItemId: null,
        reversedBy: null,
      });
      prisma.feeVoucher.findUniqueOrThrow.mockResolvedValue(
        voucher(
          [
            { amount: 1000, kind: 'CHARGE' },
            { amount: 100, kind: 'LATE_FEE' },
          ],
          [{ amount: 1100 }],
        ),
      );
      await expect(service.reverseItem('i1', 'x', user)).rejects.toThrow(
        /credit/,
      );
    });

    it('adds the opposite line pointing at the original', async () => {
      prisma.feeItem.findUnique.mockResolvedValue({
        id: 'i1',
        feeVoucherId: 'v1',
        kind: 'DISCOUNT',
        label: 'Discount',
        amount: -200,
        reversesItemId: null,
        reversedBy: null,
      });
      prisma.feeVoucher.findUniqueOrThrow.mockResolvedValue(
        voucher([
          { amount: 1000, kind: 'CHARGE' },
          { amount: -200, kind: 'DISCOUNT' },
        ]),
      );
      prisma.feeItem.create.mockResolvedValue({ id: 'r1', feeVoucherId: 'v1' });
      await service.reverseItem('i1', 'mistake', user);
      expect(prisma.feeItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: 200,
          kind: 'DISCOUNT',
          reversesItemId: 'i1',
          reason: 'mistake',
        }),
      });
    });
  });

  describe('concessions', () => {
    it('needs exactly one of percent / amount', async () => {
      await expect(
        service.createConcession(
          's1',
          { kind: 'DISCOUNT', label: 'x', reason: 'y' },
          user,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createConcession(
          's1',
          { kind: 'DISCOUNT', label: 'x', reason: 'y', percent: 5, amount: 5 },
          user,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("belongs to the student's current school", async () => {
      prisma.enrollment.findFirst.mockResolvedValue({
        campus: { schoolId: 'school-9' },
      });
      prisma.studentFeeConcession.create.mockResolvedValue({ id: 'c1' });
      await service.createConcession(
        's1',
        { kind: 'SCHOLARSHIP', label: 'Merit', reason: 'y', percent: 50 },
        user,
      );
      expect(prisma.studentFeeConcession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ schoolId: 'school-9', percent: 50 }),
      });
    });
  });

  describe('policy and runs', () => {
    it('a campus-level admin cannot change the school-wide late fee', async () => {
      scope.resolve.mockResolvedValue(schoolScope('campus-1'));
      await expect(
        service.updatePolicy(
          { id: 'u2', role: 'SCHOOL_ADMIN' },
          { lateFeeAmount: 1 },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('another school cannot be named', async () => {
      await expect(service.getPolicy(user, 'school-2')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('no late fee configured -> nothing applied', async () => {
      prisma.feePolicy.findUnique.mockResolvedValue(null);
      prisma.academicSession.findFirst.mockResolvedValue({ id: 'sess' });
      await expect(service.applyLateFees(user)).resolves.toEqual({
        applied: 0,
        voucherIds: [],
      });
      expect(prisma.feeVoucher.findMany).not.toHaveBeenCalled();
    });
  });
});
