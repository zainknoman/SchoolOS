import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { HolidaysService } from '../holidays/holidays.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { BulkMarkAttendanceDto } from './dto/bulk-mark-attendance.dto';

export interface AttendanceDay {
  date: string;
  status: string;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  holiday: number;
  leave: number;
  attendancePercentage: number;
  // Days in the requested range covered by a calendar-wide Holiday row, counted separately from
  // `holiday` (which only counts per-row HOLIDAY-status Attendance rows). A date can appear in
  // both if historical data was marked before the Holiday model existed — this sums rather than
  // deduplicating, a known/documented edge case, not silently resolved.
  calendarHolidayCount: number;
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollmentService: EnrollmentService,
    private readonly holidaysService: HolidaysService,
  ) {}

  async assertNotHoliday(date: Date, campusId: string): Promise<void> {
    const isHoliday = await this.holidaysService.isHoliday(date, campusId);
    if (isHoliday) {
      throw new BadRequestException('Cannot mark attendance on a declared holiday');
    }
  }

  /**
   * Attendance is immutable from the parent side by construction — this is the ONLY write path,
   * and it lives behind the `@Roles('TEACHER','SCHOOL_ADMIN','SUPER_ADMIN')` guard on the
   * controller, never exposed to PARENT. Every write is audit-logged (never skippable).
   *
   * `Attendance.markedById` is a required Teacher FK. A TEACHER has a Teacher profile and is
   * attributed directly; a SCHOOL_ADMIN/SUPER_ADMIN doesn't, so — mirroring
   * LeaveService.approve()'s identical problem for admin-approved leave — the write is attributed
   * to the student's current section's class teacher instead. The AuditLog row still names the
   * real acting user (markingUserId), regardless of whose Teacher id the FK points at.
   */
  async markAttendance(dto: MarkAttendanceDto, markingUserId: string) {
    const enrollment = await this.enrollmentService.getCurrentEnrollment(dto.studentId);
    const date = new Date(dto.date);
    await this.assertNotHoliday(date, enrollment.campusId);

    const teacher = await this.prisma.teacher.findUnique({
      where: { userId: markingUserId },
    });
    const markedById = teacher ? teacher.id : await this.resolveClassTeacherIdFrom(enrollment);

    const record = await this.prisma.attendance.upsert({
      where: { studentId_date: { studentId: dto.studentId, date } },
      create: {
        studentId: dto.studentId,
        date,
        status: dto.status,
        markedById,
      },
      update: { status: dto.status, markedById },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: markingUserId,
        action: 'attendance.mark',
        entity: 'Attendance',
        entityId: record.id,
        metadata: JSON.stringify({
          studentId: dto.studentId,
          date: dto.date,
          status: dto.status,
        }),
      },
    });

    return record;
  }

  private async resolveClassTeacherIdFrom(enrollment: { sectionId: string }): Promise<string> {
    const section = await this.prisma.section.findUnique({ where: { id: enrollment.sectionId } });
    if (!section?.classTeacherId) {
      throw new BadRequestException(
        "Cannot mark attendance: this student's section has no class teacher assigned",
      );
    }
    return section.classTeacherId;
  }

  /**
   * One request marks N students for the same date in a single transaction, plus exactly one
   * AuditLog row summarizing the batch — mirrors TimetableService.replaceForSection's
   * transactional bulk pattern rather than one audit row per student.
   */
  async markBulk(dto: BulkMarkAttendanceDto, markingUserId: string) {
    if (dto.marks.length === 0) {
      throw new BadRequestException('marks must not be empty');
    }

    const date = new Date(dto.date);
    const enrollment = await this.enrollmentService.getCurrentEnrollment(dto.marks[0].studentId);
    await this.assertNotHoliday(date, enrollment.campusId);

    const teacher = await this.prisma.teacher.findUnique({ where: { userId: markingUserId } });

    const records = await this.prisma.$transaction(async (tx) => {
      const results: Awaited<ReturnType<typeof tx.attendance.upsert>>[] = [];
      for (const mark of dto.marks) {
        const markedById = teacher
          ? teacher.id
          : await this.resolveClassTeacherIdFrom(
              await this.enrollmentService.getCurrentEnrollment(mark.studentId),
            );
        const record = await tx.attendance.upsert({
          where: { studentId_date: { studentId: mark.studentId, date } },
          create: { studentId: mark.studentId, date, status: mark.status, markedById },
          update: { status: mark.status, markedById },
        });
        results.push(record);
      }

      await tx.auditLog.create({
        data: {
          userId: markingUserId,
          action: 'attendance.mark-bulk',
          entity: 'Attendance',
          metadata: JSON.stringify({
            date: dto.date,
            count: dto.marks.length,
            studentIds: dto.marks.map((m) => m.studentId),
          }),
        },
      });

      return results;
    });

    return records;
  }

  /**
   * Pre-populates the teacher's roster with whatever was already marked for this section on the
   * given date — without this, a teacher who re-opens the Attendance screen (or logs back in)
   * sees a blank roster and has to re-mark everyone, even though their earlier marks are already
   * saved (markAttendance upserts, so nothing was lost — it just was never shown back).
   */
  async getForSection(sectionId: string, dateStr: string): Promise<Record<string, string>> {
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    const records = await this.prisma.attendance.findMany({
      where: { date, student: { enrollments: { some: { sectionId, status: 'ACTIVE' } } } },
      select: { studentId: true, status: true },
    });
    return Object.fromEntries(records.map((r) => [r.studentId, r.status]));
  }

  async getForStudent(
    studentId: string,
    month: string,
  ): Promise<{ days: AttendanceDay[]; summary: AttendanceSummary }> {
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    const records = await this.prisma.attendance.findMany({
      where: { studentId, date: { gte: start, lt: end } },
      orderBy: { date: 'asc' },
    });

    const summary: AttendanceSummary = {
      present: 0,
      absent: 0,
      late: 0,
      holiday: 0,
      leave: 0,
      attendancePercentage: 0,
      calendarHolidayCount: 0,
    };

    for (const r of records) {
      switch (r.status) {
        case 'PRESENT':
          summary.present++;
          break;
        case 'ABSENT':
          summary.absent++;
          break;
        case 'LATE':
          summary.late++;
          break;
        case 'HOLIDAY':
          summary.holiday++;
          break;
        case 'LEAVE':
          summary.leave++;
          break;
      }
    }

    let calendarHolidayCount = 0;
    try {
      const enrollment = await this.enrollmentService.getEnrollmentForDate(studentId, start, end);
      const holidays = await this.holidaysService.findMany({
        campusId: enrollment.campusId,
        from: start.toISOString().slice(0, 10),
        to: new Date(end.getTime() - 1).toISOString().slice(0, 10),
      });
      const dayMs = 24 * 60 * 60_000;
      for (let t = start.getTime(); t < end.getTime(); t += dayMs) {
        const day = new Date(t);
        const covered = holidays.some(
          (h) => new Date(h.startDate) <= day && day <= new Date(h.endDate),
        );
        if (covered) calendarHolidayCount++;
      }
    } catch {
      // No enrollment covers this month (e.g. before the student joined) — no calendar holidays
      // to attribute either.
    }

    summary.calendarHolidayCount = calendarHolidayCount;

    const countable =
      summary.present + summary.absent + summary.late + summary.leave;
    summary.attendancePercentage =
      countable === 0 ? 0 : Math.round((summary.present / countable) * 100);

    return {
      days: records.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        status: r.status,
      })),
      summary,
    };
  }
}
