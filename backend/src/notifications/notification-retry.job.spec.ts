import { NotificationRetryJob } from './notification-retry.job';
import type { NotificationsService } from './notifications.service';
import type { JobLockService } from '../prisma/job-lock.service';

describe('NotificationRetryJob (KI-5)', () => {
  const notifications = { retryDue: jest.fn() };
  const jobLock = {
    runExclusive: jest.fn((_: string, fn: () => Promise<void>) => fn()),
  };
  const job = new NotificationRetryJob(
    notifications as unknown as NotificationsService,
    jobLock as unknown as JobLockService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('retries due notifications under the job lock', async () => {
    notifications.retryDue.mockResolvedValue(3);
    await job.run();
    expect(jobLock.runExclusive).toHaveBeenCalledWith(
      'notification-retry',
      expect.any(Function),
    );
    expect(notifications.retryDue).toHaveBeenCalledTimes(1);
  });

  it('never throws out of the scheduler', async () => {
    notifications.retryDue.mockRejectedValue(new Error('db down'));
    await expect(job.run()).resolves.toBeUndefined();
  });
});
