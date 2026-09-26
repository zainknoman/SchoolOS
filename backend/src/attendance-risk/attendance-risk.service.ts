import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HolidaysService } from '../holidays/holidays.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrgScopeService } from '../common/org-scope.service';
import type { RequestUser } from '../common/student-access.service';
import {
  RISK_MIN_TRACKED_DAYS,
  RISK_THRESHOLD,
  RISK_WINDOW_DAYS,
} from './attendance-risk.constants';

export interface AttendanceRiskPolicyValues {
  windowDays: number;
  thresholdPercent: number;
  minTrackedDays: number;
  notifyParents: boolean;
}

/** Q8 defaults — what a school without its own settings uses. */
export const RISK_DEFAULTS: AttendanceRiskPolicyValues = {
  windowDays: RISK_WINDOW_DAYS,
  thresholdPercent: Math.round(RISK_THRESHOLD * 100),
  minTrackedDays: RISK_MIN_TRACKED_DAYS,
  notifyParents: false,
};

function pickValues(v: AttendanceRiskPolicyValues): AttendanceRiskPolicyValues {
  return {
    windowDays: v.windowDays,
    thresholdPercent: v.thresholdPercent,
    minTrackedDays: v.minTrackedDays,
    notifyParents: v.notifyParents,
  };
}

export interface AttendanceRiskSummary {
  studentId: string;
  studentName: string;
  absenceRate: number;
  flagged: boolean;
  windowStart: string;
  windowEnd: string;
}

@Injectable()
export class AttendanceRiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly holidaysService: HolidaysService,
    private readonly notificationsService: NotificationsService,
    private readonly orgScope: OrgScopeService,
  ) {}

  private toSummary(record: {
    studentId: string;
    absenceRate: number;
    flagged: boolean;
    windowStart: Date;
    windowEnd: Date;
    student: { name: string };
  }): AttendanceRiskSummary {
    return {
      studentId: record.studentId,
      studentName: record.student.name,
      absenceRate: record.absenceRate,
      flagged: record.flagged,
      windowStart: record.windowStart.toISOString().slice(0, 10),
      windowEnd: record.windowEnd.toISOString().slice(0, 10),
    };
  }

  /**
   * Precomputed nightly, never live on a dashboard request — this also lets us detect exactly the
   * false->true transition that should fire an early-warning alert, not one every time an admin
   * opens the dashboard. BL-28: each school's own settings (window, threshold, minimum tracked
   * days, parent alerts) apply; absence rate = ABSENT days / tracked school days (LATE counts as
   * present; LEAVE days and holidays are not tracked).
   */
  async recomputeAll(now = new Date()): Promise<void> {
    const windowEnd = new Date(now);
    windowEnd.setUTCHours(0, 0, 0, 0);

    const activeEnrollments = await this.prisma.enrollment.findMany({
      where: { status: 'ACTIVE' },
      select: {
        studentId: true,
        campusId: true,
        sectionId: true,
        campus: { select: { schoolId: true } },
      },
    });
    const policies = await this.policiesFor([
      ...new Set(activeEnrollments.map((e) => e.campus.schoolId)),
    ]);

    for (const enrollment of activeEnrollments) {
      const policy = policies.get(enrollment.campus.schoolId) ?? RISK_DEFAULTS;
      const windowStart = new Date(windowEnd);
      windowStart.setUTCDate(windowStart.getUTCDate() - policy.windowDays);
      const records = await this.prisma.attendance.findMany({
        where: {
          studentId: enrollment.studentId,
          date: { gte: windowStart, lt: windowEnd },
          status: { notIn: ['HOLIDAY', 'LEAVE'] },
        },
        select: { date: true, status: true },
      });

      let trackedDays = 0;
      let absentDays = 0;
      for (const record of records) {
        const isHoliday = await this.holidaysService.isHoliday(
          record.date,
          enrollment.campusId,
        );
        if (isHoliday) continue;
        trackedDays++;
        if (record.status === 'ABSENT') absentDays++;
      }

      if (trackedDays < policy.minTrackedDays) {
        continue;
      }

      const absenceRate = absentDays / trackedDays;
      const flagged = absenceRate * 100 >= policy.thresholdPercent;

      const previous = await this.prisma.attendanceRiskFlag.findUnique({
        where: { studentId: enrollment.studentId },
      });
      const wasFlagged = previous?.flagged ?? false;

      await this.prisma.attendanceRiskFlag.upsert({
        where: { studentId: enrollment.studentId },
        create: {
          studentId: enrollment.studentId,
          absenceRate,
          flagged,
          windowStart,
          windowEnd,
        },
        update: { absenceRate, flagged, windowStart, windowEnd },
      });

      if (flagged && !wasFlagged) {
        await this.alert(enrollment, absenceRate, policy);
      }
    }
  }

  /** Class teacher and the school's admins (school-wide, or of that campus); guardians if enabled. */
  private async alert(
    enrollment: {
      studentId: string;
      sectionId: string;
      campusId: string;
      campus: { schoolId: string };
    },
    absenceRate: number,
    policy: AttendanceRiskPolicyValues,
  ): Promise<void> {
    const [section, admins, student] = await Promise.all([
      this.prisma.section.findUnique({
        where: { id: enrollment.sectionId },
        select: { classTeacher: { select: { userId: true } } },
      }),
      this.prisma.user.findMany({
        where: {
          role: 'SCHOOL_ADMIN',
          schoolId: enrollment.campus.schoolId,
          OR: [{ campusId: null }, { campusId: enrollment.campusId }],
        },
        select: { id: true },
      }),
      this.prisma.student.findUnique({
        where: { id: enrollment.studentId },
        select: { name: true },
      }),
    ]);
    const name = student?.name ?? 'A student';
    const percent = Math.round(absenceRate * 100);
    const staff = new Set<string>(admins.map((a) => a.id));
    if (section?.classTeacher) staff.add(section.classTeacher.userId);
    for (const userId of staff) {
      await this.notificationsService.notify({
        userId,
        type: 'attendance-risk',
        title: 'Attendance risk flagged',
        body: `${name} has an absence rate of ${percent}% over the last ${policy.windowDays} days.`,
        entityRef: enrollment.studentId,
      });
    }
    if (!policy.notifyParents) return;
    const guardians = await this.prisma.studentParent.findMany({
      where: { studentId: enrollment.studentId },
      select: { parentProfile: { select: { userId: true } } },
    });
    for (const userId of new Set(
      guardians.map((g) => g.parentProfile.userId),
    )) {
      await this.notificationsService.notify({
        userId,
        type: 'attendance-risk',
        title: 'Attendance concern',
        body: `${name} has been absent on ${percent}% of school days over the last ${policy.windowDays} days. Please contact the school.`,
        entityRef: enrollment.studentId,
      });
    }
  }

  private async policiesFor(
    schoolIds: string[],
  ): Promise<Map<string, AttendanceRiskPolicyValues>> {
    if (schoolIds.length === 0) return new Map();
    const rows = await this.prisma.attendanceRiskPolicy.findMany({
      where: { schoolId: { in: schoolIds } },
    });
    return new Map(rows.map((r) => [r.schoolId, pickValues(r)]));
  }

  /** BL-28: a school's settings (defaults when it has none). */
  async getPolicy(
    actor: RequestUser,
    schoolId?: string,
  ): Promise<AttendanceRiskPolicyValues & { schoolId: string }> {
    const id = await this.policySchool(actor, schoolId, false);
    const row = await this.prisma.attendanceRiskPolicy.findUnique({
      where: { schoolId: id },
    });
    return { schoolId: id, ...(row ? pickValues(row) : RISK_DEFAULTS) };
  }

  async updatePolicy(
    actor: RequestUser,
    dto: AttendanceRiskPolicyValues & { schoolId?: string },
  ): Promise<AttendanceRiskPolicyValues & { schoolId: string }> {
    const schoolId = await this.policySchool(actor, dto.schoolId, true);
    const values = pickValues(dto);
    if (values.minTrackedDays > values.windowDays) {
      throw new BadRequestException(
        'The minimum tracked days cannot exceed the window',
      );
    }
    const before = await this.getPolicy(actor, schoolId);
    await this.prisma.$transaction([
      this.prisma.attendanceRiskPolicy.upsert({
        where: { schoolId },
        create: { schoolId, ...values, updatedById: actor.id },
        update: { ...values, updatedById: actor.id },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: actor.id,
          action: 'attendance-risk-policy.update',
          entity: 'School',
          entityId: schoolId,
          metadata: JSON.stringify({
            before: pickValues(before),
            after: values,
          }),
        },
      }),
    ]);
    return { schoolId, ...values };
  }

  private async policySchool(
    actor: RequestUser,
    requestedSchoolId: string | undefined,
    write: boolean,
  ): Promise<string> {
    const scope = await this.orgScope.resolve(actor);
    if (scope.unrestricted) {
      if (!requestedSchoolId) {
        throw new BadRequestException('schoolId is required');
      }
      const school = await this.prisma.school.findUnique({
        where: { id: requestedSchoolId },
        select: { id: true },
      });
      if (!school) throw new NotFoundException('School not found');
      return school.id;
    }
    if (scope.denied || !scope.schoolId) {
      throw new ForbiddenException('No school is assigned to this account');
    }
    if (requestedSchoolId && requestedSchoolId !== scope.schoolId) {
      throw new ForbiddenException(
        "You can only see or change your own school's attendance-risk settings",
      );
    }
    if (write && scope.campusId !== null) {
      throw new ForbiddenException(
        'Only a school-wide administrator can change the attendance-risk settings',
      );
    }
    return scope.schoolId;
  }

  async getForStudent(studentId: string): Promise<AttendanceRiskSummary> {
    const record = await this.prisma.attendanceRiskFlag.findUnique({
      where: { studentId },
      include: { student: { select: { name: true } } },
    });
    if (!record) {
      throw new NotFoundException(
        'No attendance-risk data for this student yet',
      );
    }
    return this.toSummary(record);
  }

  async getFlagged(sectionIds?: string[]): Promise<AttendanceRiskSummary[]> {
    const records = await this.prisma.attendanceRiskFlag.findMany({
      where: {
        flagged: true,
        ...(sectionIds
          ? {
              student: {
                enrollments: {
                  some: { sectionId: { in: sectionIds }, status: 'ACTIVE' },
                },
              },
            }
          : {}),
      },
      include: { student: { select: { name: true } } },
      orderBy: { absenceRate: 'desc' },
    });
    return records.map((r) => this.toSummary(r));
  }
}
