import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** BL-04 (Q4): the relationship types a guardian link may have. */
export const GUARDIAN_RELATIONSHIPS = [
  'FATHER',
  'MOTHER',
  'GUARDIAN',
  'OTHER',
] as const;
export type GuardianRelationshipName = (typeof GUARDIAN_RELATIONSHIPS)[number];

/** Q4: a student has at most this many primary guardians (slots 1..MAX). */
export const MAX_PRIMARY_GUARDIANS = 2;

export const TOO_MANY_PRIMARY =
  'This student already has two primary guardians; make one of them non-primary first';

/**
 * The pre-M6 columns (`relationship` text, `isPrimary`) are kept in step with the typed ones until
 * the contract migration drops them — the parent app still reads the lowercase text.
 */
export function legacyLinkFields(
  relationshipType: GuardianRelationshipName,
  primarySlot: number | null,
) {
  return {
    relationship: relationshipType.toLowerCase(),
    isPrimary: primarySlot !== null,
  };
}

/**
 * The first free primary slot (1 or 2) for `studentId`, ignoring `exceptLinkId` (the link being
 * changed). Throws 409 when both slots are taken — the third primary is rejected (BL-04). The
 * unique (studentId, primarySlot) index (M6) makes a concurrent grab of the same slot fail too.
 */
export async function freePrimarySlot(
  tx: Prisma.TransactionClient,
  studentId: string,
  exceptLinkId?: string,
): Promise<number> {
  const taken = await tx.studentParent.findMany({
    where: {
      studentId,
      primarySlot: { not: null },
      ...(exceptLinkId ? { NOT: { id: exceptLinkId } } : {}),
    },
    select: { primarySlot: true },
  });
  const used = new Set(taken.map((t) => t.primarySlot));
  for (let slot = 1; slot <= MAX_PRIMARY_GUARDIANS; slot++) {
    if (!used.has(slot)) return slot;
  }
  throw new ConflictException(TOO_MANY_PRIMARY);
}
