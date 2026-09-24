import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { TimetableService } from './timetable.service';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentService } from '../enrollment/enrollment.service';

describe('TimetableService', () => {
  let service: TimetableService;
  let prisma: {
    subject: { findUnique: jest.Mock };
    timetable: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    section: { findUnique: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let enrollmentService: { getCurrentEnrollment: jest.Mock };

  beforeEach(async () => {
    prisma = {
      // BL-02: subjects are validated before use; a legacy school-less subject is accepted.
      subject: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ schoolId: null, isActive: true }),
      },
      timetable: {
        findMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      section: {
        findUnique: jest.fn().mockResolvedValue({
          class: { campusId: 'camp-1', academicSessionId: 'sess-1' },
        }),
      },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn().mockResolvedValue(undefined),
    };
    enrollmentService = { getCurrentEnrollment: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        TimetableService,
        { provide: PrismaService, useValue: prisma },
        { provide: EnrollmentService, useValue: enrollmentService },
      ],
    }).compile();
    service = moduleRef.get(TimetableService);
  });

  it("returns the student's current-enrollment section timetable ordered by day then period", async () => {
    enrollmentService.getCurrentEnrollment.mockResolvedValue({
      sectionId: 'sec-1',
    });
    prisma.timetable.findMany.mockResolvedValue([
      {
        id: 't1',
        dayOfWeek: 1,
        period: 1,
        startTime: '08:00',
        endTime: '08:40',
        room: '3A',
        subject: { name: 'English' },
        teacher: { name: 'Ms. Sample' },
      },
    ]);

    const result = await service.getForStudent('s1');

    expect(enrollmentService.getCurrentEnrollment).toHaveBeenCalledWith('s1');
    expect(prisma.timetable.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sectionId: 'sec-1' },
        orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }],
      }),
    );
    expect(result[0]).toEqual(
      expect.objectContaining({
        subject: 'English',
        teacher: 'Ms. Sample',
        room: '3A',
      }),
    );
  });

  it('creates a timetable entry and writes an audit log entry', async () => {
    prisma.timetable.create.mockResolvedValue({ id: 't2' });

    const dto = {
      sectionId: 'sec-1',
      subjectId: 'sub-1',
      dayOfWeek: 2,
      period: 1,
      startTime: '08:00',
      endTime: '08:40',
    };
    await service.createEntry(dto, 'admin-1');

    expect(prisma.timetable.create).toHaveBeenCalledWith({ data: dto });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'admin-1',
          action: 'timetable.create',
          entity: 'Timetable',
          entityId: 't2',
        }),
      }),
    );
  });

  it('getForSection returns a section timetable ordered by day then period', async () => {
    prisma.timetable.findMany.mockResolvedValue([
      {
        id: 't1',
        dayOfWeek: 1,
        period: 1,
        startTime: '08:00',
        endTime: '08:40',
        room: '4B',
        subject: { name: 'English' },
        teacher: { name: 'Mr. Second Teacher' },
      },
    ]);

    const result = await service.getForSection('sec-2');

    expect(prisma.timetable.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sectionId: 'sec-2' },
        orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }],
      }),
    );
    expect(result[0]).toEqual(
      expect.objectContaining({
        subject: 'English',
        teacher: 'Mr. Second Teacher',
        room: '4B',
      }),
    );
  });

  it('updates a timetable entry and writes an audit log entry', async () => {
    prisma.timetable.findUnique.mockResolvedValue({ id: 't1' });
    prisma.timetable.update.mockResolvedValue({ id: 't1', room: '4C' });

    const result = await service.updateEntry('t1', { room: '4C' }, 'admin-1');

    expect(prisma.timetable.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { room: '4C' },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'admin-1',
          action: 'timetable.update',
          entityId: 't1',
        }),
      }),
    );
    expect(result).toEqual({ id: 't1', room: '4C' });
  });

  it('updateEntry throws NotFoundException for an unknown entry', async () => {
    prisma.timetable.findUnique.mockResolvedValue(null);

    await expect(
      service.updateEntry('missing', { room: '4C' }, 'admin-1'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.timetable.update).not.toHaveBeenCalled();
  });

  it('deletes a timetable entry and writes an audit log entry', async () => {
    prisma.timetable.findUnique.mockResolvedValue({ id: 't1' });

    await service.deleteEntry('t1', 'admin-1');

    expect(prisma.timetable.delete).toHaveBeenCalledWith({
      where: { id: 't1' },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'admin-1',
          action: 'timetable.delete',
          entityId: 't1',
        }),
      }),
    );
  });

  it('deleteEntry throws NotFoundException for an unknown entry', async () => {
    prisma.timetable.findUnique.mockResolvedValue(null);

    await expect(service.deleteEntry('missing', 'admin-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.timetable.delete).not.toHaveBeenCalled();
  });

  it("replaceForSection deletes the section's existing rows and creates the new set in one transaction", async () => {
    const entries = [
      {
        subjectId: 'sub-1',
        dayOfWeek: 1,
        period: 1,
        startTime: '08:00',
        endTime: '08:40',
      },
      {
        subjectId: 'sub-2',
        dayOfWeek: 1,
        period: 2,
        startTime: '08:40',
        endTime: '09:20',
      },
    ];
    prisma.timetable.findMany.mockResolvedValue([]);

    await service.replaceForSection('sec-1', entries, 'admin-1');

    expect(prisma.timetable.deleteMany).toHaveBeenCalledWith({
      where: { sectionId: 'sec-1' },
    });
    expect(prisma.timetable.createMany).toHaveBeenCalledWith({
      data: entries.map((e) => ({ ...e, sectionId: 'sec-1' })),
    });
    // Both operations (the delete and the recreate) are passed into a single $transaction call —
    // atomic, so a mid-save failure never leaves the section half-cleared.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction.mock.calls[0]?.[0]).toHaveLength(2);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'admin-1',
          action: 'timetable.replace',
          entity: 'Timetable',
          entityId: 'sec-1',
        }),
      }),
    );
    // Returns the section's timetable read back after the replace.
    expect(prisma.timetable.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sectionId: 'sec-1' } }),
    );
  });

  it('replaceForSection with an empty list only deletes — no createMany call, section timetable cleared', async () => {
    prisma.timetable.findMany.mockResolvedValue([]);

    await service.replaceForSection('sec-1', [], 'admin-1');

    expect(prisma.timetable.deleteMany).toHaveBeenCalledWith({
      where: { sectionId: 'sec-1' },
    });
    expect(prisma.timetable.createMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'timetable.replace' }),
      }),
    );
  });

  describe('scheduling-conflict detection', () => {
    const dto = {
      sectionId: 'sec-1',
      subjectId: 'sub-1',
      teacherId: 'teacher-1',
      dayOfWeek: 2,
      period: 1,
      startTime: '08:00',
      endTime: '08:40',
      room: 'Room-3A',
    };

    it('createEntry rejects a double-booked teacher in the same day+period', async () => {
      prisma.timetable.findFirst.mockResolvedValue({
        id: 'existing',
        teacherId: 'teacher-1',
        room: null,
      });

      await expect(service.createEntry(dto, 'admin-1')).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.timetable.create).not.toHaveBeenCalled();
    });

    it('createEntry rejects a double-booked room in the same day+period', async () => {
      prisma.timetable.findFirst.mockResolvedValue({
        id: 'existing',
        teacherId: null,
        room: 'Room-3A',
      });

      await expect(service.createEntry(dto, 'admin-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('createEntry allows two entries with neither teacherId nor room set — never flagged as conflicting', async () => {
      prisma.timetable.findFirst.mockResolvedValue(null);
      prisma.timetable.create.mockResolvedValue({ id: 't1' });

      const bareDto = { ...dto, teacherId: undefined, room: undefined };
      delete (bareDto as { teacherId?: string }).teacherId;
      delete (bareDto as { room?: string }).room;

      await service.createEntry(bareDto, 'admin-1');

      expect(prisma.timetable.findFirst).not.toHaveBeenCalled();
      expect(prisma.timetable.create).toHaveBeenCalled();
    });

    it('createEntry succeeds when no conflicting row exists', async () => {
      prisma.timetable.findFirst.mockResolvedValue(null);
      prisma.timetable.create.mockResolvedValue({ id: 't1' });

      await service.createEntry(dto, 'admin-1');

      expect(prisma.timetable.create).toHaveBeenCalledWith({ data: dto });
    });

    it('updateEntry rejects a conflict against a DIFFERENT entry', async () => {
      prisma.timetable.findUnique.mockResolvedValue({
        id: 't1',
        dayOfWeek: 2,
        period: 1,
        teacherId: 'teacher-1',
        room: null,
      });
      prisma.timetable.findFirst.mockResolvedValue({
        id: 'other-entry',
        teacherId: 'teacher-1',
        room: null,
      });

      await expect(
        service.updateEntry('t1', { period: 2 }, 'admin-1'),
      ).rejects.toThrow(ConflictException);
    });

    it("updateEntry excludes itself from the conflict check (editing an entry's own unrelated field is not a self-conflict)", async () => {
      prisma.timetable.findUnique.mockResolvedValue({
        id: 't1',
        dayOfWeek: 2,
        period: 1,
        teacherId: 'teacher-1',
        room: null,
      });
      prisma.timetable.findFirst.mockResolvedValue(null);
      prisma.timetable.update.mockResolvedValue({ id: 't1' });

      await service.updateEntry('t1', { startTime: '08:05' }, 'admin-1');

      expect(prisma.timetable.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { not: 't1' } }),
        }),
      );
      expect(prisma.timetable.update).toHaveBeenCalled();
    });

    it('scopes a room clash to the same campus and academic session (room names repeat across campuses/years)', async () => {
      prisma.timetable.findMany.mockResolvedValue([]);
      await service.replaceForSection(
        'sec-1',
        [
          {
            subjectId: 'sub-1',
            dayOfWeek: 1,
            period: 1,
            startTime: '08:00',
            endTime: '08:40',
            room: '2A',
          },
        ],
        'admin-1',
      );

      expect(prisma.timetable.findFirst).toHaveBeenCalledWith({
        where: {
          dayOfWeek: 1,
          period: 1,
          sectionId: { not: 'sec-1' },
          OR: [
            {
              room: '2A',
              section: {
                class: { campusId: 'camp-1', academicSessionId: 'sess-1' },
              },
            },
          ],
        },
      });
    });

    it('scopes a teacher clash to the same academic session only', async () => {
      prisma.timetable.findMany.mockResolvedValue([]);
      await service.replaceForSection(
        'sec-1',
        [
          {
            subjectId: 'sub-1',
            teacherId: 'teacher-1',
            dayOfWeek: 1,
            period: 1,
            startTime: '08:00',
            endTime: '08:40',
          },
        ],
        'admin-1',
      );

      expect(prisma.timetable.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          OR: [
            {
              teacherId: 'teacher-1',
              section: { class: { academicSessionId: 'sess-1' } },
            },
          ],
        }),
      });
    });

    it('still rejects a real room clash within the campus and session, naming the campus', async () => {
      prisma.timetable.findFirst.mockResolvedValue({
        id: 'other',
        teacherId: null,
        room: '2A',
      });

      await expect(
        service.replaceForSection(
          'sec-1',
          [
            {
              subjectId: 'sub-1',
              dayOfWeek: 1,
              period: 1,
              startTime: '08:00',
              endTime: '08:40',
              room: '2A',
            },
          ],
          'admin-1',
        ),
      ).rejects.toThrow('another section of this campus');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
