import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The one place every module resolves "what section/campus is this student in" — mirrors
 * StudentAccessService's role as a single shared read path, so this rule isn't re-implemented
 * (and re-broken) per module the way it was before Enrollment existed (Diary and Timetable each
 * read `student.sectionId` directly, which meant a mid-year section change silently rewrote what
 * a parent saw for past months).
 */
@Injectable()
export class EnrollmentService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentEnrollment(studentId: string) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentId, status: 'ACTIVE' },
      orderBy: { startDate: 'desc' },
    });
    if (!enrollment) {
      throw new NotFoundException('Student has no active enrollment');
    }
    return enrollment;
  }

  /**
   * Resolves which section a student belonged to as of a given date — NOT the student's current
   * section. Use for any month/date-scoped query (e.g. Diary) so a later section transfer doesn't
   * retroactively change what a past month shows.
   *
   * Pass `windowEnd` when the caller cares about a date *range* (e.g. a calendar month), not a
   * single instant — this widens the match to "does this enrollment overlap [date, windowEnd)",
   * so an enrollment that started partway through the queried range still matches. Without
   * `windowEnd`, the query is the original single-point check: does this enrollment cover `date`
   * exactly.
   */
  async getEnrollmentForDate(studentId: string, date: Date, windowEnd?: Date) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId,
        startDate: windowEnd ? { lt: windowEnd } : { lte: date },
        OR: [{ endDate: null }, { endDate: { gte: date } }],
      },
      orderBy: { startDate: 'desc' },
    });
    if (!enrollment) {
      throw new NotFoundException(
        'Student has no enrollment covering this date',
      );
    }
    return enrollment;
  }
}
