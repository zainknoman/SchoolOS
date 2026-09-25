import { Injectable, NotFoundException } from '@nestjs/common';
import { RetentionCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestUser } from '../common/student-access.service';

export interface RetentionPolicyRow {
  category: RetentionCategory;
  periodMonths: number | null;
  legalBasis: string | null;
  updatedAt: Date;
}

export interface RetentionReportRow {
  category: RetentionCategory;
  periodMonths: number | null;
  /** records older than this are past the period (null while the period is unset) */
  cutoff: Date | null;
  /** how many records are past the period; null when unset or not held in the database */
  recordsPastPeriod: number | null;
  measuredBy: string;
}

/** What "older than the period" means for each category (the clock each record starts). */
const MEASURED_BY: Record<RetentionCategory, string> = {
  STUDENT: 'archived students, by archive date',
  GUARDIAN:
    'guardians whose every linked student was archived before the cutoff',
  STAFF: 'archived staff, by archive date',
  ATTENDANCE: 'attendance rows, by attendance date',
  ACADEMIC_RESULTS: 'marks and report cards, by creation date',
  FEES_FINANCIAL: 'fee vouchers, by issue date',
  COMPLAINTS: 'complaints, by creation date',
  AUDIT_LOGS: 'audit log rows, by date',
  AUTH_SECURITY_LOGS: 'refresh and password-reset tokens, by creation date',
  UPLOADED_DOCUMENTS: 'uploaded files, by upload date',
  BACKUPS: 'held outside the application (Ops: storage lifecycle rules)',
};

/**
 * BL-63 (RD-6): the retention configuration only RECORDS approved periods (all unset until legal
 * review) and reports how many records are past them. Nothing in the application deletes records
 * because of it — a test asserts that no scheduled job deletes anything.
 */
@Injectable()
export class RetentionService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<RetentionPolicyRow[]> {
    return this.prisma.retentionPolicy.findMany({
      orderBy: { category: 'asc' },
      select: {
        category: true,
        periodMonths: true,
        legalBasis: true,
        updatedAt: true,
      },
    });
  }

  async update(
    category: RetentionCategory,
    dto: { periodMonths: number | null; legalBasis?: string | null },
    actor: RequestUser,
  ): Promise<RetentionPolicyRow> {
    const existing = await this.prisma.retentionPolicy.findUnique({
      where: { category },
    });
    if (!existing) throw new NotFoundException('Unknown retention category');
    const legalBasis = dto.legalBasis?.trim() || null;
    const [row] = await this.prisma.$transaction([
      this.prisma.retentionPolicy.update({
        where: { category },
        data: {
          periodMonths: dto.periodMonths,
          legalBasis,
          updatedById: actor.id,
        },
        select: {
          category: true,
          periodMonths: true,
          legalBasis: true,
          updatedAt: true,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: actor.id,
          action: 'retention-policy.update',
          entity: 'RetentionPolicy',
          entityId: category,
          metadata: JSON.stringify({
            before: {
              periodMonths: existing.periodMonths,
              legalBasis: existing.legalBasis,
            },
            after: { periodMonths: dto.periodMonths, legalBasis },
          }),
        },
      }),
    ]);
    return row;
  }

  /** Review report: counts only, never deletes. */
  async report(now = new Date()): Promise<RetentionReportRow[]> {
    const policies = await this.list();
    const rows: RetentionReportRow[] = [];
    for (const p of policies) {
      if (p.periodMonths === null) {
        rows.push({
          category: p.category,
          periodMonths: null,
          cutoff: null,
          recordsPastPeriod: null,
          measuredBy: MEASURED_BY[p.category],
        });
        continue;
      }
      const cutoff = new Date(now);
      cutoff.setMonth(cutoff.getMonth() - p.periodMonths);
      rows.push({
        category: p.category,
        periodMonths: p.periodMonths,
        cutoff,
        recordsPastPeriod: await this.countPast(p.category, cutoff),
        measuredBy: MEASURED_BY[p.category],
      });
    }
    return rows;
  }

  private async countPast(
    category: RetentionCategory,
    cutoff: Date,
  ): Promise<number | null> {
    const before = { lt: cutoff };
    switch (category) {
      case 'STUDENT':
        return this.prisma.student.count({ where: { archivedAt: before } });
      case 'GUARDIAN':
        return this.prisma.parentProfile.count({
          where: {
            children: {
              some: {},
              every: { student: { archivedAt: before } },
            },
          },
        });
      case 'STAFF':
        return this.prisma.staff.count({ where: { archivedAt: before } });
      case 'ATTENDANCE':
        return this.prisma.attendance.count({ where: { date: before } });
      case 'ACADEMIC_RESULTS':
        return (
          (await this.prisma.mark.count({ where: { createdAt: before } })) +
          (await this.prisma.reportCard.count({ where: { createdAt: before } }))
        );
      case 'FEES_FINANCIAL':
        return this.prisma.feeVoucher.count({ where: { issueDate: before } });
      case 'COMPLAINTS':
        return this.prisma.complaint.count({ where: { createdAt: before } });
      case 'AUDIT_LOGS':
        return this.prisma.auditLog.count({ where: { createdAt: before } });
      case 'AUTH_SECURITY_LOGS':
        return (
          (await this.prisma.refreshToken.count({
            where: { createdAt: before },
          })) +
          (await this.prisma.passwordResetToken.count({
            where: { createdAt: before },
          }))
        );
      case 'UPLOADED_DOCUMENTS':
        return this.prisma.file.count({ where: { createdAt: before } });
      case 'BACKUPS':
        return null;
    }
  }
}
