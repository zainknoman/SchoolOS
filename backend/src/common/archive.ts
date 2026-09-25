import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

/**
 * BL-07 (Q7): archiving a teacher, shared by the teacher and staff endpoints. The teacher leaves
 * every class-teacher and timetable slot (as the old hard delete did through SET NULL — the M8
 * triggers end-date the teaching history), and the login is disabled with all sessions revoked.
 * Nothing is deleted; `POST …/erase` (super admin) is the only hard delete.
 */
export async function archiveTeacherTx(
  tx: Prisma.TransactionClient,
  teacherId: string,
  now: Date,
): Promise<void> {
  const teacher = await tx.teacher.update({
    where: { id: teacherId },
    data: { archivedAt: now },
  });
  await tx.section.updateMany({
    where: { classTeacherId: teacherId },
    data: { classTeacherId: null },
  });
  await tx.timetable.updateMany({
    where: { teacherId },
    data: { teacherId: null },
  });
  await disableLoginTx(tx, teacher.userId, now);
}

/** Locks an account and revokes its sessions (same effect as the BL-21 "disable"). */
export async function disableLoginTx(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date,
): Promise<void> {
  await tx.user.update({
    where: { id: userId },
    data: { isLocked: true, tokenVersion: { increment: 1 } },
  });
  await tx.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now },
  });
}

export function assertArchivedForErasure(
  archivedAt: Date | null,
  what: string,
): void {
  if (!archivedAt) {
    throw new ConflictException(
      `Only an archived ${what} can be erased — archive it first`,
    );
  }
}
