import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IssueVouchersDto } from './dto/issue-vouchers.dto';

export interface VoucherSummary {
  id: string;
  studentId: string;
  month: string;
  dueDate: string;
  items: Array<{ label: string; amount: number }>;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue';
}

@Injectable()
export class FeeVouchersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * This system runs a single active AcademicSession at a time (same assumption
   * EnrollmentService already makes) — the caller never picks one, it's resolved here.
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

    const activeSession = await this.prisma.academicSession.findFirst({
      where: { isActive: true },
    });
    if (!activeSession) {
      throw new BadRequestException(
        'No active academic session — cannot issue a voucher',
      );
    }

    const structures = await this.prisma.feeStructure.findMany({
      where: { id: { in: dto.feeStructureIds } },
    });
    if (structures.length !== dto.feeStructureIds.length) {
      throw new BadRequestException('One or more feeStructureIds do not exist');
    }

    const studentIds = dto.studentIds?.length
      ? dto.studentIds
      : (
          await this.prisma.enrollment.findMany({
            where: { sectionId: dto.sectionId, status: 'ACTIVE' },
            select: { studentId: true },
          })
        ).map((e) => e.studentId);

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

    const dueDate = new Date(dto.dueDate);
    const created: VoucherSummary[] = [];
    for (const studentId of studentIds) {
      const voucher = await this.prisma.feeVoucher.create({
        data: {
          studentId,
          academicSessionId: activeSession.id,
          month: dto.month,
          issueDate: new Date(),
          dueDate,
          items: {
            create: structures.map((s) => ({
              label: s.name,
              amount: s.amount,
            })),
          },
        },
        include: { items: true },
      });
      created.push(this.toSummary(voucher, 0));
    }

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
      include: { items: true, allocations: true },
      orderBy: { issueDate: 'desc' },
    });
    return vouchers.map((v) =>
      this.toSummary(
        v,
        v.allocations.reduce((sum, a) => sum + a.amount, 0),
      ),
    );
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

  private toSummary(
    voucher: {
      id: string;
      studentId: string;
      month: string;
      dueDate: Date;
      items: Array<{ label: string; amount: number }>;
    },
    amountPaid: number,
  ): VoucherSummary {
    const totalAmount = voucher.items.reduce((sum, i) => sum + i.amount, 0);
    const amountDue = totalAmount - amountPaid;
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    let status: VoucherSummary['status'];
    if (amountDue <= 0) status = 'paid';
    else if (amountPaid > 0) status = 'partial';
    else if (voucher.dueDate < startOfToday) status = 'overdue';
    else status = 'unpaid';
    return {
      id: voucher.id,
      studentId: voucher.studentId,
      month: voucher.month,
      dueDate: voucher.dueDate.toISOString().slice(0, 10),
      items: voucher.items.map((i) => ({ label: i.label, amount: i.amount })),
      totalAmount,
      amountPaid,
      amountDue,
      status,
    };
  }
}
