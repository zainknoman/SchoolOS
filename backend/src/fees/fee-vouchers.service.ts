import { activeSessionForSchool } from '../academic-session/active-session';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { rethrowUniqueAsConflict } from '../common/prisma-create-guard';
import { PrismaService } from '../prisma/prisma.service';
import { IssueVouchersDto } from './dto/issue-vouchers.dto';
import { voucherTotals } from './voucher-ledger';

export interface VoucherLine {
  id?: string;
  label: string;
  amount: number;
  kind: string;
  reason: string | null;
  reversesItemId: string | null;
  reversed: boolean;
  createdAt: string | null;
}

export interface VoucherSummary {
  id: string;
  studentId: string;
  month: string;
  /** BL-08: REGULAR, or OPENING_BALANCE (arrears carried forward from an earlier session). */
  kind: string;
  dueDate: string;
  items: VoucherLine[];
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  // BL-08: carried_forward = nothing left because the balance moved to an opening-balance voucher.
  status: 'unpaid' | 'partial' | 'paid' | 'overdue' | 'carried_forward';
}

@Injectable()
export class FeeVouchersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The caller never picks a session: it is the active session of the students' school (BL-01).
   * One call issues for one school's students only.
   */
  async issue(
    dto: IssueVouchersDto,
    actingUserId: string,
  ): Promise<VoucherSummary[]> {
    if ((dto.studentIds?.length ? 1 : 0) + (dto.sectionId ? 1 : 0) !== 1) {
      throw new BadRequestException(
        'Provide exactly one of studentIds or sectionId',
      );
    }

    const structures = await this.prisma.feeStructure.findMany({
      where: { id: { in: dto.feeStructureIds } },
    });
    if (structures.length !== dto.feeStructureIds.length) {
      throw new BadRequestException('One or more feeStructureIds do not exist');
    }
    // BL-03: only ACTIVE or LOCKED (already invoiced) structures can be issued.
    const notIssuable = structures.filter(
      (s) => s.status === 'DRAFT' || s.status === 'ARCHIVED',
    );
    if (notIssuable.length) {
      throw new BadRequestException(
        `Fee structure(s) not issuable (draft or archived): ${notIssuable.map((s) => s.name).join(', ')}`,
      );
    }

    const studentIds = dto.studentIds?.length
      ? dto.studentIds
      : (
          await this.prisma.enrollment.findMany({
            where: { sectionId: dto.sectionId, status: 'ACTIVE' },
            select: { studentId: true },
          })
        ).map((e) => e.studentId);

    const schools = await this.prisma.school.findMany({
      where: {
        campuses: {
          some: {
            enrollments: {
              some: { studentId: { in: studentIds }, status: 'ACTIVE' },
            },
          },
        },
      },
      select: { id: true },
    });
    const schoolIds = schools.map((s) => s.id);
    if (schoolIds.length !== 1) {
      throw new BadRequestException(
        schoolIds.length === 0
          ? 'None of these students has an active enrollment'
          : 'Issue vouchers for one school at a time',
      );
    }
    // BL-03: a school's vouchers use only that school's structures (legacy school-less ones allowed).
    const foreign = structures.filter(
      (s) => s.schoolId !== null && s.schoolId !== schoolIds[0],
    );
    if (foreign.length) {
      throw new BadRequestException(
        `Fee structure(s) of another school: ${foreign.map((s) => s.name).join(', ')}`,
      );
    }
    const activeSession = await activeSessionForSchool(
      this.prisma,
      schoolIds[0],
    );
    if (!activeSession) {
      throw new BadRequestException(
        'No active academic session for this school — cannot issue a voucher',
      );
    }

    const existing = await this.prisma.feeVoucher.findMany({
      where: {
        studentId: { in: studentIds },
        academicSessionId: activeSession.id,
        month: dto.month,
      },
      select: { studentId: true },
    });
    if (existing.length > 0) {
      throw new BadRequestException(
        `A voucher already exists for ${dto.month} for student(s): ${existing.map((e) => e.studentId).join(', ')}`,
      );
    }

    // BL-08: each active discount/scholarship of the student becomes its own (negative) line,
    // never more than the charges of this voucher.
    const concessions = await this.prisma.studentFeeConcession.findMany({
      where: {
        studentId: { in: studentIds },
        schoolId: schoolIds[0],
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    const charges = structures.reduce((sum, st) => sum + st.amount, 0);
    const concessionLines = (studentId: string) => {
      let left = charges;
      const lines: Array<{
        label: string;
        amount: number;
        kind: 'DISCOUNT' | 'SCHOLARSHIP';
        reason: string;
        concessionId: string;
        createdById: string;
      }> = [];
      for (const c of concessions.filter((x) => x.studentId === studentId)) {
        const wanted =
          c.percent != null
            ? Math.round((charges * c.percent) / 100)
            : (c.amount ?? 0);
        const off = Math.min(wanted, left);
        if (off <= 0) continue;
        left -= off;
        lines.push({
          label: c.label,
          amount: -off,
          kind: c.kind,
          reason: c.reason,
          concessionId: c.id,
          createdById: actingUserId,
        });
      }
      return lines;
    };

    const dueDate = new Date(dto.dueDate);
    // BL-53: all-or-nothing, and a voucher issued concurrently for the same student/month hits the
    // unique index (M12) -> 409 instead of a duplicate.
    const created = await this.prisma
      .$transaction(async (tx) => {
        const out: VoucherSummary[] = [];
        for (const studentId of studentIds) {
          const voucher = await tx.feeVoucher.create({
            data: {
              studentId,
              academicSessionId: activeSession.id,
              month: dto.month,
              issueDate: new Date(),
              dueDate,
              items: {
                create: [
                  ...structures.map((s) => ({
                    feeStructureId: s.id,
                    label: s.name,
                    amount: s.amount,
                  })),
                  ...concessionLines(studentId),
                ],
              },
            },
            include: { items: true },
          });
          out.push(this.toSummary(voucher, 0));
        }
        return out;
      })
      .catch((error: unknown) =>
        rethrowUniqueAsConflict(
          error,
          `A voucher for ${dto.month} was issued for one of these students at the same time; nothing was created`,
        ),
      );

    // BL-03: once invoiced, a structure is LOCKED (its name/amount can no longer change).
    await this.prisma.feeStructure.updateMany({
      where: { id: { in: structures.map((s) => s.id) }, status: 'ACTIVE' },
      data: { status: 'LOCKED' },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'fee-voucher.issue',
        entity: 'FeeVoucher',
        entityId: created.map((v) => v.id).join(','),
        metadata: JSON.stringify({
          studentCount: studentIds.length,
          month: dto.month,
        }),
      },
    });

    return created;
  }

  async getForStudent(studentId: string): Promise<VoucherSummary[]> {
    const vouchers = await this.prisma.feeVoucher.findMany({
      where: { studentId },
      include: {
        items: { orderBy: { createdAt: 'asc' }, include: { reversedBy: true } },
        allocations: true,
      },
      orderBy: { issueDate: 'desc' },
    });
    return vouchers.map((v) => this.toSummary(v, voucherTotals(v).amountPaid));
  }

  /** BL-08: one voucher as the ledger screens show it. */
  async getSummary(id: string): Promise<VoucherSummary> {
    const v = await this.prisma.feeVoucher.findUnique({
      where: { id },
      include: {
        items: { orderBy: { createdAt: 'asc' }, include: { reversedBy: true } },
        allocations: true,
      },
    });
    if (!v) {
      throw new NotFoundException('Fee voucher not found');
    }
    return this.toSummary(v, voucherTotals(v).amountPaid);
  }

  async getById(id: string) {
    const voucher = await this.prisma.feeVoucher.findUnique({
      where: { id },
      include: { items: true, allocations: true, student: true },
    });
    if (!voucher) {
      throw new NotFoundException('Fee voucher not found');
    }
    return voucher;
  }

  toSummary(
    voucher: {
      id: string;
      studentId: string;
      month: string;
      kind?: string;
      dueDate: Date;
      items: Array<{
        id?: string;
        label: string;
        amount: number;
        kind?: string;
        reason?: string | null;
        reversesItemId?: string | null;
        reversedBy?: unknown;
        createdAt?: Date;
      }>;
    },
    amountPaid: number,
  ): VoucherSummary {
    const totalAmount = voucher.items.reduce((sum, i) => sum + i.amount, 0);
    const amountDue = totalAmount - amountPaid;
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    let status: VoucherSummary['status'];
    if (amountDue <= 0)
      status = voucher.items.some((i) => i.kind === 'CARRIED_FORWARD')
        ? 'carried_forward'
        : 'paid';
    else if (amountPaid > 0) status = 'partial';
    else if (voucher.dueDate < startOfToday) status = 'overdue';
    else status = 'unpaid';
    return {
      id: voucher.id,
      studentId: voucher.studentId,
      month: voucher.month,
      kind: voucher.kind ?? 'REGULAR',
      dueDate: voucher.dueDate.toISOString().slice(0, 10),
      items: voucher.items.map((i) => ({
        id: i.id,
        label: i.label,
        amount: i.amount,
        kind: i.kind ?? 'CHARGE',
        reason: i.reason ?? null,
        reversesItemId: i.reversesItemId ?? null,
        reversed: !!i.reversedBy,
        createdAt: i.createdAt ? i.createdAt.toISOString() : null,
      })),
      totalAmount,
      amountPaid,
      amountDue,
      status,
    };
  }
}
