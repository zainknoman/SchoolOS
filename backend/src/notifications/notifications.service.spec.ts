import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PUSH_ADAPTER } from './push-adapter';
import { WHATSAPP_ADAPTER, SMS_ADAPTER } from './channel-registry';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: {
    user: { findUnique: jest.Mock };
    notification: {
      create: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let push: { send: jest.Mock };
  let whatsapp: { send: jest.Mock };
  let sms: { send: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    push = { send: jest.fn().mockResolvedValue(undefined) };
    whatsapp = { send: jest.fn().mockResolvedValue(undefined) };
    sms = { send: jest.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PUSH_ADAPTER, useValue: push },
        { provide: WHATSAPP_ADAPTER, useValue: whatsapp },
        { provide: SMS_ADAPTER, useValue: sms },
      ],
    }).compile();
    service = moduleRef.get(NotificationsService);
  });

  it('writes a Notification row (dispatched immediately) and calls the push adapter by default', async () => {
    prisma.user.findUnique.mockResolvedValue({
      notificationChannel: 'PUSH',
      digestEnabled: false,
    });
    prisma.notification.create.mockResolvedValue({ id: 'n1' });

    await service.notify({
      userId: 'user-1',
      type: 'message',
      title: 'New message',
      body: 'Hi there',
      entityRef: 'conv-1',
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: 'message',
        title: 'New message',
        body: 'Hi there',
        entityRef: 'conv-1',
        dispatchedAt: expect.any(Date),
      },
    });
    expect(push.send).toHaveBeenCalledWith('user-1', {
      title: 'New message',
      body: 'Hi there',
      data: { type: 'message', entityRef: 'conv-1' },
    });
    expect(whatsapp.send).not.toHaveBeenCalled();
    expect(sms.send).not.toHaveBeenCalled();
  });

  it('calls the WhatsApp adapter (not push) for a user with notificationChannel WHATSAPP', async () => {
    prisma.user.findUnique.mockResolvedValue({
      notificationChannel: 'WHATSAPP',
      digestEnabled: false,
    });
    prisma.notification.create.mockResolvedValue({ id: 'n1' });

    await service.notify({
      userId: 'user-1',
      type: 'circular',
      title: 'T',
      body: 'B',
    });

    expect(whatsapp.send).toHaveBeenCalledWith('user-1', {
      title: 'T',
      body: 'B',
      data: { type: 'circular', entityRef: '' },
    });
    expect(push.send).not.toHaveBeenCalled();
  });

  it('skips sending entirely and leaves dispatchedAt null for a digest-enabled user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      notificationChannel: 'PUSH',
      digestEnabled: true,
    });
    prisma.notification.create.mockResolvedValue({ id: 'n1' });

    await service.notify({
      userId: 'user-1',
      type: 'diary',
      title: 'T',
      body: 'B',
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: 'diary',
        title: 'T',
        body: 'B',
        entityRef: null,
        dispatchedAt: null,
      },
    });
    expect(push.send).not.toHaveBeenCalled();
    expect(whatsapp.send).not.toHaveBeenCalled();
    expect(sms.send).not.toHaveBeenCalled();
  });

  it('still writes the Notification row and does not throw if the resolved adapter rejects', async () => {
    prisma.user.findUnique.mockResolvedValue({
      notificationChannel: 'PUSH',
      digestEnabled: false,
    });
    prisma.notification.create.mockResolvedValue({ id: 'n1' });
    push.send.mockRejectedValue(new Error('no provider configured'));

    await expect(
      service.notify({
        userId: 'user-1',
        type: 'diary',
        title: 'x',
        body: 'y',
      }),
    ).resolves.toBeUndefined();
    expect(prisma.notification.create).toHaveBeenCalled();
  });

  it("lists a user's own notifications, newest first", async () => {
    prisma.notification.findMany.mockResolvedValue([
      {
        id: 'n1',
        type: 'message',
        title: 'Hi',
        body: 'Hello',
        entityRef: 'conv-1',
        readAt: null,
        createdAt: new Date('2026-08-29T00:00:00.000Z'),
      },
    ]);

    const result = await service.listForUser('user-1');

    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toEqual([
      {
        id: 'n1',
        type: 'message',
        title: 'Hi',
        body: 'Hello',
        entityRef: 'conv-1',
        readAt: null,
        createdAt: '2026-08-29T00:00:00.000Z',
      },
    ]);
  });

  it("marking read is scoped to the caller and 404s if it's not theirs", async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 1 });
    await service.markRead('n1', 'user-1');
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'n1', userId: 'user-1' },
      data: { readAt: expect.any(Date) },
    });

    prisma.notification.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.markRead('n1', 'someone-else')).rejects.toThrow(
      NotFoundException,
    );
  });

  it("markAllRead only touches the caller's unread rows", async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 3 });
    await service.markAllRead('user-1');
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});
