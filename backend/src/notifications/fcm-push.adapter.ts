import { PrismaService } from '../prisma/prisma.service';
import { PushAdapter, PushPayload } from './push-adapter';
import { FcmSender } from './fcm-sender';

const UNREGISTERED_ERROR_CODE = 'messaging/registration-token-not-registered';

/**
 * Real push delivery, behind the same PushAdapter interface LoggingPushAdapter already
 * implements — swapping this in is a one-line change in NotificationsModule (see fcm-config.ts's
 * resolveFirebaseConfig for how the swap is decided), matching the StorageAdapter/PaymentGateway
 * pattern used elsewhere in this codebase. Constructed manually inside that module's provider
 * factory rather than through Nest's DI container — no `@Injectable()` needed, same as
 * JazzCashAdapter/EasyPaisaAdapter (backend/src/fees/gateways/), which are also factory-built.
 */
export class FcmPushAdapter implements PushAdapter {
  constructor(
    private readonly sender: FcmSender,
    private readonly prisma: PrismaService,
  ) {}

  async send(userId: string, payload: PushPayload): Promise<void> {
    const devices = await this.prisma.deviceToken.findMany({
      where: { userId },
    });
    if (devices.length === 0) return;

    const result = await this.sender.sendEachForMulticast(
      devices.map((d) => d.token),
      payload,
    );

    const deadTokens = devices
      .filter(
        (_, i) => result.responses[i]?.errorCode === UNREGISTERED_ERROR_CODE,
      )
      .map((d) => d.token);

    if (deadTokens.length > 0) {
      await this.prisma.deviceToken.deleteMany({
        where: { token: { in: deadTokens } },
      });
    }
  }
}
