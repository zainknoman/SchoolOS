import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';
import type { RequestUser } from '../common/student-access.service';
import { activeSessionForSchool } from '../academic-session/active-session';
import { rethrowUniqueAsConflict } from '../common/prisma-create-guard';
import { FeeVouchersService, VoucherSummary } from './fee-vouchers.service';
import {
  ADJUSTMENT_KINDS,
  REDUCING_KINDS,
  lockVoucher,
  voucherTotals,
} from './voucher-ledger';
import type {
  AdjustVoucherDto,
  CarryForwardDto,
  CreateConcessionDto,
  UpdateFeePolicyDto,
} from './dto/fee-ledger.dto';

export interface FeePolicySummary {
  schoolId: string;
  lateFeeAmount: number;
  lateFeeGraceDays: number;
}

export interface OutstandingRow {
  studentId: string;
  grNumber: string;
  name: string;
  campusId: string | null;
  campusName: string | null;
  classId: string | null;
  className: string | null;
  sectionId: string | null;
  sectionName: string | null;
  vouchers: number;
  overdueVouchers: number;
  outstanding: number;
  overdueAmount: number;
  oldestDueDate: string | null;
}

export interface OutstandingReport {
  schoolId: string;
  totals: {
    students: number;
    defaulters: number;
    outstanding: number;
    overdue: number;
  };
  rows: OutstandingRow[];
}

export interface OutstandingFilter {
  schoolId?: string;
  campusId?: string;
  classId?: string;
  sectionId?: string;
  defaultersOnly?: boolean;
}

const startOfToday = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

/**
 * BL-08 (Q9 pilot subset): the fee ledger around vouchers. Every change to what a voucher asks
 * for is a new, audited line (never an edit — a DB trigger refuses edits); corrections are
 * reversing lines. Everything is confined to the caller's school (and campus, for a campus-level
 * user); SUPER_ADMIN names the school.
 */
@Injectable()
export class FeeLedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
    private readonly vouchers: FeeVouchersService,
  ) {}

  // --- scope -------------------------------------------------------------------------------

  private async schoolFor(
    user: RequestUser,
    requested: string | undefined,
    opts: { schoolWide?: boolean } = {},
  ): Promise<{ schoolId: string; campusId: string | null }> {
    const scope = await this.orgScope.resolve(user);
    if (scope.unrestricted) {
      if (!requested) {
        throw new BadRequestException('Name the school (schoolId)');
      }
      const school = await this.prisma.school.findUnique({
        where: { id: requested },
        select: { id: true },
      });
      if (!school) throw new NotFoundException('School not found');
      return { schoolId: requested, campusId: null };
    }
    if (scope.denied || !scope.schoolId) {
      throw new ForbiddenException('You do not have access to this school');
    }
    if (requested && requested !== scope.schoolId) {
      throw new ForbiddenException('You do not have access to this school');
    }
    if (opts.schoolWide && scope.campusId) {
      throw new ForbiddenException(
        'Only a school-wide administrator can change this',
      );
    }
    return { schoolId: scope.schoolId, campusId: scope.campusId };
  }

  private campusWhere(schoolId: string, campusId: string | null) {
    return campusId ? { id: campusId, schoolId } : { schoolId };
  }

  private async audit(
    userId: string,
    action: string,
    entity: string,
    entityId: string,
    metadata: object,
  ) {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        metadata: JSON.stringify(metadata),
      },
    });
  }

  // --- concessions -------------------------------------------------------------------------

  /** Caller access to the student is checked by the controller. */
  async createConcession(
    studentId: string,
    dto: CreateConcessionDto,
    user: RequestUser,
  ) {
    if ((dto.percent == null) === (dto.amount == null)) {
      throw new BadRequestException('Give exactly one of percent or amount');
    }
    const enrolment = await this.prisma.enrollment.findFirst({
      where: { studentId, status: 'ACTIVE' },
      select: { campus: { select: { schoolId: true } } },
    });
    if (!enrolment) {
      throw new BadRequestException(
        'This student has no active enrollment — a concession needs a school',
      );
    }
    const concession = await this.prisma.studentFeeConcession.create({
      data: {
        studentId,
        schoolId: enrolment.campus.schoolId,
        kind: dto.kind,
        label: dto.label,
        percent: dto.percent ?? null,
        amount: dto.amount ?? null,
        reason: dto.reason,
        createdById: user.id,
      },
    });
    await this.audit(
      user.id,
      'fee-concession.create',
      'StudentFeeConcession',
      concession.id,
      {
        studentId,
        kind: dto.kind,
        percent: dto.percent,
        amount: dto.amount,
        reason: dto.reason,
      },
    );
    return concession;
  }

  listConcessions(studentId: string) {
    return this.prisma.studentFeeConcession.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getConcession(id: string) {
    const c = await this.prisma.studentFeeConcession.findUnique({
      where: { id },
    });
    if (!c) throw new NotFoundException('Concession not found');
    return c;
  }

  /** Ending a concession affects only vouchers issued afterwards. */
  async endConcession(id: string, user: RequestUser) {
    const c = await this.getConcession(id);
    if (!c.isActive) {
      throw new BadRequestException('This concession has already ended');
    }
    const ended = await this.prisma.studentFeeConcession.update({
      where: { id },
      data: { isActive: false, endedAt: new Date(), endedById: user.id },
    });
    await this.audit(
      user.id,
      'fee-concession.end',
      'StudentFeeConcession',
      id,
      {
        studentId: c.studentId,
      },
    );
    return ended;
  }

  // --- adjustments -------------------------------------------------------------------------

  /** Caller access to the voucher's student is checked by the controller. */
  async adjust(
    voucherId: string,
    dto: AdjustVoucherDto,
    user: RequestUser,
  ): Promise<VoucherSummary> {
    const reducing = (REDUCING_KINDS as readonly string[]).includes(dto.kind);
    const item = await this.prisma.$transaction(async (tx) => {
      await lockVoucher(tx, voucherId);
      const voucher = await tx.feeVoucher.findUnique({
        where: { id: voucherId },
        include: { items: true, allocations: true },
      });
      if (!voucher) throw new NotFoundException('Fee voucher not found');
      this.assertNotCarried(voucher.items);
      const { amountDue } = voucherTotals(voucher);
      if (reducing && dto.amount > amountDue) {
        throw new BadRequestException(
          `A reduction cannot exceed what is still due (${amountDue}); refunds are not part of the pilot`,
        );
      }
      return tx.feeItem.create({
        data: {
          feeVoucherId: voucherId,
          kind: dto.kind,
          label: LABELS[dto.kind],
          amount: reducing ? -dto.amount : dto.amount,
          reason: dto.reason,
          createdById: user.id,
        },
      });
    });
    await this.audit(user.id, 'fee-voucher.adjust', 'FeeVoucher', voucherId, {
      itemId: item.id,
      kind: dto.kind,
      amount: item.amount,
      reason: dto.reason,
    });
    return this.vouchers.getSummary(voucherId);
  }

  async getItem(itemId: string) {
    const item = await this.prisma.feeItem.findUnique({
      where: { id: itemId },
      include: { feeVoucher: { select: { studentId: true } } },
    });
    if (!item) throw new NotFoundException('Voucher line not found');
    return item;
  }

  /** Cancels one adjustment line with an opposite line; charges are corrected with a waiver. */
  async reverseItem(
    itemId: string,
    reason: string,
    user: RequestUser,
  ): Promise<VoucherSummary> {
    const reversal = await this.prisma
      .$transaction(async (tx) => {
        const item = await tx.feeItem.findUnique({
          where: { id: itemId },
          include: { reversedBy: true },
        });
        if (!item) throw new NotFoundException('Voucher line not found');
        if (!(ADJUSTMENT_KINDS as readonly string[]).includes(item.kind)) {
          throw new BadRequestException(
            'Only a discount, scholarship, waiver or late fee can be reversed; correct a charge with a waiver',
          );
        }
        if (item.reversesItemId) {
          throw new BadRequestException('A reversal cannot itself be reversed');
        }
        if (item.reversedBy) {
          throw new BadRequestException('This line has already been reversed');
        }
        await lockVoucher(tx, item.feeVoucherId);
        const voucher = await tx.feeVoucher.findUniqueOrThrow({
          where: { id: item.feeVoucherId },
          include: { items: true, allocations: true },
        });
        this.assertNotCarried(voucher.items);
        if (voucherTotals(voucher).amountDue - item.amount < 0) {
          throw new BadRequestException(
            'Reversing this line would leave the voucher in credit; refunds are not part of the pilot',
          );
        }
        return tx.feeItem.create({
          data: {
            feeVoucherId: item.feeVoucherId,
            kind: item.kind,
            label: `Reversal: ${item.label}`,
            amount: -item.amount,
            reason,
            reversesItemId: item.id,
            createdById: user.id,
          },
        });
      })
      .catch((error: unknown) =>
        rethrowUniqueAsConflict(error, 'This line has already been reversed'),
      );
    await this.audit(user.id, 'fee-item.reverse', 'FeeItem', itemId, {
      voucherId: reversal.feeVoucherId,
      reversalId: reversal.id,
      reason,
    });
    return this.vouchers.getSummary(reversal.feeVoucherId);
  }

  private assertNotCarried(items: Array<{ kind: string }>) {
    if (items.some((i) => i.kind === 'CARRIED_FORWARD')) {
      throw new BadRequestException(
        "This voucher's balance was carried forward to a later session; use the opening-balance voucher",
      );
    }
  }

  // --- late fees ---------------------------------------------------------------------------

  async getPolicy(
    user: RequestUser,
    schoolId?: string,
  ): Promise<FeePolicySummary> {
    const school = await this.schoolFor(user, schoolId);
    return this.policyOf(school.schoolId);
  }

  private async policyOf(schoolId: string): Promise<FeePolicySummary> {
    const p = await this.prisma.feePolicy.findUnique({ where: { schoolId } });
    return {
      schoolId,
      lateFeeAmount: p?.lateFeeAmount ?? 0,
      lateFeeGraceDays: p?.lateFeeGraceDays ?? 0,
    };
  }

  async updatePolicy(
    user: RequestUser,
    dto: UpdateFeePolicyDto,
  ): Promise<FeePolicySummary> {
    const { schoolId } = await this.schoolFor(user, dto.schoolId, {
      schoolWide: true,
    });
    const data = {
      ...(dto.lateFeeAmount !== undefined
        ? { lateFeeAmount: dto.lateFeeAmount }
        : {}),
      ...(dto.lateFeeGraceDays !== undefined
        ? { lateFeeGraceDays: dto.lateFeeGraceDays }
        : {}),
      updatedById: user.id,
    };
    await this.prisma.feePolicy.upsert({
      where: { schoolId },
      create: { schoolId, ...data },
      update: data,
    });
    const saved = await this.policyOf(schoolId);
    await this.audit(
      user.id,
      'fee-policy.update',
      'FeePolicy',
      schoolId,
      saved,
    );
    return saved;
  }

  /**
   * Adds the school's late fee once to every voucher of the active session that is still unpaid
   * (fully or partly) more than `lateFeeGraceDays` after its due date. A reversed late fee does
   * not count, so a later run may apply it again. Earlier sessions are left to carry-forward.
   */
  async applyLateFees(
    user: RequestUser,
    requestedSchoolId?: string,
  ): Promise<{ applied: number; voucherIds: string[] }> {
    const { schoolId, campusId } = await this.schoolFor(
      user,
      requestedSchoolId,
    );
    const policy = await this.policyOf(schoolId);
    const session = await activeSessionForSchool(this.prisma, schoolId);
    if (policy.lateFeeAmount <= 0 || !session) {
      return { applied: 0, voucherIds: [] };
    }
    const cutoff = startOfToday();
    cutoff.setUTCDate(cutoff.getUTCDate() - policy.lateFeeGraceDays);
    const candidates = await this.prisma.feeVoucher.findMany({
      where: {
        academicSessionId: session.id,
        kind: 'REGULAR',
        dueDate: { lt: cutoff },
        student: {
          enrollments: {
            some: {
              status: 'ACTIVE',
              academicSessionId: session.id,
              campus: this.campusWhere(schoolId, campusId),
            },
          },
        },
        items: {
          none: {
            kind: 'LATE_FEE',
            amount: { gt: 0 },
            reversedBy: { is: null },
          },
        },
      },
      select: { id: true, dueDate: true },
    });

    const voucherIds: string[] = [];
    for (const c of candidates) {
      const applied = await this.prisma.$transaction(async (tx) => {
        await lockVoucher(tx, c.id);
        const v = await tx.feeVoucher.findUniqueOrThrow({
          where: { id: c.id },
          include: {
            items: { include: { reversedBy: true } },
            allocations: true,
          },
        });
        const hasLateFee = v.items.some(
          (i) => i.kind === 'LATE_FEE' && i.amount > 0 && !i.reversedBy,
        );
        if (hasLateFee || voucherTotals(v).amountDue <= 0) return false;
        await tx.feeItem.create({
          data: {
            feeVoucherId: v.id,
            kind: 'LATE_FEE',
            label: LABELS.LATE_FEE,
            amount: policy.lateFeeAmount,
            reason: `Unpaid after ${c.dueDate.toISOString().slice(0, 10)}`,
            createdById: user.id,
          },
        });
        return true;
      });
      if (applied) voucherIds.push(c.id);
    }
    await this.audit(user.id, 'fee-voucher.late-fees', 'School', schoolId, {
      campusId,
      amount: policy.lateFeeAmount,
      graceDays: policy.lateFeeGraceDays,
      applied: voucherIds.length,
      voucherIds,
    });
    return { applied: voucherIds.length, voucherIds };
  }

  // --- carry-forward -----------------------------------------------------------------------

  /**
   * Moves every unpaid balance of an EARLIER session of this school into an opening-balance
   * voucher (month "OPENING") of the active session, for the students enrolled in it. Nothing old
   * is edited: the old voucher gets a CARRIED_FORWARD line (-balance) and the new one an
   * OPENING_BALANCE line (+balance), each pointing at the other voucher. Running it again only
   * carries what is still unpaid, so it is idempotent.
   */
  async carryForward(
    user: RequestUser,
    dto: CarryForwardDto,
  ): Promise<{ students: number; vouchers: number; amount: number }> {
    const { schoolId, campusId } = await this.schoolFor(user, dto.schoolId);
    const session = await activeSessionForSchool(this.prisma, schoolId);
    if (!session) {
      throw new BadRequestException(
        'No active academic session for this school — nothing to carry into',
      );
    }
    const enrolled = await this.prisma.enrollment.findMany({
      where: {
        status: 'ACTIVE',
        academicSessionId: session.id,
        campus: this.campusWhere(schoolId, campusId),
      },
      select: { studentId: true },
    });
    const studentIds = [...new Set(enrolled.map((e) => e.studentId))];
    const old = await this.prisma.feeVoucher.findMany({
      where: {
        studentId: { in: studentIds },
        academicSessionId: { not: session.id },
        academicSession: { schoolId },
      },
      include: {
        items: true,
        allocations: true,
        academicSession: { select: { label: true } },
      },
      orderBy: { dueDate: 'asc' },
    });
    const byStudent = new Map<string, typeof old>();
    for (const v of old) {
      if (voucherTotals(v).amountDue <= 0) continue;
      byStudent.set(v.studentId, [...(byStudent.get(v.studentId) ?? []), v]);
    }

    let students = 0;
    let vouchers = 0;
    let amount = 0;
    for (const [studentId, list] of byStudent) {
      const moved = await this.prisma
        .$transaction(async (tx) => {
          let carried = 0;
          let count = 0;
          let opening = await tx.feeVoucher.findUnique({
            where: {
              studentId_academicSessionId_month: {
                studentId,
                academicSessionId: session.id,
                month: 'OPENING',
              },
            },
          });
          for (const v of list) {
            await lockVoucher(tx, v.id);
            const fresh = await tx.feeVoucher.findUniqueOrThrow({
              where: { id: v.id },
              include: { items: true, allocations: true },
            });
            const due = voucherTotals(fresh).amountDue;
            if (due <= 0) continue;
            opening ??= await tx.feeVoucher.create({
              data: {
                studentId,
                academicSessionId: session.id,
                month: 'OPENING',
                kind: 'OPENING_BALANCE',
                issueDate: new Date(),
                dueDate: new Date(dto.dueDate),
              },
            });
            await tx.feeItem.create({
              data: {
                feeVoucherId: opening.id,
                kind: 'OPENING_BALANCE',
                label: `Balance from ${v.academicSession.label} ${v.month}`,
                amount: due,
                carryVoucherId: v.id,
                createdById: user.id,
              },
            });
            await tx.feeItem.create({
              data: {
                feeVoucherId: v.id,
                kind: 'CARRIED_FORWARD',
                label: `Carried forward to ${session.label}`,
                amount: -due,
                carryVoucherId: opening.id,
                createdById: user.id,
              },
            });
            carried += due;
            count += 1;
          }
          return { carried, count };
        })
        .catch((error: unknown) =>
          rethrowUniqueAsConflict(
            error,
            'A carry-forward for this student ran at the same time; run it again',
          ),
        );
      if (moved.count) {
        students += 1;
        vouchers += moved.count;
        amount += moved.carried;
      }
    }
    await this.audit(user.id, 'fee-voucher.carry-forward', 'School', schoolId, {
      campusId,
      sessionId: session.id,
      students,
      vouchers,
      amount,
    });
    return { students, vouchers, amount };
  }

  // --- outstanding / defaulters ------------------------------------------------------------

  /**
   * Per-student balances of this school's vouchers (all sessions). A defaulter is a student with
   * an overdue balance (due date passed, not fully paid). Filters refer to the student's current
   * (ACTIVE) enrollment; section/class/campus access is checked by the controller.
   */
  async outstanding(
    user: RequestUser,
    filter: OutstandingFilter,
  ): Promise<OutstandingReport> {
    const { schoolId, campusId } = await this.schoolFor(user, filter.schoolId);
    const campusWhere = this.campusWhere(
      schoolId,
      campusId ?? filter.campusId ?? null,
    );
    const vouchers = await this.prisma.feeVoucher.findMany({
      where: {
        academicSession: { schoolId },
        student: { enrollments: { some: { campus: campusWhere } } },
      },
      select: {
        studentId: true,
        dueDate: true,
        items: { select: { amount: true } },
        allocations: { select: { amount: true } },
      },
    });
    const today = startOfToday();
    const agg = new Map<
      string,
      Pick<
        OutstandingRow,
        'vouchers' | 'overdueVouchers' | 'outstanding' | 'overdueAmount'
      > & { oldest: Date | null }
    >();
    for (const v of vouchers) {
      const due = voucherTotals(v).amountDue;
      if (due <= 0) continue;
      const a = agg.get(v.studentId) ?? {
        vouchers: 0,
        overdueVouchers: 0,
        outstanding: 0,
        overdueAmount: 0,
        oldest: null,
      };
      a.vouchers += 1;
      a.outstanding += due;
      if (v.dueDate < today) {
        a.overdueVouchers += 1;
        a.overdueAmount += due;
        if (!a.oldest || v.dueDate < a.oldest) a.oldest = v.dueDate;
      }
      agg.set(v.studentId, a);
    }

    const students = await this.prisma.student.findMany({
      where: { id: { in: [...agg.keys()] } },
      select: {
        id: true,
        grNumber: true,
        name: true,
        enrollments: {
          where: { status: 'ACTIVE', campus: { schoolId } },
          orderBy: { startDate: 'desc' },
          take: 1,
          select: {
            campus: { select: { id: true, name: true } },
            section: {
              select: {
                id: true,
                name: true,
                class: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
    let rows: OutstandingRow[] = students.map((s) => {
      const a = agg.get(s.id)!;
      const e = s.enrollments[0];
      return {
        studentId: s.id,
        grNumber: s.grNumber,
        name: s.name,
        campusId: e?.campus.id ?? null,
        campusName: e?.campus.name ?? null,
        classId: e?.section?.class.id ?? null,
        className: e?.section?.class.name ?? null,
        sectionId: e?.section?.id ?? null,
        sectionName: e?.section?.name ?? null,
        vouchers: a.vouchers,
        overdueVouchers: a.overdueVouchers,
        outstanding: a.outstanding,
        overdueAmount: a.overdueAmount,
        oldestDueDate: a.oldest ? a.oldest.toISOString().slice(0, 10) : null,
      };
    });
    if (filter.sectionId)
      rows = rows.filter((r) => r.sectionId === filter.sectionId);
    if (filter.classId) rows = rows.filter((r) => r.classId === filter.classId);
    if (filter.defaultersOnly) rows = rows.filter((r) => r.overdueAmount > 0);
    rows.sort(
      (x, y) =>
        y.overdueAmount - x.overdueAmount ||
        y.outstanding - x.outstanding ||
        x.grNumber.localeCompare(y.grNumber),
    );
    return {
      schoolId,
      totals: {
        students: rows.length,
        defaulters: rows.filter((r) => r.overdueAmount > 0).length,
        outstanding: rows.reduce((s, r) => s + r.outstanding, 0),
        overdue: rows.reduce((s, r) => s + r.overdueAmount, 0),
      },
      rows,
    };
  }
}

const LABELS: Record<(typeof ADJUSTMENT_KINDS)[number], string> = {
  DISCOUNT: 'Discount',
  SCHOLARSHIP: 'Scholarship',
  WAIVER: 'Waiver',
  LATE_FEE: 'Late fee',
};
