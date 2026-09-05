import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { assertCreatable, assertValidReferences } from './prisma-create-guard';

function makeP2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

function makeP2003(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
    code: 'P2003',
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

describe('assertValidReferences', () => {
  it('translates a P2003 foreign-key violation into a BadRequestException with the given message', () => {
    expect(() => assertValidReferences(makeP2003(), 'Invalid school reference.')).toThrow(BadRequestException);
    try {
      assertValidReferences(makeP2003(), 'Invalid school reference.');
    } catch (err) {
      expect((err as BadRequestException).message).toBe('Invalid school reference.');
    }
  });

  it('rethrows any other error unchanged', () => {
    const other = new Error('boom');
    expect(() => assertValidReferences(other, 'x')).toThrow(other);
  });

  it('rethrows a Prisma error with a different code unchanged (e.g. P2002)', () => {
    const unique = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });
    expect(() => assertValidReferences(unique, 'x')).toThrow(unique);
  });
});
