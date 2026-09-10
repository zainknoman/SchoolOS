import { Test } from '@nestjs/testing';
import { DigestDispatchJob } from './digest-dispatch.job';
import { PrismaService } from '../prisma/prisma.service';
import { PUSH_ADAPTER } from './push-adapter';
import { WHATSAPP_ADAPTER, SMS_ADAPTER } from './channel-registry';

describe('DigestDispatchJob', () => {
  let job: DigestDispatchJob;
  let prisma: {
    user: { findMany: jest.Mock };
    notification: { findMany: jest.Mock; updateMany: jest.Mock };
  };
  let push: { send: jest.Mock };
  let whatsapp: { send: jest.Mock };
  let sms: { send: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findMany: jest.fn() },
      notification: { findMany: jest.fn(), updateMany: jest.fn() },
    };
    push = { send: jest.fn().mockResolvedValue(undefined) };
    whatsapp = { send: jest.fn().mockResolvedValue(undefined) };
    sms = { send: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DigestDispatchJob,
        { provide: PrismaService, useValue: prisma },
        { provide: PUSH_ADAPTER, useValue: push },
        { provide: WHATSAPP_ADAPTER, useValue: whatsapp },
        { provide: SMS_ADAPTER, useValue: sms },
      ],
    }).compile();
    job = moduleRef.get(DigestDispatchJob);
  });

  it('bundles a digest-enabled user\'s undispatched rows into one send() call and stamps them dispatched', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'user-1', notificationChannel: 'WHATSAPP' },
    ]);
    prisma.notification.findMany.mockResolvedValue([
      { id: 'n1', userId: 'user-1', type: 'diary', title: 'Diary update', body: 'Homework added', createdAt: new Date('2026-09-11T08:00:00.000Z') },
      { id: 'n2', userId: 'user-1', type: 'circular', title: 'PTM', body: 'Sept 20th', createdAt: new Date('2026-09-11T09:00:00.000Z') },
    ]);
    prisma.notification.updateMany.mockResolvedValue({ count: 2 });

    await job.run();

    expect(whatsapp.send).toHaveBeenCalledTimes(1);
    const [userId, payload] = whatsapp.send.mock.calls[0];
    expect(userId).toBe('user-1');
    expect(payload.title).toContain('2 new updates');
    expect(payload.body).toContain('Diary update');
    expect(payload.body).toContain('PTM');
    expect(push.send).not.toHaveBeenCalled();
    expect(sms.send).not.toHaveBeenCalled();

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['n1', 'n2'] } },
      data: { dispatchedAt: expect.any(Date) },
    });
  });

  it('never touches a non-digest user\'s rows (they are already dispatched immediately by notify())', async () => {
    prisma.user.findMany.mockResolvedValue([]);

    await job.run();

    expect(prisma.notification.findMany).not.toHaveBeenCalled();
    expect(push.send).not.toHaveBeenCalled();
    expect(whatsapp.send).not.toHaveBeenCalled();
    expect(sms.send).not.toHaveBeenCalled();
    expect(prisma.notification.updateMany).not.toHaveBeenCalled();
  });

  it('queries only undispatched rows scoped to digest-enabled user ids', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'user-1', notificationChannel: 'PUSH' }]);
    prisma.notification.findMany.mockResolvedValue([]);

    await job.run();

    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { dispatchedAt: null, userId: { in: ['user-1'] } },
      orderBy: { createdAt: 'asc' },
    });
    expect(push.send).not.toHaveBeenCalled();
  });
});
