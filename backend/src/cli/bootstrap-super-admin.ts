import * as argon2 from 'argon2';
import type { PrismaClient } from '@prisma/client';

/**
 * Controlled creation of the FIRST SUPER_ADMIN (BL-22) — the only supported way to get an
 * administrator into an empty production database. There is no registration endpoint.
 *
 * - Credentials come from the environment / secret store, never from arguments (which would land
 *   in shell history and process lists): BOOTSTRAP_SUPER_ADMIN_IDENTIFIER and
 *   BOOTSTRAP_SUPER_ADMIN_PASSWORD. Remove both from the environment after the run.
 * - Refuses when any SUPER_ADMIN already exists, when the identifier is taken, or when
 *   BOOTSTRAP_SUPER_ADMIN_DISABLED=true. Concurrent runs are serialised by an advisory lock.
 * - The account gets mustChangePassword, so the bootstrap password is used exactly once.
 * - Audited as `bootstrap.super-admin` (identifier only, never the password).
 */
export const MIN_BOOTSTRAP_PASSWORD_LENGTH = 12;
// Arbitrary constant key for pg_advisory_xact_lock — unique to this command.
const BOOTSTRAP_LOCK_KEY = 7_220_022;

export type BootstrapResult =
  | { ok: true; userId: string; identifier: string }
  | { ok: false; reason: string };

export async function bootstrapSuperAdmin(
  prisma: Pick<PrismaClient, '$transaction'>,
  env: NodeJS.ProcessEnv,
): Promise<BootstrapResult> {
  if (
    (env.BOOTSTRAP_SUPER_ADMIN_DISABLED ?? '').trim().toLowerCase() === 'true'
  ) {
    return {
      ok: false,
      reason: 'Bootstrap is disabled (BOOTSTRAP_SUPER_ADMIN_DISABLED=true).',
    };
  }
  const identifier = (env.BOOTSTRAP_SUPER_ADMIN_IDENTIFIER ?? '').trim();
  const password = env.BOOTSTRAP_SUPER_ADMIN_PASSWORD ?? '';
  if (!identifier) {
    return {
      ok: false,
      reason: 'BOOTSTRAP_SUPER_ADMIN_IDENTIFIER is not set.',
    };
  }
  if (password.length < MIN_BOOTSTRAP_PASSWORD_LENGTH) {
    return {
      ok: false,
      reason: `BOOTSTRAP_SUPER_ADMIN_PASSWORD must be at least ${MIN_BOOTSTRAP_PASSWORD_LENGTH} characters.`,
    };
  }
  const passwordHash = await argon2.hash(password);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BOOTSTRAP_LOCK_KEY})`;
    const existing = await tx.user.count({ where: { role: 'SUPER_ADMIN' } });
    if (existing > 0) {
      return {
        ok: false as const,
        reason:
          'A SUPER_ADMIN already exists — bootstrap runs only on an empty system.',
      };
    }
    if (await tx.user.findUnique({ where: { identifier } })) {
      return {
        ok: false as const,
        reason: 'That identifier is already used by another account.',
      };
    }
    const user = await tx.user.create({
      data: {
        identifier,
        passwordHash,
        role: 'SUPER_ADMIN',
        mustChangePassword: true,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: 'bootstrap.super-admin',
        entity: 'User',
        entityId: user.id,
        metadata: JSON.stringify({ identifier }),
      },
    });
    return { ok: true as const, userId: user.id, identifier };
  });
}
