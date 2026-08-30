import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let prisma: {
    teacher: { findUnique: jest.Mock };
    attendance: { upsert: jest.Mock; findMany: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      teacher: { findUnique: jest.fn() },
      attendance: { upsert: jest.fn(), findMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(AttendanceService);
  });

  it('marks attendance (upsert on studentId+date) and writes an audit log entry', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 'teacher-1' });
    prisma.attendance.upsert.mockResolvedValue({ id: 'att-1' });

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

  it('throws NotFoundException if the marking user has no Teacher profile', async () => {
    prisma.teacher.findUnique.mockResolvedValue(null);

    await expect(
      service.markAttendance(
        { studentId: 's1', date: '2026-08-27', status: 'PRESENT' },
        'not-a-teacher',
      ),
    ).rejects.toThrow(NotFoundException);
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
});
