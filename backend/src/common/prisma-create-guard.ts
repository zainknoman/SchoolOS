import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Every People-CRUD create() that provisions a User calls this from its catch block. Translates
 * a Prisma unique-constraint failure (P2002 — e.g. a duplicate User.identifier) into a clear 400
 * instead of letting a raw 500 reach the client. Any other error is rethrown unchanged.
 */
export function assertCreatable(error: unknown, message: string): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new BadRequestException(message);
  }
  throw error;
}

/**
 * BL-53: a write that lost a race against a DB invariant (unique / partial-unique index, M12)
 * becomes a 409 with a clear message; any other error is rethrown unchanged.
 */
export function rethrowUniqueAsConflict(
  error: unknown,
  message: string,
): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new ConflictException(message);
  }
  throw error;
}

/**
 * Every org-structure create()/update() that writes a caller-supplied parent id (schoolId,
 * campusId, classTeacherId, ...) calls this from its catch/`.catch()` handler. Translates a
 * Prisma foreign-key-constraint failure (P2003 — the referenced parent row doesn't exist) into a
 * clear 400 instead of letting a raw 500 reach the client. Any other error is rethrown unchanged.
 */
export function assertValidReferences(error: unknown, message: string): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2003'
  ) {
    throw new BadRequestException(message);
  }
  throw error;
}
