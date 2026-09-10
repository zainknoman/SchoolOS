import { FcmPushAdapter } from './fcm-push.adapter';
import { FcmSender, FcmSendResult } from './fcm-sender';

describe('FcmPushAdapter', () => {
  function fakePrisma(tokens: { token: string }[]) {
    return {
      deviceToken: {
        findMany: jest.fn().mockResolvedValue(tokens),
        deleteMany: jest.fn().mockResolvedValue({ count: tokens.length }),
      },
    };
  }

  it('does nothing when the user has no registered devices', async () => {
    const prisma = fakePrisma([]);
    const sendEachForMulticast = jest.fn();
    const sender: FcmSender = { sendEachForMulticast };
    const adapter = new FcmPushAdapter(sender, prisma as never);

    await adapter.send('user-1', { title: 'T', body: 'B' });

    expect(prisma.deviceToken.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });

  it('sends to every registered token for the user', async () => {
    const prisma = fakePrisma([{ token: 'tok-a' }, { token: 'tok-b' }]);
    const result: FcmSendResult = {
      responses: [{ success: true }, { success: true }],
    };
    const sendEachForMulticast = jest.fn().mockResolvedValue(result);
    const sender: FcmSender = { sendEachForMulticast };
    const adapter = new FcmPushAdapter(sender, prisma as never);

    await adapter.send('user-1', {
      title: 'New circular',
      body: 'PTM in September',
      data: { type: 'circular' },
    });

    expect(sendEachForMulticast).toHaveBeenCalledWith(['tok-a', 'tok-b'], {
      title: 'New circular',
      body: 'PTM in September',
      data: { type: 'circular' },
    });
    expect(prisma.deviceToken.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes a token FCM reports as unregistered, keeps a token that merely failed transiently', async () => {
    const prisma = fakePrisma([{ token: 'tok-dead' }, { token: 'tok-flaky' }]);
    const result: FcmSendResult = {
      responses: [
        {
          success: false,
          errorCode: 'messaging/registration-token-not-registered',
        },
        { success: false, errorCode: 'messaging/internal-error' },
      ],
    };
    const sender: FcmSender = {
      sendEachForMulticast: jest.fn().mockResolvedValue(result),
    };
    const adapter = new FcmPushAdapter(sender, prisma as never);

    await adapter.send('user-1', { title: 'T', body: 'B' });

    expect(prisma.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ['tok-dead'] } },
    });
  });
});
