import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { assertDeletable } from './prisma-delete-guard';

function makeP2003(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    'Foreign key constraint failed',
    {
      code: 'P2003',
      clientVersion: 'test',
    },
  );
}

describe('assertDeletable', () => {
  it('translates a P2003 foreign-key violation into a BadRequestException naming the entity', () => {
    expect(() => assertDeletable(makeP2003(), 'Campus')).toThrow(
      BadRequestException,
    );
    try {
      assertDeletable(makeP2003(), 'Campus');
    } catch (err) {
      expect((err as BadRequestException).message).toContain('Campus');
    }
  });

  it('rethrows any other error unchanged', () => {
    const other = new Error('boom');
    expect(() => assertDeletable(other, 'Campus')).toThrow(other);
  });

  it('rethrows a Prisma error with a different code unchanged', () => {
    const notFound = new Prisma.PrismaClientKnownRequestError(
      'Record not found',
      {
        code: 'P2025',
        clientVersion: 'test',
      },
    );
    expect(() => assertDeletable(notFound, 'Campus')).toThrow(notFound);
  });
});
