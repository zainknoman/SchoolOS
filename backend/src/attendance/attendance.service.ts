import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { HolidaysService } from '../holidays/holidays.service';
import {
  ATTENDANCE_STATUSES,
  MarkAttendanceDto,
} from './dto/mark-attendance.dto';
import { BulkMarkAttendanceDto } from './dto/bulk-mark-attendance.dto';

type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

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
  // `holiday` (which counts per-row HOLIDAY-status Attendance rows). A date that has both — data
  // marked before the Holiday model existed — is counted once, under `holiday` (KI-19).
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
      throw new BadRequestException(
        'Cannot mark attendance on a declared holiday',
      );
    }
  }

  /**
   * Attendance is immutable from the parent side by construction — this is the ONLY write path,
   * and it lives behind the `@Roles('TEACHER','SCHOOL_ADMIN','SUPER_ADMIN')` guard on the
   * controller, never exposed to PARENT. Every write is audit-logged (never skippable).
   *
   * Attribution (BL-60, migration M1): `markedByUserId` is always the real acting user;
   * `markedById` (the Teacher FK) is set only when that user IS a Teacher. An admin marking a
   * section is never attributed to the class teacher, and a class teacher is not required.
   */
  async markAttendance(dto: MarkAttendanceDto, markingUserId: string) {
    const enrollment = await this.enrollmentService.getCurrentEnrollment(
      dto.studentId,
    );
    const date = new Date(dto.date);
    await this.assertNotHoliday(date, enrollment.campusId);

    const markedBy = await this.attributionFor(markingUserId);

    const record = await this.prisma.attendance.upsert({
      where: { studentId_date: { studentId: dto.studentId, date } },
      create: {
        studentId: dto.studentId,
        date,
        status: dto.status,
        ...markedBy,
      },
      update: { status: dto.status, ...markedBy },
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

  /** Who a write is attributed to — the real actor; the Teacher FK only if the actor is one. */
  private async attributionFor(
    userId: string,
  ): Promise<{ markedByUserId: string; markedById: string | null }> {
    const teacher = await this.prisma.teacher.findUnique({
      where: { userId },
      select: { id: true },
    });
    return { markedByUserId: userId, markedById: teacher?.id ?? null };
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
    const enrollment = await this.enrollmentService.getCurrentEnrollment(
      dto.marks[0].studentId,
    );
    await this.assertNotHoliday(date, enrollment.campusId);

    const markedBy = await this.attributionFor(markingUserId);

    // One status per student; a student listed twice keeps the last status (as sequential upserts did).
    const statusByStudent = new Map<string, AttendanceStatus>();
    for (const mark of dto.marks) {
      statusByStudent.delete(mark.studentId);
      statusByStudent.set(mark.studentId, mark.status);
    }
    const studentIds = [...statusByStudent.keys()];
    const byStatus = new Map<AttendanceStatus, string[]>();
    for (const [studentId, status] of statusByStudent) {
      byStatus.set(status, [...(byStatus.get(status) ?? []), studentId]);
    }

    // BL-15: a fixed number of statements per batch (insert new rows, one update per status, read
    // back) instead of one upsert per student — the loop held a pooled connection for the whole
    // class and was the slowest call under load.
    const records = await this.prisma.$transaction(async (tx) => {
      await tx.attendance.createMany({
        data: studentIds.map((studentId) => ({
          studentId,
          date,
          status: statusByStudent.get(studentId)!,
          ...markedBy,
        })),
        skipDuplicates: true,
      });
      for (const [status, ids] of byStatus) {
        await tx.attendance.updateMany({
          where: { date, studentId: { in: ids } },
          data: { status, ...markedBy },
        });
      }
      const saved = await tx.attendance.findMany({
        where: { date, studentId: { in: studentIds } },
      });
      const byStudent = new Map(saved.map((r) => [r.studentId, r]));
      const results = studentIds
        .map((id) => byStudent.get(id))
        .filter((r) => r !== undefined);

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
  async getForSection(
    sectionId: string,
    dateStr: string,
  ): Promise<Record<string, string>> {
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    const records = await this.prisma.attendance.findMany({
      where: {
        date,
        student: { enrollments: { some: { sectionId, status: 'ACTIVE' } } },
      },
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
      const enrollment = await this.enrollmentService.getEnrollmentForDate(
        studentId,
        start,
        end,
      );
      // System-internal lookup for a campusId already derived from the student's own enrollment
      // (not caller-supplied), so it bypasses HolidaysService's caller-scoping (SUPER_ADMIN skips
      // it) rather than needing this request's actingUser threaded all the way down here.
      const holidays = await this.holidaysService.findMany(
        { id: 'system', role: 'SUPER_ADMIN' },
        {
          campusId: enrollment.campusId,
          from: start.toISOString().slice(0, 10),
          to: new Date(end.getTime() - 1).toISOString().slice(0, 10),
        },
      );
      const markedHoliday = new Set(
        records
          .filter((r) => r.status === 'HOLIDAY')
          .map((r) => r.date.toISOString().slice(0, 10)),
      );
      const dayMs = 24 * 60 * 60_000;
      for (let t = start.getTime(); t < end.getTime(); t += dayMs) {
        const day = new Date(t);
        const covered = holidays.some(
          (h) => new Date(h.startDate) <= day && day <= new Date(h.endDate),
        );
        if (covered && !markedHoliday.has(day.toISOString().slice(0, 10))) {
          calendarHolidayCount++;
        }
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
