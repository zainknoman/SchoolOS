import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestUser } from '../common/student-access.service';

export interface TeacherSummary {
  id: string;
  name: string;
}

export interface MyDayClass {
  timetableId: string;
  sectionId: string;
  className: string;
  sectionName: string;
  subjectName: string;
  period: number;
  startTime: string;
  endTime: string;
  room: string | null;
  attendanceMarked: boolean;
}

export interface MyDayDiaryDue {
  id: string;
  className: string;
  sectionName: string;
  subjectName: string;
  text: string;
}

export interface MyDaySummary {
  classesToday: MyDayClass[];
  diaryDueToday: MyDayDiaryDue[];
}

export interface GradebookClassRow {
  sectionId: string;
  subjectId: string;
  className: string;
  sectionName: string;
  subjectName: string;
  termLabel: string | null;
  studentsCount: number;
  marksEnteredCount: number;
}

export interface UpcomingExamRow {
  termId: string;
  label: string;
  startDate: string;
  daysUntil: number;
}

export interface GradebookOverview {
  classes: GradebookClassRow[];
  upcomingExams: UpcomingExamRow[];
}

function dateOnlyUtc(d: Date): Date {
  return new Date(d.toISOString().slice(0, 10));
}

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll(actingUser: RequestUser, campusId?: string): Promise<TeacherSummary[]> {
    let where: Prisma.TeacherWhereInput | undefined = campusId ? { campusId } : undefined;
    if (actingUser.role !== 'SUPER_ADMIN') {
      const admin = await this.prisma.user.findUnique({ where: { id: actingUser.id } });
      if (!admin?.schoolId) {
        return [];
      }
      where = { ...where, campus: { schoolId: admin.schoolId } };
    }
    const teachers = await this.prisma.teacher.findMany({ where, orderBy: { name: 'asc' } });
    return teachers.map((t) => ({ id: t.id, name: t.name }));
  }

  private async requireTeacher(userId: string): Promise<{ id: string }> {
    const teacher = await this.prisma.teacher.findUnique({ where: { userId }, select: { id: true } });
    if (!teacher) {
      throw new NotFoundException('No teacher profile for this account');
    }
    return teacher;
  }

  async getMyDay(actingUser: RequestUser): Promise<MyDaySummary> {
    const teacher = await this.requireTeacher(actingUser.id);
    const today = dateOnlyUtc(new Date());
    const dayOfWeek = today.getUTCDay();

    const entries = await this.prisma.timetable.findMany({
      where: { teacherId: teacher.id, dayOfWeek },
      orderBy: { period: 'asc' },
      select: {
        id: true,
        sectionId: true,
        period: true,
        startTime: true,
        endTime: true,
        room: true,
        section: { select: { name: true, class: { select: { name: true } } } },
        subject: { select: { name: true } },
      },
    });

    const classesToday = await Promise.all(
      entries.map(async (e): Promise<MyDayClass> => {
        const marked = await this.prisma.attendance.count({
          where: { date: today, student: { enrollments: { some: { sectionId: e.sectionId } } } },
        });
        return {
          timetableId: e.id,
          sectionId: e.sectionId,
          className: e.section.class.name,
          sectionName: e.section.name,
          subjectName: e.subject.name,
          period: e.period,
          startTime: e.startTime,
          endTime: e.endTime,
          room: e.room,
          attendanceMarked: marked > 0,
        };
      }),
    );

    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const diaryEntries = await this.prisma.diaryEntry.findMany({
      where: { authorId: actingUser.id, dueDate: { gte: today, lt: tomorrow } },
      select: {
        id: true,
        text: true,
        section: { select: { name: true, class: { select: { name: true } } } },
        subject: { select: { name: true } },
      },
    });
    const diaryDueToday: MyDayDiaryDue[] = diaryEntries.map((d) => ({
      id: d.id,
      className: d.section.class.name,
      sectionName: d.section.name,
      subjectName: d.subject.name,
      text: d.text,
    }));

    return { classesToday, diaryDueToday };
  }

  async getGradebookOverview(actingUser: RequestUser): Promise<GradebookOverview> {
    const teacher = await this.requireTeacher(actingUser.id);

    const taught = await this.prisma.timetable.findMany({
      where: { teacherId: teacher.id },
      distinct: ['sectionId', 'subjectId'],
      select: {
        sectionId: true,
        subjectId: true,
        section: {
          select: { name: true, class: { select: { id: true, name: true, academicSessionId: true } } },
        },
        subject: { select: { name: true } },
      },
    });

    const classes = await Promise.all(
      taught.map(async (t): Promise<GradebookClassRow> => {
        const [studentsCount, category] = await Promise.all([
          this.prisma.enrollment.count({ where: { sectionId: t.sectionId, status: 'ACTIVE' } }),
          this.prisma.assessmentCategory.findFirst({
            where: { classId: t.section.class.id, term: { academicSession: { isActive: true } } },
            orderBy: { createdAt: 'desc' },
            select: { id: true, term: { select: { label: true } } },
          }),
        ]);

        let marksEnteredCount = 0;
        let termLabel: string | null = null;
        if (category) {
          termLabel = category.term.label;
          const assessment = await this.prisma.assessment.findFirst({
            where: { assessmentCategoryId: category.id, subjectId: t.subjectId },
            select: { id: true },
          });
          if (assessment) {
            marksEnteredCount = await this.prisma.mark.count({
              where: {
                assessmentId: assessment.id,
                student: { enrollments: { some: { sectionId: t.sectionId } } },
              },
            });
          }
        }

        return {
          sectionId: t.sectionId,
          subjectId: t.subjectId,
          className: t.section.class.name,
          sectionName: t.section.name,
          subjectName: t.subject.name,
          termLabel,
          studentsCount,
          marksEnteredCount,
        };
      }),
    );

    const classIds = [...new Set(taught.map((t) => t.section.class.id))];
    const today = dateOnlyUtc(new Date());
    const terms =
      classIds.length === 0
        ? []
        : await this.prisma.term.findMany({
            where: { academicSession: { classes: { some: { id: { in: classIds } } } }, startDate: { gte: today } },
            orderBy: { startDate: 'asc' },
            take: 5,
            select: { id: true, label: true, startDate: true },
          });
    const upcomingExams: UpcomingExamRow[] = terms.map((term) => ({
      termId: term.id,
      label: term.label,
      startDate: term.startDate.toISOString(),
      daysUntil: Math.round((dateOnlyUtc(term.startDate).getTime() - today.getTime()) / (24 * 60 * 60 * 1000)),
    }));

    return { classes, upcomingExams };
  }
}
