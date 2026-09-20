import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CircularsService } from './circulars.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('CircularsService', () => {
  let service: CircularsService;
  let prisma: {
    circular: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock };
    circularAttachment: { createMany: jest.Mock };
    circularRecipient: {
      createMany: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
      count: jest.Mock;
    };
    user: { findMany: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let notifications: { notify: jest.Mock };

  beforeEach(async () => {
    prisma = {
      circular: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      circularAttachment: { createMany: jest.fn() },
      circularRecipient: {
        createMany: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      user: { findMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    notifications = { notify: jest.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        CircularsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    service = moduleRef.get(CircularsService);
  });

  it('publishing a school-wide circular fans out a recipient row to every parent', async () => {
    prisma.circular.create.mockResolvedValue({ id: 'circ-1' });
    prisma.user.findMany.mockResolvedValue([
      { id: 'parent-a' },
      { id: 'parent-b' },
    ]);

    await service.publish(
      { title: 'PTM', description: 'PTM in September.', scope: 'school' },
      'admin-1',
    );

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: 'PARENT' } }),
    );
    expect(prisma.circularRecipient.createMany).toHaveBeenCalledWith({
      data: [
        { circularId: 'circ-1', userId: 'parent-a' },
        { circularId: 'circ-1', userId: 'parent-b' },
      ],
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'circular.publish',
          entity: 'Circular',
        }),
      }),
    );
  });

  it('notifies every recipient after publishing', async () => {
    prisma.circular.create.mockResolvedValue({ id: 'circ-1' });
    prisma.user.findMany.mockResolvedValue([
      { id: 'parent-a' },
      { id: 'parent-b' },
    ]);

    await service.publish(
      { title: 'PTM', description: 'PTM in September.', scope: 'school' },
      'admin-1',
    );

    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'parent-a',
        type: 'circular',
        entityRef: 'circ-1',
      }),
    );
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'parent-b',
        type: 'circular',
        entityRef: 'circ-1',
      }),
    );
  });

  it("publishing a section-scoped circular only reaches that section's currently-enrolled parents", async () => {
    prisma.circular.create.mockResolvedValue({ id: 'circ-2' });
    prisma.user.findMany.mockResolvedValue([{ id: 'parent-a' }]);

    await service.publish(
      {
        title: 'Trip',
        description: 'Field trip.',
        scope: 'section',
        sectionId: 'sec-1',
      },
      'admin-1',
    );

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: 'PARENT',
          parentProfile: {
            children: {
              some: {
                student: {
                  enrollments: {
                    some: { sectionId: 'sec-1', status: 'ACTIVE' },
                  },
                },
              },
            },
          },
        }),
      }),
    );
  });

  it("marking read updates the caller's recipient row and 404s if none exists", async () => {
    prisma.circularRecipient.updateMany.mockResolvedValue({ count: 1 });
    await service.markRead('circ-1', 'parent-a');
    expect(prisma.circularRecipient.updateMany).toHaveBeenCalledWith({
      where: { circularId: 'circ-1', userId: 'parent-a' },
      data: { readAt: expect.any(Date) },
    });

    prisma.circularRecipient.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.markRead('circ-1', 'not-a-recipient')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('stats reports delivered and read counts, and 404s for an unknown circular', async () => {
    prisma.circular.findUnique.mockResolvedValue({ id: 'circ-1' });
    prisma.circularRecipient.count
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2);

    const stats = await service.getStats('circ-1');
    expect(stats).toEqual({ delivered: 5, read: 2 });

    prisma.circular.findUnique.mockResolvedValue(null);
    await expect(service.getStats('missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
