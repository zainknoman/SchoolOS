import * as argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import { normalizeIdentifier } from '../common/normalize-identifier';

export interface CreateParentInput {
  identifier: string;
  password: string;
  name: string;
  phone?: string;
}

export interface CreatedParent {
  id: string;
  identifier: string;
  name: string;
  phone: string | null;
}

/**
 * The one place a Parent's User + ParentProfile are created together — called both from
 * ParentService.create() (its own top-level transaction) and from StudentService.create() (when
 * a request carries a new-parent payload instead of an existing parentProfileId, inside that
 * larger transaction) — so there is exactly one User+ParentProfile creation code path, not two.
 * Takes a Prisma transaction client, not PrismaService, so the caller controls the transaction
 * boundary.
 */
export async function createParentWithUser(
  tx: Prisma.TransactionClient,
  dto: CreateParentInput,
): Promise<CreatedParent> {
  const passwordHash = await argon2.hash(dto.password);
  const user = await tx.user.create({
    data: { identifier: normalizeIdentifier(dto.identifier), passwordHash, role: 'PARENT' },
  });
  const parentProfile = await tx.parentProfile.create({
    data: { userId: user.id, name: dto.name, phone: dto.phone },
  });
  return { id: parentProfile.id, identifier: user.identifier, name: parentProfile.name, phone: parentProfile.phone };
}
