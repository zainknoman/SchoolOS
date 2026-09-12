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
    attendance: { upsert: jest.Mock; findMany: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let enrollmentService: { getCurrentEnrollment: jest.Mock };
  let holidaysService: { isHoliday: jest.Mock };

  beforeEach(async () => {
    prisma = {
      teacher: { findUnique: jest.fn() },
      section: { findUnique: jest.fn() },
      attendance: { upsert: jest.fn(), findMany: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn().mockImplementation((cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma)),
    };
    enrollmentService = { getCurrentEnrollment: jest.fn() };
    holidaysService = { isHoliday: jest.fn().mockResolvedValue(false) };
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
    enrollmentService.getCurrentEnrollment.mockResolvedValue({ campusId: 'campus-1' });

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

  it('an Admin/Super-Admin with no Teacher profile marks attendance attributed to the section class teacher', async () => {
    prisma.teacher.findUnique.mockResolvedValue(null);
    enrollmentService.getCurrentEnrollment.mockResolvedValue({ sectionId: 'sec-1' });
    prisma.section.findUnique.mockResolvedValue({ id: 'sec-1', classTeacherId: 'teacher-9' });
    prisma.attendance.upsert.mockResolvedValue({ id: 'att-1' });

    await service.markAttendance(
      { studentId: 's1', date: '2026-08-27', status: 'ABSENT' },
      'admin-user-1',
    );

    expect(prisma.attendance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ markedById: 'teacher-9' }),
        update: expect.objectContaining({ markedById: 'teacher-9' }),
      }),
    );
    // The audit log still names the acting admin, not the class teacher stand-in.
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'admin-user-1' }) }),
    );
  });

  it('throws BadRequestException if the acting user has no Teacher profile and the section has no class teacher either', async () => {
    prisma.teacher.findUnique.mockResolvedValue(null);
    enrollmentService.getCurrentEnrollment.mockResolvedValue({ sectionId: 'sec-1' });
    prisma.section.findUnique.mockResolvedValue({ id: 'sec-1', classTeacherId: null });

    await expect(
      service.markAttendance(
        { studentId: 's1', date: '2026-08-27', status: 'PRESENT' },
        'admin-user-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.attendance.upsert).not.toHaveBeenCalled();
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

  it('getForSection returns a studentId->status map of what was already marked that day', async () => {
    prisma.attendance.findMany.mockResolvedValue([
      { studentId: 's1', status: 'PRESENT' },
      { studentId: 's2', status: 'ABSENT' },
    ]);

    const result = await service.getForSection('sec-1', '2026-08-27');

    expect(prisma.attendance.findMany).toHaveBeenCalledWith({
      where: {
        date: new Date('2026-08-27T00:00:00.000Z'),
        student: { enrollments: { some: { sectionId: 'sec-1', status: 'ACTIVE' } } },
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
      enrollmentService.getCurrentEnrollment.mockResolvedValue({ campusId: 'campus-1' });
      holidaysService.isHoliday.mockResolvedValue(true);

      await expect(
        service.markBulk(
          { date: '2026-09-01', marks: [{ studentId: 's1', status: 'PRESENT' }] },
          'teacher-user-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.attendance.upsert).not.toHaveBeenCalled();
    });

    it('upserts every mark in one transaction, attributed to the marking teacher, and writes one bulk audit log entry', async () => {
      enrollmentService.getCurrentEnrollment.mockResolvedValue({ campusId: 'campus-1', sectionId: 'sec-1' });
      holidaysService.isHoliday.mockResolvedValue(false);
      prisma.teacher.findUnique.mockResolvedValue({ id: 'teacher-1' });
      prisma.attendance.upsert.mockResolvedValue({ id: 'att-1' });

      await service.markBulk(
        {
          date: '2026-09-01',
          marks: [
            { studentId: 's1', status: 'PRESENT' },
            { studentId: 's2', status: 'ABSENT' },
          ],
        },
        'teacher-user-1',
      );

      expect(prisma.attendance.upsert).toHaveBeenCalledTimes(2);
      expect(prisma.attendance.upsert).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { studentId_date: { studentId: 's1', date: new Date('2026-09-01') } },
          create: expect.objectContaining({ studentId: 's1', status: 'PRESENT', markedById: 'teacher-1' }),
        }),
      );
      expect(prisma.attendance.upsert).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          create: expect.objectContaining({ studentId: 's2', status: 'ABSENT', markedById: 'teacher-1' }),
        }),
      );
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

    it('falls back to the section class-teacher when the marking user has no Teacher profile (Admin marking)', async () => {
      enrollmentService.getCurrentEnrollment.mockResolvedValue({ campusId: 'campus-1', sectionId: 'sec-1' });
      holidaysService.isHoliday.mockResolvedValue(false);
      prisma.teacher.findUnique.mockResolvedValue(null);
      prisma.section.findUnique.mockResolvedValue({ id: 'sec-1', classTeacherId: 'teacher-9' });
      prisma.attendance.upsert.mockResolvedValue({ id: 'att-1' });

      await service.markBulk(
        { date: '2026-09-01', marks: [{ studentId: 's1', status: 'PRESENT' }] },
        'admin-user-1',
      );

      expect(prisma.attendance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ markedById: 'teacher-9' }) }),
      );
    });
  });
});
