import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestUser } from '../common/student-access.service';
import { OrgScopeService } from '../common/org-scope.service';
import type { OrgScope } from '../common/org-scope.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
  ) {}

  private async attendancePercentAndAbsent(
    date: Date,
    campusWhere?: Prisma.CampusWhereInput,
  ): Promise<{ percent: number; absent: number }> {
    const records = await this.prisma.attendance.findMany({
      where: {
        date: dateOnlyUtc(date),
        ...(campusWhere
          ? { student: { enrollments: { some: { campus: campusWhere } } } }
          : {}),
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
    return {
      percent: countable === 0 ? 0 : Math.round((present / countable) * 100),
      absent,
    };
  }

  private async feesCollectedPkrForRange(
    from: Date,
    to?: Date,
    campusWhere?: Prisma.CampusWhereInput,
  ): Promise<number> {
    const result = await this.prisma.feePayment.aggregate({
      _sum: { amount: true },
      where: {
        status: 'completed',
        createdAt: { gte: from, ...(to ? { lt: to } : {}) },
        ...(campusWhere
          ? {
              allocations: {
                some: {
                  feeVoucher: {
                    student: { enrollments: { some: { campus: campusWhere } } },
                  },
                },
              },
            }
          : {}),
      },
    });
    return (result._sum.amount ?? 0) / 100;
  }

  private async feesOutstandingPkr(
    campusWhere?: Prisma.CampusWhereInput,
  ): Promise<number> {
    const vouchers = await this.prisma.feeVoucher.findMany({
      where: campusWhere
        ? { student: { enrollments: { some: { campus: campusWhere } } } }
        : undefined,
      select: {
        items: { select: { amount: true } },
        allocations: { select: { amount: true } },
      },
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

  private async weeklyTrend(
    campusWhere?: Prisma.CampusWhereInput,
  ): Promise<DashboardWeeklyPoint[]> {
    const points: DashboardWeeklyPoint[] = [];
    for (let offset = 6; offset >= 0; offset--) {
      const day = new Date();
      day.setUTCDate(day.getUTCDate() - offset);
      const dayStart = dateOnlyUtc(day);
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
      const [{ percent }, feesCollectedPkr] = await Promise.all([
        this.attendancePercentAndAbsent(day, campusWhere),
        this.feesCollectedPkrForRange(dayStart, dayEnd, campusWhere),
      ]);
      points.push({
        day: DAY_ABBREVIATIONS[day.getUTCDay()],
        attendancePercent: percent,
        feesCollectedPkr,
      });
    }
    return points;
  }

  // Notification has no Prisma relation to User (plain userId FK), so scoping by school is a
  // two-step lookup: the school's user ids, then notifications addressed to any of them.
  private async recentAlerts(scope?: OrgScope): Promise<DashboardAlert[]> {
    let userIdFilter: Prisma.NotificationWhereInput | undefined;
    if (scope && !scope.unrestricted && scope.schoolId) {
      const users = await this.prisma.user.findMany({
        where: {
          schoolId: scope.schoolId,
          ...(scope.campusId ? { campusId: scope.campusId } : {}),
        },
        select: { id: true },
      });
      userIdFilter = { userId: { in: users.map((u) => u.id) } };
    }
    const notifications = await this.prisma.notification.findMany({
      where: userIdFilter,
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, title: true, createdAt: true },
    });
    return notifications.map((n) => ({
      id: n.id,
      message: n.title,
      createdAt: n.createdAt.toISOString(),
    }));
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
    const scope = await this.orgScope.resolve(actingUser);
    if (scope.denied) {
      return DashboardService.EMPTY_SUMMARY;
    }
    const campusWhere = scope.campusWhere;

    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );

    const [
      studentsTotal,
      today,
      feesCollectedPkr,
      feesOutstandingPkr,
      weeklyTrend,
      recentAlerts,
    ] = await Promise.all([
      this.prisma.enrollment.count({
        where: {
          status: 'ACTIVE',
          academicSession: { isActive: true },
          ...(campusWhere ? { campus: campusWhere } : {}),
        },
      }),
      this.attendancePercentAndAbsent(now, campusWhere),
      this.feesCollectedPkrForRange(monthStart, undefined, campusWhere),
      this.feesOutstandingPkr(campusWhere),
      this.weeklyTrend(campusWhere),
      this.recentAlerts(scope),
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

  async getOperationsSummary(
    actingUser: RequestUser,
  ): Promise<OperationsSummary> {
    const scope = await this.orgScope.resolve(actingUser);
    if (scope.denied) {
      return {
        admissionsPending: 0,
        feeDefaulters: 0,
        leaveRequestsPending: 0,
        documentsToVerify: 0,
        recentActivity: [],
      };
    }
    const campusWhere = scope.campusWhere;

    const [
      admissionsPending,
      feeDefaulters,
      leaveRequestsPending,
      documentsToVerify,
      recentActivity,
    ] = await Promise.all([
      this.prisma.application.count({
        where: {
          status: 'SUBMITTED',
          ...(campusWhere ? { desiredClass: { campus: campusWhere } } : {}),
        },
      }),
      this.feeDefaultersCount(campusWhere),
      this.prisma.leaveRequest.count({
        where: {
          status: 'pending',
          ...(campusWhere
            ? { student: { enrollments: { some: { campus: campusWhere } } } }
            : {}),
        },
      }),
      this.prisma.studentDocument.count({
        where: {
          verificationStatus: 'PENDING',
          ...(campusWhere
            ? { student: { enrollments: { some: { campus: campusWhere } } } }
            : {}),
        },
      }),
      this.recentAlerts(scope),
    ]);

    return {
      admissionsPending,
      feeDefaulters,
      leaveRequestsPending,
      documentsToVerify,
      recentActivity,
    };
  }

  // Distinct students with a positive amount due — a student with two overdue vouchers still
  // counts once, matching "how many families need a reminder", not "how many overdue vouchers".
  private async feeDefaultersCount(
    campusWhere?: Prisma.CampusWhereInput,
  ): Promise<number> {
    const vouchers = await this.prisma.feeVoucher.findMany({
      where: campusWhere
        ? { student: { enrollments: { some: { campus: campusWhere } } } }
        : undefined,
      select: {
        studentId: true,
        items: { select: { amount: true } },
        allocations: { select: { amount: true } },
      },
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
      select: {
        id: true,
        name: true,
        status: true,
        campuses: { select: { id: true } },
      },
    });

    const [totalStudents, totalStaff, schoolRows] = await Promise.all([
      this.prisma.enrollment.count({
        where: { status: 'ACTIVE', academicSession: { isActive: true } },
      }),
      this.prisma.staff.count({ where: { employmentStatus: 'ACTIVE' } }),
      Promise.all(
        schools.map(async (school): Promise<SchoolOverviewRow> => {
          const [studentsCount, collected, outstanding] = await Promise.all([
            this.prisma.enrollment.count({
              where: {
                status: 'ACTIVE',
                academicSession: { isActive: true },
                campus: { schoolId: school.id },
              },
            }),
            this.feesCollectedPkrForRange(new Date(0), undefined, {
              schoolId: school.id,
            }),
            this.feesOutstandingPkr({ schoolId: school.id }),
          ]);
          const billed = collected + outstanding;
          return {
            id: school.id,
            name: school.name,
            status: school.status,
            campusesCount: school.campuses.length,
            studentsCount,
            feeCollectionPercent:
              billed === 0 ? 100 : Math.round((collected / billed) * 100),
          };
        }),
      ),
    ]);

    return {
      totalSchools: schools.length,
      totalStudents,
      totalStaff,
      schools: schoolRows,
    };
  }

  // --- Principal "Academics & Staff" dashboard --------------------------------------------
  // A Principal is a SCHOOL_ADMIN user with isPrincipal=true (there is no separate Role) — the
  // controller only gates on @Roles('SCHOOL_ADMIN'), so this service enforces the extra flag.

  async getPrincipalAcademicsSummary(
    actingUser: RequestUser,
  ): Promise<PrincipalAcademicsSummary> {
    const admin = await this.prisma.user.findUnique({
      where: { id: actingUser.id },
    });
    if (!admin?.isPrincipal) {
      throw new ForbiddenException(
        'This dashboard is only available to a school Principal.',
      );
    }
    const scope = await this.orgScope.resolve(actingUser);
    if (scope.denied) {
      return { classHealth: [], examScheduleStatus: [] };
    }

    const sections = await this.prisma.section.findMany({
      where: { class: { campus: scope.campusWhere } },
      select: {
        id: true,
        name: true,
        class: { select: { id: true, name: true } },
        classTeacher: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });

    const classHealth = await Promise.all(
      sections.map((section) => this.classHealthForSection(section)),
    );

    const categories = await this.prisma.assessmentCategory.findMany({
      where: {
        class: { campus: scope.campusWhere },
        term: { academicSession: { isActive: true } },
      },
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
        where: {
          date: today,
          student: { enrollments: { some: { sectionId: section.id } } },
        },
        select: { status: true },
      }),
      this.prisma.assessmentCategory.findFirst({
        where: {
          classId: section.class.id,
          term: { academicSession: { isActive: true } },
        },
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
    const attendancePercent =
      countable === 0 ? 0 : Math.round((present / countable) * 100);

    let averageMarksPercent: number | null = null;
    if (latestCategory) {
      const marks = await this.prisma.mark.findMany({
        where: {
          assessment: { assessmentCategoryId: latestCategory.id },
          student: { enrollments: { some: { sectionId: section.id } } },
        },
        select: {
          obtainedMarks: true,
          assessment: { select: { maxMarks: true } },
        },
      });
      if (marks.length > 0) {
        const percentSum = marks.reduce(
          (sum, m) => sum + (m.obtainedMarks / m.assessment.maxMarks) * 100,
          0,
        );
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
