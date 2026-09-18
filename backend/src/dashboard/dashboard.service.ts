import { ForbiddenException, Injectable } from '@nestjs/common';
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

export interface OperationsSummary {
  admissionsPending: number;
  feeDefaulters: number;
  leaveRequestsPending: number;
  documentsToVerify: number;
  recentActivity: DashboardAlert[];
}

export interface SchoolOverviewRow {
  id: string;
  name: string;
  status: string;
  campusesCount: number;
  studentsCount: number;
  feeCollectionPercent: number;
}

export interface NetworkOverview {
  totalSchools: number;
  totalStudents: number;
  totalStaff: number;
  schools: SchoolOverviewRow[];
}

export interface ClassHealthRow {
  sectionId: string;
  className: string;
  sectionName: string;
  teacherName: string | null;
  attendancePercent: number;
  averageMarksPercent: number | null;
}

export interface ExamScheduleStatusRow {
  categoryId: string;
  categoryName: string;
  className: string;
  termLabel: string;
  // Derived proxy, not a stored field: 'ready' means every assessment created under this
  // category already has at least one subject's Assessment row; there's no real "exam schedule
  // published" concept in the data model to reflect instead.
  status: 'ready' | 'pending';
}

export interface PrincipalAcademicsSummary {
  classHealth: ClassHealthRow[];
  examScheduleStatus: ExamScheduleStatusRow[];
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

  // --- School Admin / Accounts "Operations" dashboard --------------------------------------

  async getOperationsSummary(actingUser: RequestUser): Promise<OperationsSummary> {
    let schoolId: string | undefined;
    if (actingUser.role !== 'SUPER_ADMIN') {
      const admin = await this.prisma.user.findUnique({ where: { id: actingUser.id } });
      if (!admin?.schoolId) {
        return { admissionsPending: 0, feeDefaulters: 0, leaveRequestsPending: 0, documentsToVerify: 0, recentActivity: [] };
      }
      schoolId = admin.schoolId;
    }

    const [admissionsPending, feeDefaulters, leaveRequestsPending, documentsToVerify, recentActivity] =
      await Promise.all([
        this.prisma.application.count({
          where: {
            status: 'SUBMITTED',
            ...(schoolId ? { desiredClass: { campus: { schoolId } } } : {}),
          },
        }),
        this.feeDefaultersCount(schoolId),
        this.prisma.leaveRequest.count({
          where: {
            status: 'pending',
            ...(schoolId ? { student: { enrollments: { some: { campus: { schoolId } } } } } : {}),
          },
        }),
        this.prisma.studentDocument.count({
          where: {
            verificationStatus: 'PENDING',
            ...(schoolId ? { student: { enrollments: { some: { campus: { schoolId } } } } } : {}),
          },
        }),
        this.recentAlerts(schoolId),
      ]);

    return { admissionsPending, feeDefaulters, leaveRequestsPending, documentsToVerify, recentActivity };
  }

  // Distinct students with a positive amount due — a student with two overdue vouchers still
  // counts once, matching "how many families need a reminder", not "how many overdue vouchers".
  private async feeDefaultersCount(schoolId?: string): Promise<number> {
    const vouchers = await this.prisma.feeVoucher.findMany({
      where: schoolId ? { student: { enrollments: { some: { campus: { schoolId } } } } } : undefined,
      select: { studentId: true, items: { select: { amount: true } }, allocations: { select: { amount: true } } },
    });
    const defaulters = new Set<string>();
    for (const v of vouchers) {
      const total = v.items.reduce((sum, i) => sum + i.amount, 0);
      const allocated = v.allocations.reduce((sum, a) => sum + a.amount, 0);
      if (total - allocated > 0) defaulters.add(v.studentId);
    }
    return defaulters.size;
  }

  // --- SuperAdmin "Network Overview" dashboard ----------------------------------------------

  async getNetworkOverview(): Promise<NetworkOverview> {
    const schools = await this.prisma.school.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, status: true, campuses: { select: { id: true } } },
    });

    const [totalStudents, totalStaff, schoolRows] = await Promise.all([
      this.prisma.enrollment.count({ where: { status: 'ACTIVE', academicSession: { isActive: true } } }),
      this.prisma.staff.count({ where: { employmentStatus: 'ACTIVE' } }),
      Promise.all(
        schools.map(async (school): Promise<SchoolOverviewRow> => {
          const [studentsCount, collected, outstanding] = await Promise.all([
            this.prisma.enrollment.count({
              where: { status: 'ACTIVE', academicSession: { isActive: true }, campus: { schoolId: school.id } },
            }),
            this.feesCollectedPkrForRange(new Date(0), undefined, school.id),
            this.feesOutstandingPkr(school.id),
          ]);
          const billed = collected + outstanding;
          return {
            id: school.id,
            name: school.name,
            status: school.status,
            campusesCount: school.campuses.length,
            studentsCount,
            feeCollectionPercent: billed === 0 ? 100 : Math.round((collected / billed) * 100),
          };
        }),
      ),
    ]);

    return { totalSchools: schools.length, totalStudents, totalStaff, schools: schoolRows };
  }

  // --- Principal "Academics & Staff" dashboard --------------------------------------------
  // A Principal is a SCHOOL_ADMIN user with isPrincipal=true (there is no separate Role) — the
  // controller only gates on @Roles('SCHOOL_ADMIN'), so this service enforces the extra flag.

  async getPrincipalAcademicsSummary(actingUser: RequestUser): Promise<PrincipalAcademicsSummary> {
    const admin = await this.prisma.user.findUnique({ where: { id: actingUser.id } });
    if (!admin?.isPrincipal) {
      throw new ForbiddenException('This dashboard is only available to a school Principal.');
    }
    if (!admin.schoolId) {
      return { classHealth: [], examScheduleStatus: [] };
    }

    const sections = await this.prisma.section.findMany({
      where: { class: { campus: { schoolId: admin.schoolId } } },
      select: {
        id: true,
        name: true,
        class: { select: { id: true, name: true } },
        classTeacher: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });

    const classHealth = await Promise.all(sections.map((section) => this.classHealthForSection(section)));

    const categories = await this.prisma.assessmentCategory.findMany({
      where: { class: { campus: { schoolId: admin.schoolId } }, term: { academicSession: { isActive: true } } },
      select: {
        id: true,
        name: true,
        class: { select: { name: true } },
        term: { select: { label: true } },
        assessments: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const examScheduleStatus: ExamScheduleStatusRow[] = categories.map((c) => ({
      categoryId: c.id,
      categoryName: c.name,
      className: c.class.name,
      termLabel: c.term.label,
      status: c.assessments.length > 0 ? 'ready' : 'pending',
    }));

    return { classHealth, examScheduleStatus };
  }

  private async classHealthForSection(section: {
    id: string;
    name: string;
    class: { id: string; name: string };
    classTeacher: { name: string } | null;
  }): Promise<ClassHealthRow> {
    const today = dateOnlyUtc(new Date());
    const [attendanceRecords, latestCategory] = await Promise.all([
      this.prisma.attendance.findMany({
        where: { date: today, student: { enrollments: { some: { sectionId: section.id } } } },
        select: { status: true },
      }),
      this.prisma.assessmentCategory.findFirst({
        where: { classId: section.class.id, term: { academicSession: { isActive: true } } },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      }),
    ]);

    let present = 0;
    let countable = 0;
    for (const r of attendanceRecords) {
      if (r.status === 'HOLIDAY') continue;
      countable++;
      if (r.status === 'PRESENT') present++;
    }
    const attendancePercent = countable === 0 ? 0 : Math.round((present / countable) * 100);

    let averageMarksPercent: number | null = null;
    if (latestCategory) {
      const marks = await this.prisma.mark.findMany({
        where: {
          assessment: { assessmentCategoryId: latestCategory.id },
          student: { enrollments: { some: { sectionId: section.id } } },
        },
        select: { obtainedMarks: true, assessment: { select: { maxMarks: true } } },
      });
      if (marks.length > 0) {
        const percentSum = marks.reduce((sum, m) => sum + (m.obtainedMarks / m.assessment.maxMarks) * 100, 0);
        averageMarksPercent = Math.round(percentSum / marks.length);
      }
    }

    return {
      sectionId: section.id,
      className: section.class.name,
      sectionName: section.name,
      teacherName: section.classTeacher?.name ?? null,
      attendancePercent,
      averageMarksPercent,
    };
  }
}
