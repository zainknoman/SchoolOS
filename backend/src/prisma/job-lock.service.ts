import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from './prisma.service';

/** Longest a scheduled job may hold its lock before the transaction (and lock) is abandoned. */
export const JOB_LOCK_MAX_MS = 30 * 60_000;

/**
 * Cluster-wide mutual exclusion for scheduled jobs (BL-39, "M13" without a schema change): every
 * instance fires the same @Cron, but only the one that wins a PostgreSQL transaction-scoped
 * advisory lock runs the job; the others skip. The lock lives exactly as long as the job's
 * holding transaction, so it is released on success, on failure and when an instance dies.
 * Jobs must still be idempotent (they are): with clock skew, a second instance may run after the
 * first finished — it then finds nothing left to do.
 */
@Injectable()
export class JobLockService {
  private readonly logger = new Logger(JobLockService.name);

  constructor(private readonly prisma: PrismaService) {}

  async runExclusive(
    name: string,
    job: () => Promise<void>,
  ): Promise<'ran' | 'skipped'> {
    const key = lockKey(name);
    return this.prisma.$transaction(
      async (tx) => {
        const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(${key}::bigint) AS locked`;
        if (!locked) {
          this.logger.log(`${name}: another instance holds the lock — skipped`);
          return 'skipped' as const;
        }
        await job();
        return 'ran' as const;
      },
      { timeout: JOB_LOCK_MAX_MS, maxWait: 10_000 },
    );
  }
}

/** Stable signed 64-bit key per job name (first 8 bytes of SHA-1), as a decimal string. */
export function lockKey(name: string): string {
  return createHash('sha1')
    .update(`schoolos-job:${name}`)
    .digest()
    .readBigInt64BE(0)
    .toString();
}
