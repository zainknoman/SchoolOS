import { SmsAdapter } from './sms.adapter';
import { SmsSender } from './sms-sender';

describe('SmsAdapter', () => {
  function fakePrisma(parentProfile: { phone: string | null } | null) {
    return {
      parentProfile: { findUnique: jest.fn().mockResolvedValue(parentProfile) },
    };
  }

  it('sends via the sender when the user has a ParentProfile with a phone', async () => {
    const prisma = fakePrisma({ phone: '+923001234567' });
    const sendMessage = jest.fn().mockResolvedValue(undefined);
    const sender: SmsSender = { sendMessage };
    const adapter = new SmsAdapter(sender, prisma as never);

    await adapter.send('user-1', {
      title: 'New circular',
      body: 'PTM in September',
    });

    expect(prisma.parentProfile.findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(sendMessage).toHaveBeenCalledWith(
      '+923001234567',
      'New circular: PTM in September',
    );
  });

  it('no-ops when the user has no ParentProfile', async () => {
    const prisma = fakePrisma(null);
    const sendMessage = jest.fn();
    const adapter = new SmsAdapter({ sendMessage }, prisma as never);

    await adapter.send('user-teacher', { title: 'T', body: 'B' });

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('no-ops when the ParentProfile has no phone on file', async () => {
    const prisma = fakePrisma({ phone: null });
    const sendMessage = jest.fn();
    const adapter = new SmsAdapter({ sendMessage }, prisma as never);

    await adapter.send('user-1', { title: 'T', body: 'B' });

    expect(sendMessage).not.toHaveBeenCalled();
  });
});
