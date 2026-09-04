import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Every People-CRUD create() that provisions a User calls this from its catch block. Translates
 * a Prisma unique-constraint failure (P2002 — e.g. a duplicate User.identifier) into a clear 400
 * instead of letting a raw 500 reach the client. Any other error is rethrown unchanged.
 */
export function assertCreatable(error: unknown, message: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new BadRequestException(message);
  }
  throw error;
}
