import { PrismaService } from '../prisma/prisma.service';
import { PushAdapter, PushPayload } from './push-adapter';
import { WhatsAppSender } from './whatsapp-sender';

/**
 * Real WhatsApp delivery, behind the same PushAdapter interface LoggingPushAdapter/FcmPushAdapter
 * already implement. WhatsApp only resolves a destination for PARENT accounts in this sprint —
 * `ParentProfile.phone` (prisma/schema.prisma) is the only phone-number field anywhere on
 * User/TeacherProfile/AdminProfile, so a non-parent user or a parent with no phone on file is a
 * no-op, not an error (matching FcmPushAdapter's "no DeviceToken rows → no-op" precedent).
 */
export class WhatsAppAdapter implements PushAdapter {
  constructor(
    private readonly sender: WhatsAppSender,
    private readonly prisma: PrismaService,
  ) {}

  async send(userId: string, payload: PushPayload): Promise<void> {
    const parentProfile = await this.prisma.parentProfile.findUnique({
      where: { userId },
    });
    if (!parentProfile?.phone) return;

    await this.sender.sendMessage(
      parentProfile.phone,
      `${payload.title}\n${payload.body}`,
    );
  }
}
