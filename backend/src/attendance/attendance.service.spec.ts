import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { HolidaysService } from '../holidays/holidays.service';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let prisma: {
    teacher: { findUnique: jest.Mock };
    section: { findUnique: jest.Mock };
    attendance: {
      upsert: jest.Mock;
      findMany: jest.Mock;
      createMany: jest.Mock;
      updateMany: jest.Mock;
    };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let enrollmentService: {
    getCurrentEnrollment: jest.Mock;
    getEnrollmentForDate: jest.Mock;
  };
  let holidaysService: { isHoliday: jest.Mock; findMany: jest.Mock };

  beforeEach(async () => {
    prisma = {
      teacher: { findUnique: jest.fn() },
      section: { findUnique: jest.fn() },
      attendance: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        createMany: jest.fn(),
        updateMany: jest.fn(),
      },
      auditLog: { create: jest.fn() },
      $transaction: jest
        .fn()
        .mockImplementation((cb: (tx: typeof prisma) => Promise<unknown>) =>
          cb(prisma),
        ),
    };
    enrollmentService = {
      getCurrentEnrollment: jest.fn(),
      getEnrollmentForDate: jest.fn().mockRejectedValue(new Error('none')),
    };
    holidaysService = {
      isHoliday: jest.fn().mockResolvedValue(false),
      findMany: jest.fn().mockResolvedValue([]),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: EnrollmentService, useValue: enrollmentService },
        { provide: HolidaysService, useValue: holidaysService },
      ],
    }).compile();
    service = moduleRef.get(AttendanceService);
  });

  it('marks attendance (upsert on studentId+date) and writes an audit log entry', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 'teacher-1' });
    prisma.attendance.upsert.mockResolvedValue({ id: 'att-1' });
    enrollmentService.getCurrentEnrollment.mockResolvedValue({
      campusId: 'campus-1',
    });

    await service.markAttendance(
      { studentId: 's1', date: '2026-08-27', status: 'ABSENT' },
      'teacher-user-1',
    );

    expect(prisma.attendance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          studentId_date: { studentId: 's1', date: new Date('2026-08-27') },
        },
        create: expect.objectContaining({
          studentId: 's1',
          status: 'ABSENT',
          markedById: 'teacher-1',
        }),
        update: expect.objectContaining({
          status: 'ABSENT',
          markedById: 'teacher-1',
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'attendance.mark',
          entity: 'Attendance',
        }),
      }),
    );
  });

  // BL-60 replaced: an admin was attributed to the class teacher (and refused without one).
  it('an admin with no Teacher profile is recorded as the actor, with no Teacher attribution', async () => {
    prisma.teacher.findUnique.mockResolvedValue(null);
    enrollmentService.getCurrentEnrollment.mockResolvedValue({
      sectionId: 'sec-1',
    });
    prisma.attendance.upsert.mockResolvedValue({ id: 'att-1' });

    await service.markAttendance(
      { studentId: 's1', date: '2026-08-27', status: 'ABSENT' },
      'admin-user-1',
    );

    expect(prisma.attendance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          markedById: null,
          markedByUserId: 'admin-user-1',
        }),
        update: expect.objectContaining({
          markedById: null,
          markedByUserId: 'admin-user-1',
        }),
      }),
    );
    // The section's class teacher is never looked up as a stand-in.
    expect(prisma.section.findUnique).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'admin-user-1' }),
      }),
    );
  });

  it('a teacher is recorded both as the actor and as the Teacher', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 'teacher-1' });
    enrollmentService.getCurrentEnrollment.mockResolvedValue({
      sectionId: 'sec-1',
    });
    prisma.attendance.upsert.mockResolvedValue({ id: 'att-1' });

    await service.markAttendance(
      { studentId: 's1', date: '2026-08-27', status: 'PRESENT' },
      'teacher-user-1',
    );

    expect(prisma.attendance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          markedById: 'teacher-1',
          markedByUserId: 'teacher-user-1',
        }),
      }),
    );
  });

  it('summarizes a month: counts by status and a percentage present', async () => {
    prisma.attendance.findMany.mockResolvedValue([
      { date: new Date('2026-08-01'), status: 'PRESENT' },
      { date: new Date('2026-08-02'), status: 'PRESENT' },
      { date: new Date('2026-08-03'), status: 'ABSENT' },
      { date: new Date('2026-08-04'), status: 'LATE' },
      { date: new Date('2026-08-05'), status: 'HOLIDAY' },
    ]);

    const result = await service.getForStudent('s1', '2026-08');

    // Percentage excludes holidays from the denominator — a holiday isn't a chance to attend.
    expect(result.summary).toEqual({
      present: 2,
      absent: 1,
      late: 1,
      holiday: 1,
      leave: 0,
      calendarHolidayCount: 0,
      attendancePercentage: 50,
    });
    expect(result.days).toHaveLength(5);
  });

  // KI-19: a day covered by a calendar holiday that also has a HOLIDAY attendance row (marked
  // before the Holiday model existed) is counted once, under `holiday`, not twice.
  it('does not count a calendar-holiday day twice when it also has a HOLIDAY row', async () => {
    prisma.attendance.findMany.mockResolvedValue([
      { date: new Date('2026-08-04'), status: 'PRESENT' },
      { date: new Date('2026-08-05'), status: 'HOLIDAY' },
    ]);
    enrollmentService.getEnrollmentForDate.mockResolvedValue({
      campusId: 'c1',
    });
    holidaysService.findMany.mockResolvedValue([
      { startDate: '2026-08-05', endDate: '2026-08-06' },
    ]);

    const result = await service.getForStudent('s1', '2026-08');

    expect(result.summary.holiday).toBe(1);
    expect(result.summary.calendarHolidayCount).toBe(1);
  });

  it('getForSection returns a studentId->status map of what was already marked that day', async () => {
    prisma.attendance.findMany.mockResolvedValue([
      { studentId: 's1', status: 'PRESENT' },
      { studentId: 's2', status: 'ABSENT' },
    ]);

    const result = await service.getForSection('sec-1', '2026-08-27');

    expect(prisma.attendance.findMany).toHaveBeenCalledWith({
      where: {
        date: new Date('2026-08-27T00:00:00.000Z'),
        student: {
          enrollments: { some: { sectionId: 'sec-1', status: 'ACTIVE' } },
        },
      },
      select: { studentId: true, status: true },
    });
    expect(result).toEqual({ s1: 'PRESENT', s2: 'ABSENT' });
  });

  it('getForSection returns an empty map when nothing has been marked yet', async () => {
    prisma.attendance.findMany.mockResolvedValue([]);

    const result = await service.getForSection('sec-1', '2026-08-27');

    expect(result).toEqual({});
  });

  describe('markBulk', () => {
    it('throws BadRequestException when marks is empty', async () => {
      await expect(
        service.markBulk({ date: '2026-09-01', marks: [] }, 'teacher-user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects marking on a declared holiday, before writing anything', async () => {
      enrollmentService.getCurrentEnrollment.mockResolvedValue({
        campusId: 'campus-1',
      });
      holidaysService.isHoliday.mockResolvedValue(true);

      await expect(
        service.markBulk(
          {
            date: '2026-09-01',
            marks: [{ studentId: 's1', status: 'PRESENT' }],
          },
          'teacher-user-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.attendance.upsert).not.toHaveBeenCalled();
    });

    function givenBulk(teacher: { id: string } | null) {
      enrollmentService.getCurrentEnrollment.mockResolvedValue({
        campusId: 'campus-1',
        sectionId: 'sec-1',
      });
      holidaysService.isHoliday.mockResolvedValue(false);
      prisma.teacher.findUnique.mockResolvedValue(teacher);
      prisma.attendance.createMany.mockResolvedValue({ count: 0 });
      prisma.attendance.updateMany.mockResolvedValue({ count: 0 });
      prisma.attendance.findMany.mockImplementation(
        ({ where }: { where: { studentId: { in: string[] } } }) =>
          Promise.resolve(
            [...where.studentId.in]
              .reverse()
              .map((studentId) => ({ id: `att-${studentId}`, studentId })),
          ),
      );
    }

    it('upserts every mark in one transaction, attributed to the marking teacher, and writes one bulk audit log entry', async () => {
      givenBulk({ id: 'teacher-1' });
      const date = new Date('2026-09-01');

      const records = await service.markBulk(
        {
          date: '2026-09-01',
          marks: [
            { studentId: 's1', status: 'PRESENT' },
            { studentId: 's2', status: 'ABSENT' },
          ],
        },
        'teacher-user-1',
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      // New rows are inserted; rows that already exist are left to the updates below.
      expect(prisma.attendance.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            studentId: 's1',
            date,
            status: 'PRESENT',
            markedById: 'teacher-1',
            markedByUserId: 'teacher-user-1',
          }),
          expect.objectContaining({
            studentId: 's2',
            date,
            status: 'ABSENT',
            markedById: 'teacher-1',
          }),
        ],
        skipDuplicates: true,
      });
      expect(prisma.attendance.updateMany).toHaveBeenCalledWith({
        where: { date, studentId: { in: ['s1'] } },
        data: {
          status: 'PRESENT',
          markedById: 'teacher-1',
          markedByUserId: 'teacher-user-1',
        },
      });
      expect(prisma.attendance.updateMany).toHaveBeenCalledWith({
        where: { date, studentId: { in: ['s2'] } },
        data: expect.objectContaining({ status: 'ABSENT' }),
      });
      // The saved rows come back in the order they were sent.
      expect(records.map((r) => r.studentId)).toEqual(['s1', 's2']);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'teacher-user-1',
            action: 'attendance.mark-bulk',
            entity: 'Attendance',
          }),
        }),
      );
    });

    // BL-15: bulk marking was one upsert per student (a 35-student section = 35 round trips inside
    // one transaction, holding a pooled connection for seconds under load). It is now a fixed
    // number of statements: one insert, one update per status used, one read.
    it('uses a fixed number of statements whatever the class size', async () => {
      givenBulk({ id: 'teacher-1' });
      const statuses = ['PRESENT', 'ABSENT', 'LATE'] as const;
      const marks = Array.from({ length: 40 }, (_, i) => ({
        studentId: `s${i}`,
        status: statuses[i % 3],
      }));

      const records = await service.markBulk(
        { date: '2026-09-01', marks },
        'teacher-user-1',
      );

      expect(prisma.attendance.upsert).not.toHaveBeenCalled();
      expect(prisma.attendance.createMany).toHaveBeenCalledTimes(1);
      expect(prisma.attendance.updateMany).toHaveBeenCalledTimes(3);
      expect(prisma.attendance.findMany).toHaveBeenCalledTimes(1);
      expect(records).toHaveLength(40);
    });

    it('keeps the last status when a student appears twice in one batch', async () => {
      givenBulk({ id: 'teacher-1' });

      const records = await service.markBulk(
        {
          date: '2026-09-01',
          marks: [
            { studentId: 's1', status: 'PRESENT' },
            { studentId: 's1', status: 'ABSENT' },
          ],
        },
        'teacher-user-1',
      );

      expect(prisma.attendance.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ studentId: 's1', status: 'ABSENT' })],
        skipDuplicates: true,
      });
      expect(prisma.attendance.updateMany).toHaveBeenCalledTimes(1);
      expect(records).toHaveLength(1);
    });

    // BL-60 replaced: bulk marking by an admin used to borrow each student's class teacher.
    it('bulk marking by an admin records the admin, never a class teacher', async () => {
      givenBulk(null);

      await service.markBulk(
        { date: '2026-09-01', marks: [{ studentId: 's1', status: 'PRESENT' }] },
        'admin-user-1',
      );

      expect(prisma.attendance.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            markedById: null,
            markedByUserId: 'admin-user-1',
          }),
        ],
        skipDuplicates: true,
      });
      expect(prisma.section.findUnique).not.toHaveBeenCalled();
    });
  });
});
