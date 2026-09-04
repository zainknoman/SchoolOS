import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Every org-structure entity's delete() calls this from its catch block. Translates a Prisma
 * foreign-key-constraint failure (P2003 — the row is still referenced elsewhere, e.g. deleting a
 * Section that still has Timetable/DiaryEntry/Circular rows) into a clear 400 instead of letting
 * a raw 500 reach the client. Any other error is rethrown unchanged.
 */
export function assertDeletable(error: unknown, entityLabel: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
    throw new BadRequestException(
      `Cannot delete this ${entityLabel}: other records still reference it.`,
    );
  }
  throw error;
}
