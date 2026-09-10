import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PUSH_ADAPTER } from './push-adapter';
import type { PushAdapter } from './push-adapter';
import { WHATSAPP_ADAPTER, SMS_ADAPTER, resolveAdapterFor } from './channel-registry';

export type NotificationType = 'diary' | 'circular' | 'message';

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

    await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        entityRef: input.entityRef ?? null,
        dispatchedAt: dispatchNow ? new Date() : null,
      },
    });

    // Digest-enabled users get their in-app Notification row immediately (unchanged), but the
    // actual send is deferred and bundled by DigestDispatchJob — don't couple digest mode to
    // in-app visibility.
    if (!dispatchNow) return;

    const adapter = resolveAdapterFor(user?.notificationChannel ?? 'PUSH', {
      push: this.push,
      whatsapp: this.whatsapp,
      sms: this.sms,
    });

    try {
      await adapter.send(input.userId, {
        title: input.title,
        body: input.body,
        data: { type: input.type, entityRef: input.entityRef ?? '' },
      });
    } catch (err) {
      // Best-effort — a missing/failed delivery provider must never fail the write that triggered
      // it (diary/circular/message creation has already succeeded by the time this runs).
      console.error('Notification delivery failed', err);
    }
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
