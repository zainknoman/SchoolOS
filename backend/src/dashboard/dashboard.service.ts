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

/** Present % (HOLIDAY excluded from the denominator) and the ABSENT count, from grouped counts. */
function percentAndAbsent(
  counts: { status: string; _count: { _all: number } }[],
): { percent: number; absent: number } {
  const n = (status: string) =>
    counts
      .filter((c) => c.status === status)
      .reduce((sum, c) => sum + c._count._all, 0);
  const present = n('PRESENT');
  const absent = n('ABSENT');
  const countable = present + absent + n('LATE') + n('LEAVE');
  return {
    percent: countable === 0 ? 0 : Math.round((present / countable) * 100),
    absent,
  };
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
  ) {}

  private studentScope(
    campusWhere?: Prisma.CampusWhereInput,
  ): Prisma.AttendanceWhereInput {
    return campusWhere
      ? { student: { enrollments: { some: { campus: campusWhere } } } }
      : {};
  }

  private async attendancePercentAndAbsent(
    date: Date,
    campusWhere?: Prisma.CampusWhereInput,
  ): Promise<{ percent: number; absent: number }> {
    const counts = await this.prisma.attendance.groupBy({
      by: ['status'],
      where: { date: dateOnlyUtc(date), ...this.studentScope(campusWhere) },
      _count: { _all: true },
    });
    return percentAndAbsent(counts);
  }

  private async feesCollectedPkrForRange(
    from: Date,
    to?: Date,
    campusWhere?: Prisma.CampusWhereInput,
  ): Promise<number> {
    const result = await this.prisma.feePayment.aggregate({
      _sum: { amount: true },
      where: this.paymentWhere(from, to, campusWhere),
    });
    return (result._sum.amount ?? 0) / 100;
  }

  private paymentWhere(
    from: Date,
    to: Date | undefined,
    campusWhere?: Prisma.CampusWhereInput,
  ): Prisma.FeePaymentWhereInput {
    return {
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
    };
  }

  // BL-15: summed per voucher in the database (two grouped queries) instead of loading every
  // voucher with its items and allocations.
  private async feesOutstandingPkr(
    campusWhere?: Prisma.CampusWhereInput,
  ): Promise<number> {
    const where = campusWhere
      ? {
          feeVoucher: {
            student: { enrollments: { some: { campus: campusWhere } } },
          },
        }
      : undefined;
    const [charged, allocated] = await Promise.all([
      this.prisma.feeItem.groupBy({
        by: ['feeVoucherId'],
        where,
        _sum: { amount: true },
      }),
      this.prisma.feePaymentAllocation.groupBy({
        by: ['feeVoucherId'],
        where,
        _sum: { amount: true },
      }),
    ]);
    const paid = new Map(
      allocated.map((a) => [a.feeVoucherId, a._sum.amount ?? 0]),
    );
    let totalPaisa = 0;
    for (const c of charged) {
      const due = (c._sum.amount ?? 0) - (paid.get(c.feeVoucherId) ?? 0);
      if (due > 0) totalPaisa += due;
    }
    return totalPaisa / 100;
  }

  // BL-15: the last seven days from two queries (attendance grouped by day and status, the week's
  // payments), bucketed here — it used to be two queries per day.
  private async weeklyTrend(
    campusWhere?: Prisma.CampusWhereInput,
  ): Promise<DashboardWeeklyPoint[]> {
    const today = dateOnlyUtc(new Date());
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - 6);
    const end = new Date(today);
    end.setUTCDate(end.getUTCDate() + 1);
    const [counts, payments] = await Promise.all([
      this.prisma.attendance.groupBy({
        by: ['date', 'status'],
        where: {
          date: { gte: start, lt: end },
          ...this.studentScope(campusWhere),
        },
        _count: { _all: true },
      }),
      this.prisma.feePayment.findMany({
        where: this.paymentWhere(start, end, campusWhere),
        select: { amount: true, createdAt: true },
      }),
    ]);
    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const points: DashboardWeeklyPoint[] = [];
    for (let offset = 6; offset >= 0; offset--) {
      const day = new Date(today);
      day.setUTCDate(day.getUTCDate() - offset);
      const key = dayKey(day);
      const paisa = payments
        .filter((p) => dayKey(p.createdAt) === key)
        .reduce((sum, p) => sum + p.amount, 0);
      points.push({
        day: DAY_ABBREVIATIONS[day.getUTCDay()],
        attendancePercent: percentAndAbsent(
          counts.filter((c) => dayKey(c.date) === key),
        ).percent,
        feesCollectedPkr: paisa / 100,
      });
    }
    return points;
  }

  // Notification has no Prisma relation to User (plain userId FK). Scoped by school/campus, the
  // join runs in SQL (BL-15) — it used to pass every user id of the school as a parameter list.
  private async recentAlerts(scope?: OrgScope): Promise<DashboardAlert[]> {
    const notifications =
      scope && !scope.unrestricted && scope.schoolId
        ? await this.prisma.$queryRaw<
            { id: string; title: string; createdAt: Date }[]
          >`
            SELECT n."id", n."title", n."createdAt"
            FROM "Notification" n
            JOIN "User" u ON u."id" = n."userId"
            WHERE u."schoolId" = ${scope.schoolId}
              AND (${scope.campusId}::text IS NULL OR u."campusId" = ${scope.campusId}::text)
            ORDER BY n."createdAt" DESC
            LIMIT 5`
        : await this.prisma.notification.findMany({
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
