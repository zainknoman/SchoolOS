import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { JobLockService } from '../prisma/job-lock.service';
import { NotificationsService } from './notifications.service';
import { NOTIFICATION_RETRY_CRON } from './delivery-policy';

/** KI-5 / KG-22: retries failed notification deliveries with backoff (see delivery-policy.ts). */
@Injectable()
export class NotificationRetryJob {
  private readonly logger = new Logger(NotificationRetryJob.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly jobLock: JobLockService,
  ) {}

  @Cron(NOTIFICATION_RETRY_CRON)
  async run(): Promise<void> {
    try {
      // BL-39: one instance at a time, or a due notification would be sent twice.
      await this.jobLock.runExclusive('notification-retry', async () => {
        await this.notifications.retryDue();
      });
    } catch (err) {
      this.logger.error('Notification retry run failed', err as Error);
    }
  }
}
