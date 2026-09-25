import { Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * BL-05 (Q5): the supporting indicators shown next to every promotion decision — results,
 * attendance and fee clearance in the source session. They are warnings; a school may turn a rule
 * into a block (PromotionPolicy), and a block only stops a plain PROMOTED decision.
 */
export interface PromotionPolicyValues {
  minAttendancePercent: number;
  minResultPercent: number;
  blockOnAttendance: boolean;
  blockOnResults: boolean;
  blockOnFees: boolean;
}

export const DEFAULT_PROMOTION_POLICY: PromotionPolicyValues = {
  minAttendancePercent: 75,
  minResultPercent: 40,
  blockOnAttendance: false,
  blockOnResults: false,
  blockOnFees: false,
};

export interface RawIndicators {
  attendance: { present: number; late: number; absent: number; leave: number };
  results: { obtained: number; max: number; assessments: number };
  fees: { outstanding: number; unpaidVouchers: number };
}

export type PromotionWarningCode =
  | 'LOW_ATTENDANCE'
  | 'NO_ATTENDANCE_DATA'
  | 'LOW_RESULTS'
  | 'NO_RESULTS_DATA'
  | 'FEES_OUTSTANDING';

export interface PromotionWarning {
  code: PromotionWarningCode;
  message: string;
  blocking: boolean;
}

export interface StudentIndicators {
  attendance: RawIndicators['attendance'] & { percent: number | null };
  results: RawIndicators['results'] & { percent: number | null };
  fees: RawIndicators['fees'];
  warnings: PromotionWarning[];
  /** true when a school-configured rule stops a plain PROMOTED decision */
  blocked: boolean;
}

const pct = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;

/** Pure: raw counts + the school's policy → percentages, warnings and the blocked flag. */
export function evaluateIndicators(
  raw: RawIndicators,
  policy: PromotionPolicyValues,
): StudentIndicators {
  const { present, late, absent } = raw.attendance;
  // Leave and holidays are excused: they count neither for nor against the student.
  const attendancePercent = pct(present + late, present + late + absent);
  const resultPercent = pct(raw.results.obtained, raw.results.max);
  const warnings: PromotionWarning[] = [];

  if (attendancePercent === null) {
    warnings.push({
      code: 'NO_ATTENDANCE_DATA',
      message: 'No attendance recorded in this session',
      blocking: false,
    });
  } else if (attendancePercent < policy.minAttendancePercent) {
    warnings.push({
      code: 'LOW_ATTENDANCE',
      message: `Attendance ${attendancePercent}% is below ${policy.minAttendancePercent}%`,
      blocking: policy.blockOnAttendance,
    });
  }
  if (resultPercent === null) {
    warnings.push({
      code: 'NO_RESULTS_DATA',
      message: 'No marks recorded in this session',
      blocking: false,
    });
  } else if (resultPercent < policy.minResultPercent) {
    warnings.push({
      code: 'LOW_RESULTS',
      message: `Results ${resultPercent}% are below ${policy.minResultPercent}%`,
      blocking: policy.blockOnResults,
    });
  }
  if (raw.fees.outstanding > 0) {
    warnings.push({
      code: 'FEES_OUTSTANDING',
      message: `Fees outstanding: Rs ${(raw.fees.outstanding / 100).toFixed(2)} on ${raw.fees.unpaidVouchers} voucher(s)`,
      blocking: policy.blockOnFees,
    });
  }

  return {
    attendance: { ...raw.attendance, percent: attendancePercent },
    results: { ...raw.results, percent: resultPercent },
    fees: raw.fees,
    warnings,
    blocked: warnings.some((w) => w.blocking),
  };
}

type Db = PrismaService | Prisma.TransactionClient | PrismaClient;

@Injectable()
export class PromotionIndicatorsService {
  constructor(private readonly prisma: PrismaService) {}

  async policyFor(
    schoolId: string,
    db: Db = this.prisma,
  ): Promise<PromotionPolicyValues> {
    const row = await db.promotionPolicy.findUnique({ where: { schoolId } });
    if (!row) return { ...DEFAULT_PROMOTION_POLICY };
    return {
      minAttendancePercent: row.minAttendancePercent,
      minResultPercent: row.minResultPercent,
      blockOnAttendance: row.blockOnAttendance,
      blockOnResults: row.blockOnResults,
      blockOnFees: row.blockOnFees,
    };
  }

  /** Indicators for each student in one session, from three batched queries. */
  async forStudents(
    sessionId: string,
    studentIds: string[],
    policy: PromotionPolicyValues,
    db: Db = this.prisma,
  ): Promise<Map<string, StudentIndicators>> {
    const raw = new Map<string, RawIndicators>(
      studentIds.map((id) => [
        id,
        {
          attendance: { present: 0, late: 0, absent: 0, leave: 0 },
          results: { obtained: 0, max: 0, assessments: 0 },
          fees: { outstanding: 0, unpaidVouchers: 0 },
        },
      ]),
    );
    if (studentIds.length > 0) {
      const session = await db.academicSession.findUnique({
        where: { id: sessionId },
        select: { startDate: true, endDate: true },
      });
      if (session) {
        const attendance = await db.attendance.groupBy({
          by: ['studentId', 'status'],
          where: {
            studentId: { in: studentIds },
            date: { gte: session.startDate, lte: session.endDate },
          },
          _count: { _all: true },
        });
        for (const a of attendance) {
          const r = raw.get(a.studentId)!;
          const n = a._count._all;
          if (a.status === 'PRESENT') r.attendance.present += n;
          else if (a.status === 'LATE') r.attendance.late += n;
          else if (a.status === 'ABSENT') r.attendance.absent += n;
          else if (a.status === 'LEAVE') r.attendance.leave += n;
        }
      }

      const marks = await db.mark.findMany({
        where: {
          studentId: { in: studentIds },
          assessment: {
            assessmentCategory: { class: { academicSessionId: sessionId } },
          },
        },
        select: {
          studentId: true,
          obtainedMarks: true,
          assessment: { select: { maxMarks: true } },
        },
      });
      for (const m of marks) {
        const r = raw.get(m.studentId)!;
        r.results.obtained += m.obtainedMarks;
        r.results.max += m.assessment.maxMarks;
        r.results.assessments += 1;
      }

      const vouchers = await db.feeVoucher.findMany({
        where: { studentId: { in: studentIds }, academicSessionId: sessionId },
        select: {
          studentId: true,
          items: { select: { amount: true } },
          allocations: { select: { amount: true } },
        },
      });
      for (const v of vouchers) {
        // Same balance rule as the voucher summaries (fee-vouchers.service.ts).
        const due =
          v.items.reduce((s, i) => s + i.amount, 0) -
          v.allocations.reduce((s, a) => s + a.amount, 0);
        if (due > 0) {
          const r = raw.get(v.studentId)!;
          r.fees.outstanding += due;
          r.fees.unpaidVouchers += 1;
        }
      }
    }
    return new Map(
      [...raw].map(([id, r]) => [id, evaluateIndicators(r, policy)]),
    );
  }
}
