import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DiaryService } from './diary.service';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('DiaryService', () => {
  let service: DiaryService;
  let prisma: {
    diaryEntry: { upsert: jest.Mock; findMany: jest.Mock };
    diaryAttachment: { deleteMany: jest.Mock; createMany: jest.Mock };
    user: { findMany: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let enrollmentService: { getEnrollmentForDate: jest.Mock };
  let notifications: { notify: jest.Mock };

  beforeEach(async () => {
    prisma = {
      diaryEntry: { upsert: jest.fn(), findMany: jest.fn() },
      diaryAttachment: { deleteMany: jest.fn(), createMany: jest.fn() },
      user: { findMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    enrollmentService = { getEnrollmentForDate: jest.fn() };
    notifications = { notify: jest.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        DiaryService,
        { provide: PrismaService, useValue: prisma },
        { provide: EnrollmentService, useValue: enrollmentService },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    service = moduleRef.get(DiaryService);
  });

  it('creates a diary entry (upsert on sectionId+subjectId+date), using the caller as authorId, and writes an audit log entry', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.diaryEntry.upsert.mockResolvedValue({ id: 'entry-1' });

    await service.createEntry(
      {
        sectionId: 'sec-1',
        subjectId: 'sub-1',
        date: '2026-08-27',
        text: 'Read chapter 3.',
      },
      'user-1',
    );

    expect(prisma.diaryEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sectionId_subjectId_date: {
            sectionId: 'sec-1',
            subjectId: 'sub-1',
            date: new Date('2026-08-27'),
          },
        },
        create: expect.objectContaining({
          text: 'Read chapter 3.',
          authorId: 'user-1',
        }),
        update: expect.objectContaining({
          text: 'Read chapter 3.',
          authorId: 'user-1',
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'diary.create',
          entity: 'DiaryEntry',
        }),
      }),
    );
  });

  it('creates a diary entry authored by a SCHOOL_ADMIN/SUPER_ADMIN caller directly — no Teacher profile lookup', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.diaryEntry.upsert.mockResolvedValue({ id: 'entry-2' });

    await service.createEntry(
      {
        sectionId: 'sec-1',
        subjectId: 'sub-1',
        date: '2026-08-27',
        text: 'Admin-posted note.',
      },
      'admin-user-1',
    );

    expect(prisma.diaryEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ authorId: 'admin-user-1' }),
      }),
    );
  });

  it('attaches the given files, replacing any previous attachments on the same entry', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.diaryEntry.upsert.mockResolvedValue({ id: 'entry-1' });

    await service.createEntry(
      {
        sectionId: 'sec-1',
        subjectId: 'sub-1',
        date: '2026-08-27',
        text: 'Read chapter 3.',
        fileIds: ['file-1', 'file-2'],
      },
      'user-1',
    );

    expect(prisma.diaryAttachment.deleteMany).toHaveBeenCalledWith({
      where: { diaryEntryId: 'entry-1' },
    });
    expect(prisma.diaryAttachment.createMany).toHaveBeenCalledWith({
      data: [
        { diaryEntryId: 'entry-1', fileId: 'file-1' },
        { diaryEntryId: 'entry-1', fileId: 'file-2' },
      ],
    });
  });

  it('notifies every parent whose child is enrolled in the section', async () => {
    prisma.diaryEntry.upsert.mockResolvedValue({ id: 'entry-1' });
    prisma.user.findMany.mockResolvedValue([
      { id: 'parent-1' },
      { id: 'parent-2' },
    ]);

    await service.createEntry(
      {
        sectionId: 'sec-1',
        subjectId: 'sub-1',
        date: '2026-08-27',
        text: 'Read chapter 3.',
      },
      'teacher-user-1',
    );

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: 'PARENT',
          parentProfile: expect.objectContaining({
            children: expect.objectContaining({
              some: expect.objectContaining({
                student: expect.objectContaining({
                  enrollments: {
                    some: { sectionId: 'sec-1', status: 'ACTIVE' },
                  },
                }),
              }),
            }),
          }),
        }),
      }),
    );
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'parent-1',
        type: 'diary',
        entityRef: 'entry-1',
      }),
    );
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'parent-2',
        type: 'diary',
        entityRef: 'entry-1',
      }),
    );
  });

  it("resolves the student's enrolled section as of the requested month before listing that section's entries", async () => {
    enrollmentService.getEnrollmentForDate.mockResolvedValue({
      sectionId: 'sec-1',
    });
    prisma.diaryEntry.findMany.mockResolvedValue([]);

    await service.getForStudent('s1', '2026-08');

    expect(enrollmentService.getEnrollmentForDate).toHaveBeenCalledWith(
      's1',
      new Date('2026-08-01T00:00:00.000Z'),
      new Date('2026-09-01T00:00:00.000Z'),
    );
    expect(prisma.diaryEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sectionId: 'sec-1' }),
      }),
    );
  });

  it('propagates NotFoundException when the student has no enrollment covering that month', async () => {
    enrollmentService.getEnrollmentForDate.mockRejectedValue(
      new NotFoundException(),
    );
    await expect(service.getForStudent('s1', '2026-08')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('maps entries to the summary shape the clients expect', async () => {
    prisma.diaryEntry.findMany.mockResolvedValue([
      {
        id: 'entry-1',
        date: new Date('2026-08-27'),
        dueDate: new Date('2026-08-29'),
        text: 'Read chapter 3.',
        subject: { name: 'Urdu' },
        attachments: [
          {
            file: {
              id: 'file-1',
              originalName: 'sheet.pdf',
              mimeType: 'application/pdf',
            },
          },
        ],
      },
    ]);

    const result = await service.getForSection('sec-1', '2026-08');

    expect(result).toEqual([
      {
        id: 'entry-1',
        date: '2026-08-27',
        dueDate: '2026-08-29',
        subject: 'Urdu',
        text: 'Read chapter 3.',
        attachments: [
          {
            id: 'file-1',
            originalName: 'sheet.pdf',
            mimeType: 'application/pdf',
          },
        ],
      },
    ]);
  });
});
