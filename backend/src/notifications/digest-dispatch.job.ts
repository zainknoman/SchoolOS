import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { JobLockService } from '../prisma/job-lock.service';
import { PUSH_ADAPTER } from './push-adapter';
import type { PushAdapter } from './push-adapter';
import {
  WHATSAPP_ADAPTER,
  SMS_ADAPTER,
  resolveAdapterFor,
} from './channel-registry';

/** Named constant so the interval is a one-line change later, not a magic string. */
export const DIGEST_DISPATCH_CRON = '*/15 * * * *';

/**
 * Bundles every undispatched Notification row for each digest-enabled user into one send() call,
 * then stamps those rows dispatched. Notification has no ORM relation to User (it only stores
 * userId), so this looks up digest-enabled users first, then queries their undispatched rows —
 * a non-digest user's rows are already dispatched immediately by NotificationsService.notify(),
 * so this job never touches them.
 */
@Injectable()
export class DigestDispatchJob {
  private readonly logger = new Logger(DigestDispatchJob.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUSH_ADAPTER) private readonly push: PushAdapter,
    @Inject(WHATSAPP_ADAPTER) private readonly whatsapp: PushAdapter,
    @Inject(SMS_ADAPTER) private readonly sms: PushAdapter,
    private readonly jobLock: JobLockService,
  ) {}

  @Cron(DIGEST_DISPATCH_CRON)
  async run(): Promise<void> {
    try {
      // BL-39: only one instance dispatches per run — two would send each digest twice.
      await this.jobLock.runExclusive('digest-dispatch', () => this.dispatch());
    } catch (err) {
      this.logger.error('Digest dispatch failed', err as Error);
    }
  }

  async dispatch(): Promise<void> {
    const digestUsers = await this.prisma.user.findMany({
      where: { digestEnabled: true },
      select: { id: true, notificationChannel: true },
    });
    if (digestUsers.length === 0) return;

    const rows = await this.prisma.notification.findMany({
      where: {
        dispatchedAt: null,
        userId: { in: digestUsers.map((u) => u.id) },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (rows.length === 0) return;

    const rowsByUserId = new Map<string, typeof rows>();
    for (const row of rows) {
      const existing = rowsByUserId.get(row.userId);
      if (existing) {
        existing.push(row);
      } else {
        rowsByUserId.set(row.userId, [row]);
      }
    }

    for (const user of digestUsers) {
      const userRows = rowsByUserId.get(user.id);
      if (!userRows || userRows.length === 0) continue;

      const adapter = resolveAdapterFor(user.notificationChannel, {
        push: this.push,
        whatsapp: this.whatsapp,
        sms: this.sms,
      });

      const title = `You have ${userRows.length} new update${userRows.length === 1 ? '' : 's'}`;
      const body = userRows.map((r) => `• ${r.title}: ${r.body}`).join('\n');

      try {
        await adapter.send(user.id, { title, body });
        await this.prisma.notification.updateMany({
          where: { id: { in: userRows.map((r) => r.id) } },
          data: { dispatchedAt: new Date() },
        });
      } catch (err) {
        // Best-effort, same as NotificationsService.notify() — leave dispatchedAt null so the
        // next run retries this user's bundle rather than silently dropping it.
        this.logger.error(
          `Digest delivery failed for user ${user.id}`,
          err as Error,
        );
      }
    }
  }
}
