import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AttendanceRiskService } from './attendance-risk.service';
import { PrismaService } from '../prisma/prisma.service';
import { HolidaysService } from '../holidays/holidays.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrgScopeService } from '../common/org-scope.service';
import { RISK_MIN_TRACKED_DAYS } from './attendance-risk.constants';

describe('AttendanceRiskService', () => {
  let service: AttendanceRiskService;
  let prisma: {
    enrollment: { findMany: jest.Mock };
    attendance: { findMany: jest.Mock };
    attendanceRiskFlag: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
      findMany: jest.Mock;
    };
    section: { findUnique: jest.Mock };
    teacher: { findUnique: jest.Mock };
    student: { findUnique: jest.Mock };
    attendanceRiskPolicy: { findMany: jest.Mock };
    user: { findMany: jest.Mock };
    studentParent: { findMany: jest.Mock };
  };
  let holidaysService: { isHoliday: jest.Mock };
  let notificationsService: { notify: jest.Mock };

  beforeEach(async () => {
    prisma = {
      enrollment: { findMany: jest.fn() },
      attendance: { findMany: jest.fn() },
      attendanceRiskFlag: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        findMany: jest.fn(),
      },
      section: { findUnique: jest.fn() },
      teacher: { findUnique: jest.fn() },
      student: { findUnique: jest.fn() },
      // BL-28: no saved settings = the Q8 defaults; no admins/guardians unless a test adds them.
      attendanceRiskPolicy: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      studentParent: { findMany: jest.fn().mockResolvedValue([]) },
    };
    holidaysService = { isHoliday: jest.fn().mockResolvedValue(false) };
    notificationsService = { notify: jest.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AttendanceRiskService,
        { provide: PrismaService, useValue: prisma },
        { provide: HolidaysService, useValue: holidaysService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: OrgScopeService, useValue: {} },
      ],
    }).compile();
    service = moduleRef.get(AttendanceRiskService);
  });

  function daysOfStatus(count: number, status: string, startDay = 1) {
    return Array.from({ length: count }, (_, i) => ({
      date: new Date(Date.UTC(2026, 7, startDay + i)),
      status,
    }));
  }

  it('flags a student whose absence rate meets the threshold over enough tracked days', async () => {
    prisma.enrollment.findMany.mockResolvedValue([
      {
        studentId: 's1',
        campusId: 'campus-1',
        sectionId: 'sec-1',
        campus: { schoolId: 'school-1' },
      },
    ]);
    // 8 tracked days, 2 absent => 25% >= RISK_THRESHOLD (0.25)
    prisma.attendance.findMany.mockResolvedValue([
      ...daysOfStatus(6, 'PRESENT'),
      ...daysOfStatus(2, 'ABSENT'),
    ]);
    prisma.attendanceRiskFlag.findUnique.mockResolvedValue(null); // wasFlagged = false
    prisma.attendanceRiskFlag.upsert.mockResolvedValue({});
    prisma.section.findUnique.mockResolvedValue({
      classTeacher: { userId: 'teacher-user-1' },
    });
    prisma.student.findUnique.mockResolvedValue({ name: 'Ali' });

    await service.recomputeAll();

    expect(prisma.attendanceRiskFlag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: 's1' },
        create: expect.objectContaining({
          studentId: 's1',
          absenceRate: 0.25,
          flagged: true,
        }),
        update: expect.objectContaining({ absenceRate: 0.25, flagged: true }),
      }),
    );
  });

  it('notifies the class teacher only on the false->true transition, never on repeat flags', async () => {
    prisma.enrollment.findMany.mockResolvedValue([
      {
        studentId: 's1',
        campusId: 'campus-1',
        sectionId: 'sec-1',
        campus: { schoolId: 'school-1' },
      },
    ]);
    prisma.attendance.findMany.mockResolvedValue([
      ...daysOfStatus(6, 'PRESENT'),
      ...daysOfStatus(2, 'ABSENT'),
    ]);
    prisma.attendanceRiskFlag.upsert.mockResolvedValue({});
    prisma.section.findUnique.mockResolvedValue({
      classTeacher: { userId: 'teacher-user-1' },
    });
    prisma.student.findUnique.mockResolvedValue({ name: 'Ali' });

    // Case A: previously unflagged -> notify fires
    prisma.attendanceRiskFlag.findUnique.mockResolvedValueOnce(null);
    await service.recomputeAll();
    expect(notificationsService.notify).toHaveBeenCalledTimes(1);
    expect(notificationsService.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'teacher-user-1',
        type: 'attendance-risk',
      }),
    );

    // Case B: already flagged -> no duplicate notify
    notificationsService.notify.mockClear();
    prisma.attendanceRiskFlag.findUnique.mockResolvedValueOnce({
      flagged: true,
    });
    await service.recomputeAll();
    expect(notificationsService.notify).not.toHaveBeenCalled();
  });

  it('excludes holiday days from both the tracked-day and absent-day counts', async () => {
    prisma.enrollment.findMany.mockResolvedValue([
      {
        studentId: 's1',
        campusId: 'campus-1',
        sectionId: 'sec-1',
        campus: { schoolId: 'school-1' },
      },
    ]);
    const records = [
      ...daysOfStatus(5, 'PRESENT', 1),
      ...daysOfStatus(2, 'ABSENT', 10),
    ];
    prisma.attendance.findMany.mockResolvedValue(records);
    // Mark every ABSENT day as a holiday — should be excluded entirely, not counted as absent
    holidaysService.isHoliday.mockImplementation((date: Date) =>
      Promise.resolve(
        records.some(
          (r) => r.date.getTime() === date.getTime() && r.status === 'ABSENT',
        ),
      ),
    );
    prisma.attendanceRiskFlag.findUnique.mockResolvedValue(null);
    prisma.attendanceRiskFlag.upsert.mockResolvedValue({});

    await service.recomputeAll();

    // 5 tracked (the PRESENT days, meeting RISK_MIN_TRACKED_DAYS), 0 absent => 0% => not flagged, no notify
    expect(prisma.attendanceRiskFlag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ absenceRate: 0, flagged: false }),
      }),
    );
    expect(notificationsService.notify).not.toHaveBeenCalled();
  });

  it('skips a student entirely when fewer than RISK_MIN_TRACKED_DAYS days are tracked', async () => {
    prisma.enrollment.findMany.mockResolvedValue([
      {
        studentId: 's1',
        campusId: 'campus-1',
        sectionId: 'sec-1',
        campus: { schoolId: 'school-1' },
      },
    ]);
    prisma.attendance.findMany.mockResolvedValue(
      daysOfStatus(RISK_MIN_TRACKED_DAYS - 1, 'ABSENT'),
    );

    await service.recomputeAll();

    expect(prisma.attendanceRiskFlag.upsert).not.toHaveBeenCalled();
    expect(notificationsService.notify).not.toHaveBeenCalled();
  });

  it('does not flag when the absence rate is below RISK_THRESHOLD', async () => {
    prisma.enrollment.findMany.mockResolvedValue([
      {
        studentId: 's1',
        campusId: 'campus-1',
        sectionId: 'sec-1',
        campus: { schoolId: 'school-1' },
      },
    ]);
    // 10 tracked, 1 absent = 10% < 25%
    prisma.attendance.findMany.mockResolvedValue([
      ...daysOfStatus(9, 'PRESENT'),
      ...daysOfStatus(1, 'ABSENT'),
    ]);
    prisma.attendanceRiskFlag.findUnique.mockResolvedValue(null);
    prisma.attendanceRiskFlag.upsert.mockResolvedValue({});

    await service.recomputeAll();

    expect(prisma.attendanceRiskFlag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ flagged: false }),
      }),
    );
    expect(notificationsService.notify).not.toHaveBeenCalled();
  });

  it('getForStudent throws NotFoundException when no risk row exists yet', async () => {
    prisma.attendanceRiskFlag.findUnique.mockResolvedValue(null);

    await expect(service.getForStudent('s1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('getForStudent returns the mapped summary for an existing row', async () => {
    prisma.attendanceRiskFlag.findUnique.mockResolvedValue({
      studentId: 's1',
      absenceRate: 0.3,
      flagged: true,
      windowStart: new Date('2026-08-01'),
      windowEnd: new Date('2026-08-31'),
      student: { name: 'Ali' },
    });

    const result = await service.getForStudent('s1');

    expect(result).toEqual({
      studentId: 's1',
      studentName: 'Ali',
      absenceRate: 0.3,
      flagged: true,
      windowStart: '2026-08-01',
      windowEnd: '2026-08-31',
    });
  });

  it('getFlagged with no sectionIds queries every flagged student, school-wide', async () => {
    prisma.attendanceRiskFlag.findMany.mockResolvedValue([]);

    await service.getFlagged();

    expect(prisma.attendanceRiskFlag.findMany).toHaveBeenCalledWith({
      where: { flagged: true },
      include: { student: { select: { name: true } } },
      orderBy: { absenceRate: 'desc' },
    });
  });

  it("getFlagged with sectionIds scopes the query to those sections (a Teacher's own classes)", async () => {
    prisma.attendanceRiskFlag.findMany.mockResolvedValue([]);

    await service.getFlagged(['sec-1', 'sec-2']);

    expect(prisma.attendanceRiskFlag.findMany).toHaveBeenCalledWith({
      where: {
        flagged: true,
        student: {
          enrollments: {
            some: { sectionId: { in: ['sec-1', 'sec-2'] }, status: 'ACTIVE' },
          },
        },
      },
      include: { student: { select: { name: true } } },
      orderBy: { absenceRate: 'desc' },
    });
  });

  it('getFlagged with an empty sectionIds array (Teacher with no class-teacher section) returns none', async () => {
    prisma.attendanceRiskFlag.findMany.mockResolvedValue([]);

    await service.getFlagged([]);

    expect(prisma.attendanceRiskFlag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          student: {
            enrollments: { some: { sectionId: { in: [] }, status: 'ACTIVE' } },
          },
        }),
      }),
    );
  });

  describe('per-school settings and alert recipients (BL-28)', () => {
    const enrolled = () =>
      prisma.enrollment.findMany.mockResolvedValue([
        {
          studentId: 's1',
          campusId: 'campus-1',
          sectionId: 'sec-1',
          campus: { schoolId: 'school-1' },
        },
      ]);

    beforeEach(() => {
      prisma.attendanceRiskFlag.findUnique.mockResolvedValue(null);
      prisma.attendanceRiskFlag.upsert.mockResolvedValue({});
      prisma.student.findUnique.mockResolvedValue({ name: 'Ali' });
      prisma.section.findUnique.mockResolvedValue({
        classTeacher: { userId: 'teacher-user-1' },
      });
    });

    it("uses the school's own threshold, window and minimum days", async () => {
      enrolled();
      prisma.attendanceRiskPolicy.findMany.mockResolvedValue([
        {
          schoolId: 'school-1',
          windowDays: 14,
          thresholdPercent: 10,
          minTrackedDays: 3,
          notifyParents: false,
        },
      ]);
      // 3 tracked, 1 absent = 33 % — below the default minimum days (5) but above this school's 3.
      prisma.attendance.findMany.mockResolvedValue([
        ...daysOfStatus(2, 'PRESENT'),
        ...daysOfStatus(1, 'ABSENT'),
      ]);
      await service.recomputeAll(new Date('2026-09-20T10:00:00Z'));
      const where = prisma.attendance.findMany.mock.calls[0][0].where;
      expect(where.date.gte.toISOString()).toBe('2026-09-06T00:00:00.000Z'); // 14 days
      expect(prisma.attendanceRiskFlag.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ flagged: true }),
        }),
      );
    });

    it('LATE counts as present in the absence rate', async () => {
      enrolled();
      prisma.attendance.findMany.mockResolvedValue([
        ...daysOfStatus(8, 'LATE'),
        ...daysOfStatus(2, 'ABSENT', 20),
      ]);
      await service.recomputeAll();
      expect(prisma.attendanceRiskFlag.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ absenceRate: 0.2, flagged: false }),
        }),
      );
    });

    it('alerts the class teacher and the school admins once; guardians only when enabled', async () => {
      enrolled();
      prisma.attendance.findMany.mockResolvedValue(daysOfStatus(5, 'ABSENT'));
      prisma.user.findMany.mockResolvedValue([
        { id: 'admin-1' },
        { id: 'teacher-user-1' },
      ]);
      prisma.studentParent.findMany.mockResolvedValue([
        { parentProfile: { userId: 'parent-1' } },
      ]);
      await service.recomputeAll();
      const recipients = () =>
        notificationsService.notify.mock.calls.map(
          (c: [{ userId: string }]) => c[0].userId,
        );
      expect(recipients().sort()).toEqual(['admin-1', 'teacher-user-1']);
      expect(prisma.user.findMany.mock.calls[0][0].where).toMatchObject({
        role: 'SCHOOL_ADMIN',
        schoolId: 'school-1',
        OR: [{ campusId: null }, { campusId: 'campus-1' }],
      });
      expect(prisma.studentParent.findMany).not.toHaveBeenCalled();

      notificationsService.notify.mockClear();
      prisma.attendanceRiskPolicy.findMany.mockResolvedValue([
        {
          schoolId: 'school-1',
          windowDays: 30,
          thresholdPercent: 25,
          minTrackedDays: 5,
          notifyParents: true,
        },
      ]);
      await service.recomputeAll();
      expect(recipients()).toContain('parent-1');
    });
  });
});
