import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { assertCreatable } from './prisma-create-guard';

function makeP2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

describe('assertCreatable', () => {
  it('translates a P2002 unique-constraint violation into a BadRequestException with the given message', () => {
    expect(() => assertCreatable(makeP2002(), 'This identifier is already in use.')).toThrow(
      BadRequestException,
    );
    try {
      assertCreatable(makeP2002(), 'This identifier is already in use.');
    } catch (err) {
      expect((err as BadRequestException).message).toBe('This identifier is already in use.');
    }
  });

  it('rethrows any other error unchanged', () => {
    const other = new Error('boom');
    expect(() => assertCreatable(other, 'x')).toThrow(other);
  });

  it('rethrows a Prisma error with a different code unchanged', () => {
    const notFound = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: 'test',
    });
    expect(() => assertCreatable(notFound, 'x')).toThrow(notFound);
  });
});
