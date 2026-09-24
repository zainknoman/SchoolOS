import type { AcademicSession, Prisma, PrismaClient } from '@prisma/client';

type SessionReader = {
  academicSession: Pick<PrismaClient['academicSession'], 'findFirst'>;
};

/**
 * The active academic session OF A SCHOOL (BL-01, Q1: each school runs its own calendar).
 *
 * Expand-phase compatibility (migration M3): until `npm run backfill:m3` has run, sessions have
 * no school; a school without an active session of its own then falls back to a legacy
 * (school-less) active session, exactly as before. The M3 contract step removes the fallback.
 */
export async function activeSessionForSchool(
  db: SessionReader | Prisma.TransactionClient,
  schoolId: string,
): Promise<AcademicSession | null> {
  return (
    (await db.academicSession.findFirst({
      where: { isActive: true, schoolId },
    })) ??
    (await db.academicSession.findFirst({
      where: { isActive: true, schoolId: null },
    }))
  );
}
