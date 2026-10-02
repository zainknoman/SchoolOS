import { WhatsAppAdapter } from './whatsapp.adapter';
import { WhatsAppSender } from './whatsapp-sender';

describe('WhatsAppAdapter', () => {
  function fakePrisma(parentProfile: { phone: string | null } | null) {
    return {
      parentProfile: { findUnique: jest.fn().mockResolvedValue(parentProfile) },
    };
  }

  it('sends via the sender when the user has a ParentProfile with a phone', async () => {
    const prisma = fakePrisma({ phone: '+923001234567' });
    const sendTemplate = jest.fn().mockResolvedValue(undefined);
    const sender: WhatsAppSender = { sendTemplate };
    const adapter = new WhatsAppAdapter(sender, prisma as never);

    await adapter.send('user-1', {
      title: 'New circular',
      body: 'PTM in September',
    });

    expect(prisma.parentProfile.findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(sendTemplate).toHaveBeenCalledWith('+923001234567', [
      'New circular',
      'PTM in September',
    ]);
  });

  it('no-ops when the user has no ParentProfile', async () => {
    const prisma = fakePrisma(null);
    const sendTemplate = jest.fn();
    const adapter = new WhatsAppAdapter({ sendTemplate }, prisma as never);

    await adapter.send('user-teacher', { title: 'T', body: 'B' });

    expect(sendTemplate).not.toHaveBeenCalled();
  });

  it('no-ops when the ParentProfile has no phone on file', async () => {
    const prisma = fakePrisma({ phone: null });
    const sendTemplate = jest.fn();
    const adapter = new WhatsAppAdapter({ sendTemplate }, prisma as never);

    await adapter.send('user-1', { title: 'T', body: 'B' });

    expect(sendTemplate).not.toHaveBeenCalled();
  });
});
