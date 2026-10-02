import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { NotificationChannel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PUSH_ADAPTER } from './push-adapter';
import type { PushAdapter } from './push-adapter';
import {
  WHATSAPP_ADAPTER,
  SMS_ADAPTER,
  resolveAdapterFor,
} from './channel-registry';
import { withTimeout } from '../common/with-timeout';
import {
  DELIVERY_TIMEOUT_MS,
  RETRY_BATCH_SIZE,
  afterFailure,
  deliveryErrorText,
} from './delivery-policy';

/** The fields of a Notification row needed to (re)send it. */
interface DeliverableRow {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  entityRef: string | null;
  deliveryAttempts: number;
}

export type NotificationType =
  'diary' | 'circular' | 'message' | 'attendance-risk' | 'complaint';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityRef?: string;
}

export interface NotificationSummary {
  id: string;
  type: string;
  title: string;
  body: string;
  entityRef: string | null;
  readAt: string | null;
  createdAt: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUSH_ADAPTER) private readonly push: PushAdapter,
    @Inject(WHATSAPP_ADAPTER) private readonly whatsapp: PushAdapter,
    @Inject(SMS_ADAPTER) private readonly sms: PushAdapter,
  ) {}

  async notify(input: NotifyInput): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { notificationChannel: true, digestEnabled: true },
    });

    const dispatchNow = !user?.digestEnabled;

    const row = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        entityRef: input.entityRef ?? null,
        dispatchedAt: dispatchNow ? new Date() : null,
        deliveryStatus: 'PENDING',
      },
    });

    // Digest-enabled users get their in-app Notification row immediately (unchanged), but the
    // actual send is deferred and bundled by DigestDispatchJob — don't couple digest mode to
    // in-app visibility.
    if (!dispatchNow) return;

    await this.attempt(
      {
        id: row.id,
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        entityRef: input.entityRef ?? null,
        deliveryAttempts: 0,
      },
      user?.notificationChannel ?? 'PUSH',
    );
  }

  /**
   * KI-5: one delivery attempt, bounded by DELIVERY_TIMEOUT_MS, with the outcome recorded on the
   * row (SENT, or RETRY with a backoff, or FAILED after MAX_DELIVERY_ATTEMPTS). Never throws: a
   * failed delivery must not fail the write that triggered it.
   */
  private async attempt(
    row: DeliverableRow,
    channel: NotificationChannel,
  ): Promise<void> {
    const adapter = resolveAdapterFor(channel, {
      push: this.push,
      whatsapp: this.whatsapp,
      sms: this.sms,
    });
    const attempts = row.deliveryAttempts + 1;
    try {
      await withTimeout(
        adapter.send(row.userId, {
          title: row.title,
          body: row.body,
          data: { type: row.type, entityRef: row.entityRef ?? '' },
        }),
        DELIVERY_TIMEOUT_MS,
        `${channel} delivery`,
      );
      await this.prisma.notification.update({
        where: { id: row.id },
        data: {
          deliveryStatus: 'SENT',
          deliveryAttempts: attempts,
          lastDeliveryError: null,
          nextAttemptAt: null,
        },
      });
    } catch (err) {
      const next = afterFailure(attempts, Date.now());
      const lastDeliveryError = deliveryErrorText(err);
      await this.prisma.notification
        .update({
          where: { id: row.id },
          data: { ...next, deliveryAttempts: attempts, lastDeliveryError },
        })
        .catch(() => undefined);
      const line = `notification.delivery-${next.deliveryStatus === 'FAILED' ? 'failed' : 'retry'} id=${row.id} channel=${channel} attempts=${attempts}: ${lastDeliveryError}`;
      if (next.deliveryStatus === 'FAILED') this.logger.error(line);
      else this.logger.warn(line);
    }
  }

  /**
   * KI-5: re-sends notifications whose last attempt failed and whose backoff has elapsed. Run by
   * NotificationRetryJob on one instance at a time; returns how many it attempted.
   */
  async retryDue(now = new Date()): Promise<number> {
    const rows = await this.prisma.notification.findMany({
      where: { deliveryStatus: 'RETRY', nextAttemptAt: { lte: now } },
      orderBy: { nextAttemptAt: 'asc' },
      take: RETRY_BATCH_SIZE,
    });
    if (rows.length === 0) return 0;
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.userId))] } },
      select: { id: true, notificationChannel: true },
    });
    const channelOf = new Map(users.map((u) => [u.id, u.notificationChannel]));
    for (const row of rows) {
      await this.attempt(row, channelOf.get(row.userId) ?? 'PUSH');
    }
    return rows.length;
  }

  async listForUser(userId: string): Promise<NotificationSummary[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      entityRef: r.entityRef,
      readAt: r.readAt ? r.readAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async markRead(notificationId: string, userId: string): Promise<void> {
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException('Notification not found');
    }
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
