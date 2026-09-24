import { Test } from '@nestjs/testing';
import { TeachersService } from './teachers.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';

describe('TeachersService', () => {
  let service: TeachersService;
  let prisma: {
    teacher: { findMany: jest.Mock; findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
    timetable: { findMany: jest.Mock };
    attendance: { count: jest.Mock };
    diaryEntry: { findMany: jest.Mock };
    enrollment: { count: jest.Mock };
    assessmentCategory: { findFirst: jest.Mock };
    assessment: { findFirst: jest.Mock };
    mark: { count: jest.Mock };
    term: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      teacher: { findMany: jest.fn(), findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
      timetable: { findMany: jest.fn().mockResolvedValue([]) },
      attendance: { count: jest.fn().mockResolvedValue(0) },
      diaryEntry: { findMany: jest.fn().mockResolvedValue([]) },
      enrollment: { count: jest.fn().mockResolvedValue(0) },
      assessmentCategory: { findFirst: jest.fn().mockResolvedValue(null) },
      assessment: { findFirst: jest.fn().mockResolvedValue(null) },
      mark: { count: jest.fn().mockResolvedValue(0) },
      term: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        TeachersService,
        { provide: PrismaService, useValue: prisma },
        OrgScopeService,
      ],
    }).compile();
    service = moduleRef.get(TeachersService);
    // BL-40: list methods also count the matching rows.
    Object.assign(prisma.teacher, { count: jest.fn().mockResolvedValue(0) });
  });

  it('lists every teacher ordered by name for a SUPER_ADMIN', async () => {
    prisma.teacher.findMany.mockResolvedValue([
      { id: 't-1', name: 'Ms. Sample Teacher' },
    ]);

    const result = (
      await service.listAll({
        id: 'super-1',
        role: 'SUPER_ADMIN',
      })
    ).items;

    expect(prisma.teacher.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined, orderBy: { name: 'asc' } }),
    );
    expect(result).toEqual([{ id: 't-1', name: 'Ms. Sample Teacher' }]);
  });

  it("scopes a SCHOOL_ADMIN's teacher list to their own school", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-1',
      schoolId: 'school-1',
    });
    prisma.teacher.findMany.mockResolvedValue([
      { id: 't-1', name: 'Ms. Sample Teacher' },
    ]);

    const result = (
      await service.listAll({
        id: 'admin-1',
        role: 'SCHOOL_ADMIN',
      })
    ).items;

    expect(prisma.teacher.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { campus: { schoolId: 'school-1' } } }),
    );
    expect(result).toEqual([{ id: 't-1', name: 'Ms. Sample Teacher' }]);
  });

  it('fails closed (returns an empty list) for a SCHOOL_ADMIN with no schoolId', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', schoolId: null });

    const result = (
      await service.listAll({
        id: 'admin-1',
        role: 'SCHOOL_ADMIN',
      })
    ).items;

    expect(result).toEqual([]);
    expect(prisma.teacher.findMany).not.toHaveBeenCalled();
  });

  it('filters a SUPER_ADMIN teacher list to one campus when campusId is given', async () => {
    prisma.teacher.findMany.mockResolvedValue([{ id: 't-1', name: 'Ms. A' }]);

    await service.listAll({ id: 'super-1', role: 'SUPER_ADMIN' }, 'campus-1');

    expect(prisma.teacher.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { campusId: 'campus-1' } }),
    );
  });

  it('intersects the campusId filter with a SCHOOL_ADMIN school scope', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-1',
      schoolId: 'school-1',
    });
    prisma.teacher.findMany.mockResolvedValue([]);

    await service.listAll({ id: 'admin-1', role: 'SCHOOL_ADMIN' }, 'campus-9');

    expect(prisma.teacher.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { campusId: 'campus-9', campus: { schoolId: 'school-1' } },
      }),
    );
  });

  describe('getMyDay', () => {
    const teacherUser = { id: 'user-1', role: 'TEACHER' };

    it('throws NotFoundException when the acting user has no Teacher profile', async () => {
      prisma.teacher.findUnique.mockResolvedValue(null);

      await expect(service.getMyDay(teacherUser)).rejects.toThrow(
        'No teacher profile for this account',
      );
    });

    it("lists today's timetable entries with an attendance-marked flag per section", async () => {
      prisma.teacher.findUnique.mockResolvedValue({ id: 'teacher-1' });
      prisma.timetable.findMany.mockResolvedValue([
        {
          id: 'tt-1',
          sectionId: 'sec-1',
          period: 1,
          startTime: '08:00',
          endTime: '08:40',
          room: 'Room 14',
          section: { name: 'A', class: { name: '6' } },
          subject: { name: 'Mathematics' },
        },
      ]);
      prisma.attendance.count.mockResolvedValue(34);

      const result = await service.getMyDay(teacherUser);

      expect(result.classesToday).toEqual([
        {
          timetableId: 'tt-1',
          sectionId: 'sec-1',
          className: '6',
          sectionName: 'A',
          subjectName: 'Mathematics',
          period: 1,
          startTime: '08:00',
          endTime: '08:40',
          room: 'Room 14',
          attendanceMarked: true,
        },
      ]);
      expect(prisma.timetable.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { teacherId: 'teacher-1', dayOfWeek: expect.any(Number) },
        }),
      );
    });

    it('lists diary entries due today, authored by the acting teacher', async () => {
      prisma.teacher.findUnique.mockResolvedValue({ id: 'teacher-1' });
      prisma.diaryEntry.findMany.mockResolvedValue([
        {
          id: 'd1',
          text: 'Ch. 4 exercises',
          section: { name: 'A', class: { name: '6' } },
          subject: { name: 'Mathematics' },
        },
      ]);

      const result = await service.getMyDay(teacherUser);

      expect(result.diaryDueToday).toEqual([
        {
          id: 'd1',
          className: '6',
          sectionName: 'A',
          subjectName: 'Mathematics',
          text: 'Ch. 4 exercises',
        },
      ]);
      expect(prisma.diaryEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ authorId: 'user-1' }),
        }),
      );
    });
  });

  describe('getGradebookOverview', () => {
    const teacherUser = { id: 'user-1', role: 'TEACHER' };

    it('reports marks-entered progress per distinct section/subject the teacher teaches', async () => {
      prisma.teacher.findUnique.mockResolvedValue({ id: 'teacher-1' });
      prisma.timetable.findMany.mockResolvedValue([
        {
          sectionId: 'sec-1',
          subjectId: 'subj-1',
          section: {
            name: 'A',
            class: { id: 'class-1', name: '6', academicSessionId: 'session-1' },
          },
          subject: { name: 'Mathematics' },
        },
      ]);
      prisma.enrollment.count.mockResolvedValue(34);
      prisma.assessmentCategory.findFirst.mockResolvedValue({
        id: 'cat-1',
        term: { label: 'Mid-term' },
      });
      prisma.assessment.findFirst.mockResolvedValue({ id: 'assess-1' });
      prisma.mark.count.mockResolvedValue(22);

      const result = await service.getGradebookOverview(teacherUser);

      expect(result.classes).toEqual([
        {
          sectionId: 'sec-1',
          subjectId: 'subj-1',
          className: '6',
          sectionName: 'A',
          subjectName: 'Mathematics',
          termLabel: 'Mid-term',
          studentsCount: 34,
          marksEnteredCount: 22,
        },
      ]);
    });

    it('reports zero marks entered when no assessment exists yet for that subject/category', async () => {
      prisma.teacher.findUnique.mockResolvedValue({ id: 'teacher-1' });
      prisma.timetable.findMany.mockResolvedValue([
        {
          sectionId: 'sec-1',
          subjectId: 'subj-1',
          section: {
            name: 'A',
            class: { id: 'class-1', name: '6', academicSessionId: 'session-1' },
          },
          subject: { name: 'Mathematics' },
        },
      ]);
      prisma.enrollment.count.mockResolvedValue(34);
      prisma.assessmentCategory.findFirst.mockResolvedValue(null);

      const result = await service.getGradebookOverview(teacherUser);

      expect(result.classes[0]).toMatchObject({
        termLabel: null,
        marksEnteredCount: 0,
      });
      expect(prisma.mark.count).not.toHaveBeenCalled();
    });

    it('lists upcoming terms (within the taught classes) as the exam countdown', async () => {
      prisma.teacher.findUnique.mockResolvedValue({ id: 'teacher-1' });
      prisma.timetable.findMany.mockResolvedValue([
        {
          sectionId: 'sec-1',
          subjectId: 'subj-1',
          section: {
            name: 'A',
            class: { id: 'class-1', name: '6', academicSessionId: 'session-1' },
          },
          subject: { name: 'Mathematics' },
        },
      ]);
      const future = new Date();
      future.setUTCDate(future.getUTCDate() + 10);
      prisma.term.findMany.mockResolvedValue([
        { id: 'term-1', label: 'Mid-term — Grade 6', startDate: future },
      ]);

      const result = await service.getGradebookOverview(teacherUser);

      expect(result.upcomingExams).toEqual([
        {
          termId: 'term-1',
          label: 'Mid-term — Grade 6',
          startDate: future.toISOString(),
          daysUntil: 10,
        },
      ]);
    });
  });
});
