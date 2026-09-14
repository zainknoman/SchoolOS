import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestUser } from '../common/student-access.service';

export interface DashboardWeeklyPoint {
  day: string;
  attendancePercent: number;
  feesCollectedPkr: number;
}

export interface DashboardAlert {
  id: string;
  message: string;
  createdAt: string;
}

export interface DashboardSummary {
  studentsTotal: number;
  presentTodayPercent: number;
  absentToday: number;
  feesCollectedPkr: number;
  feesOutstandingPkr: number;
  weeklyTrend: DashboardWeeklyPoint[];
  recentAlerts: DashboardAlert[];
}

const DAY_ABBREVIATIONS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dateOnlyUtc(d: Date): Date {
  return new Date(d.toISOString().slice(0, 10));
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private async attendancePercentAndAbsent(
    date: Date,
    schoolId?: string,
  ): Promise<{ percent: number; absent: number }> {
    const records = await this.prisma.attendance.findMany({
      where: {
        date: dateOnlyUtc(date),
        ...(schoolId ? { student: { enrollments: { some: { campus: { schoolId } } } } } : {}),
      },
      select: { status: true },
    });
    let present = 0;
    let absent = 0;
    let late = 0;
    let leave = 0;
    for (const r of records) {
      if (r.status === 'PRESENT') present++;
      else if (r.status === 'ABSENT') absent++;
      else if (r.status === 'LATE') late++;
      else if (r.status === 'LEAVE') leave++;
    }
    const countable = present + absent + late + leave;
    return { percent: countable === 0 ? 0 : Math.round((present / countable) * 100), absent };
  }

  private async feesCollectedPkrForRange(from: Date, to?: Date, schoolId?: string): Promise<number> {
    const result = await this.prisma.feePayment.aggregate({
      _sum: { amount: true },
      where: {
        status: 'completed',
        createdAt: { gte: from, ...(to ? { lt: to } : {}) },
        ...(schoolId
          ? {
              allocations: {
                some: { feeVoucher: { student: { enrollments: { some: { campus: { schoolId } } } } } },
              },
            }
          : {}),
      },
    });
    return (result._sum.amount ?? 0) / 100;
  }

  private async feesOutstandingPkr(schoolId?: string): Promise<number> {
    const vouchers = await this.prisma.feeVoucher.findMany({
      where: schoolId ? { student: { enrollments: { some: { campus: { schoolId } } } } } : undefined,
      select: { items: { select: { amount: true } }, allocations: { select: { amount: true } } },
    });
    let totalPaisa = 0;
    for (const v of vouchers) {
      const total = v.items.reduce((sum, i) => sum + i.amount, 0);
      const allocated = v.allocations.reduce((sum, a) => sum + a.amount, 0);
      const due = total - allocated;
      if (due > 0) totalPaisa += due;
    }
    return totalPaisa / 100;
  }

  private async weeklyTrend(schoolId?: string): Promise<DashboardWeeklyPoint[]> {
    const points: DashboardWeeklyPoint[] = [];
    for (let offset = 6; offset >= 0; offset--) {
      const day = new Date();
      day.setUTCDate(day.getUTCDate() - offset);
      const dayStart = dateOnlyUtc(day);
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
      const [{ percent }, feesCollectedPkr] = await Promise.all([
        this.attendancePercentAndAbsent(day, schoolId),
        this.feesCollectedPkrForRange(dayStart, dayEnd, schoolId),
      ]);
      points.push({ day: DAY_ABBREVIATIONS[day.getUTCDay()], attendancePercent: percent, feesCollectedPkr });
    }
    return points;
  }

  // Notification has no Prisma relation to User (plain userId FK), so scoping by school is a
  // two-step lookup: the school's user ids, then notifications addressed to any of them.
  private async recentAlerts(schoolId?: string): Promise<DashboardAlert[]> {
    let userIdFilter: Prisma.NotificationWhereInput | undefined;
    if (schoolId) {
      const users = await this.prisma.user.findMany({ where: { schoolId }, select: { id: true } });
      userIdFilter = { userId: { in: users.map((u) => u.id) } };
    }
    const notifications = await this.prisma.notification.findMany({
      where: userIdFilter,
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, title: true, createdAt: true },
    });
    return notifications.map((n) => ({ id: n.id, message: n.title, createdAt: n.createdAt.toISOString() }));
  }

  private static readonly EMPTY_SUMMARY: DashboardSummary = {
    studentsTotal: 0,
    presentTodayPercent: 0,
    absentToday: 0,
    feesCollectedPkr: 0,
    feesOutstandingPkr: 0,
    weeklyTrend: [],
    recentAlerts: [],
  };

  async getSummary(actingUser: RequestUser): Promise<DashboardSummary> {
    let schoolId: string | undefined;
    if (actingUser.role !== 'SUPER_ADMIN') {
      const admin = await this.prisma.user.findUnique({ where: { id: actingUser.id } });
      if (!admin?.schoolId) {
        return DashboardService.EMPTY_SUMMARY;
      }
      schoolId = admin.schoolId;
    }

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [studentsTotal, today, feesCollectedPkr, feesOutstandingPkr, weeklyTrend, recentAlerts] =
      await Promise.all([
        this.prisma.enrollment.count({
          where: {
            status: 'ACTIVE',
            academicSession: { isActive: true },
            ...(schoolId ? { campus: { schoolId } } : {}),
          },
        }),
        this.attendancePercentAndAbsent(now, schoolId),
        this.feesCollectedPkrForRange(monthStart, undefined, schoolId),
        this.feesOutstandingPkr(schoolId),
        this.weeklyTrend(schoolId),
        this.recentAlerts(schoolId),
      ]);

    return {
      studentsTotal,
      presentTodayPercent: today.percent,
      absentToday: today.absent,
      feesCollectedPkr,
      feesOutstandingPkr,
      weeklyTrend,
      recentAlerts,
    };
  }
}
