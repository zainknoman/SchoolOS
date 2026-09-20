import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HolidaysService } from '../holidays/holidays.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  RISK_MIN_TRACKED_DAYS,
  RISK_THRESHOLD,
  RISK_WINDOW_DAYS,
} from './attendance-risk.constants';

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
   * opens the dashboard.
   */
  async recomputeAll(): Promise<void> {
    const windowEnd = new Date();
    windowEnd.setUTCHours(0, 0, 0, 0);
    const windowStart = new Date(windowEnd);
    windowStart.setUTCDate(windowStart.getUTCDate() - RISK_WINDOW_DAYS);

    const activeEnrollments = await this.prisma.enrollment.findMany({
      where: { status: 'ACTIVE' },
      select: { studentId: true, campusId: true, sectionId: true },
    });

    for (const enrollment of activeEnrollments) {
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

      if (trackedDays < RISK_MIN_TRACKED_DAYS) {
        continue;
      }

      const absenceRate = absentDays / trackedDays;
      const flagged = absenceRate >= RISK_THRESHOLD;

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
        await this.notifyClassTeacher(
          enrollment.studentId,
          enrollment.sectionId,
          absenceRate,
        );
      }
    }
  }

  private async notifyClassTeacher(
    studentId: string,
    sectionId: string,
    absenceRate: number,
  ): Promise<void> {
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
    });
    if (!section?.classTeacherId) return;
    const teacher = await this.prisma.teacher.findUnique({
      where: { id: section.classTeacherId },
    });
    if (!teacher) return;
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });

    await this.notificationsService.notify({
      userId: teacher.userId,
      type: 'attendance-risk',
      title: 'Attendance risk flagged',
      body: `${student?.name ?? 'A student'} has an absence rate of ${Math.round(absenceRate * 100)}% over the last ${RISK_WINDOW_DAYS} days.`,
      entityRef: studentId,
    });
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
