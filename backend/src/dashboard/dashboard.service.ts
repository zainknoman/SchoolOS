import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  private async attendancePercentAndAbsent(date: Date): Promise<{ percent: number; absent: number }> {
    const records = await this.prisma.attendance.findMany({
      where: { date: dateOnlyUtc(date) },
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

  private async feesCollectedPkrForRange(from: Date, to?: Date): Promise<number> {
    const result = await this.prisma.feePayment.aggregate({
      _sum: { amount: true },
      where: { status: 'completed', createdAt: { gte: from, ...(to ? { lt: to } : {}) } },
    });
    return (result._sum.amount ?? 0) / 100;
  }

  private async feesOutstandingPkr(): Promise<number> {
    const vouchers = await this.prisma.feeVoucher.findMany({
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

  private async weeklyTrend(): Promise<DashboardWeeklyPoint[]> {
    const points: DashboardWeeklyPoint[] = [];
    for (let offset = 6; offset >= 0; offset--) {
      const day = new Date();
      day.setUTCDate(day.getUTCDate() - offset);
      const dayStart = dateOnlyUtc(day);
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
      const [{ percent }, feesCollectedPkr] = await Promise.all([
        this.attendancePercentAndAbsent(day),
        this.feesCollectedPkrForRange(dayStart, dayEnd),
      ]);
      points.push({ day: DAY_ABBREVIATIONS[day.getUTCDay()], attendancePercent: percent, feesCollectedPkr });
    }
    return points;
  }

  private async recentAlerts(): Promise<DashboardAlert[]> {
    const notifications = await this.prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, title: true, createdAt: true },
    });
    return notifications.map((n) => ({ id: n.id, message: n.title, createdAt: n.createdAt.toISOString() }));
  }

  async getSummary(): Promise<DashboardSummary> {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [studentsTotal, today, feesCollectedPkr, feesOutstandingPkr, weeklyTrend, recentAlerts] =
      await Promise.all([
        this.prisma.enrollment.count({ where: { status: 'ACTIVE', academicSession: { isActive: true } } }),
        this.attendancePercentAndAbsent(now),
        this.feesCollectedPkrForRange(monthStart),
        this.feesOutstandingPkr(),
        this.weeklyTrend(),
        this.recentAlerts(),
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
