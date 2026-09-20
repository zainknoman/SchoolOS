import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  createPrincipalUser,
  LoginProvisionDto,
} from './create-principal-user';

describe('createPrincipalUser', () => {
  const makeTx = () => ({
    user: { create: jest.fn().mockResolvedValue({ id: 'u1' }) },
  });

  it('creates a SCHOOL_ADMIN principal who must change their password, and returns a generated password once', async () => {
    const tx = makeTx();
    const result = await createPrincipalUser(tx as never, {
      identifier: 'head@school.test',
      schoolId: 's1',
      campusId: null,
    });

    expect(result.login.identifier).toBe('head@school.test');
    expect(result.userId).toBe('u1');
    expect(result.login.temporaryPassword).toEqual(expect.any(String));
    expect(
      (result.login.temporaryPassword as string).length,
    ).toBeGreaterThanOrEqual(16);
    const data = tx.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      identifier: 'head@school.test',
      role: 'SCHOOL_ADMIN',
      isPrincipal: true,
      mustChangePassword: true,
      schoolId: 's1',
      campusId: null,
    });
    expect(data.passwordHash).not.toContain(result.login.temporaryPassword);
    expect(
      await argon2.verify(
        data.passwordHash,
        result.login.temporaryPassword as string,
      ),
    ).toBe(true);
  });

  it('uses a caller-supplied password and does not echo it back', async () => {
    const tx = makeTx();
    const result = await createPrincipalUser(tx as never, {
      identifier: 'p@campus.test',
      password: 'Sup3rSecret!',
      schoolId: 's1',
      campusId: 'c1',
    });
    expect(result.login.temporaryPassword).toBeNull();
    const data = tx.user.create.mock.calls[0][0].data;
    expect(data.campusId).toBe('c1');
    expect(await argon2.verify(data.passwordHash, 'Sup3rSecret!')).toBe(true);
  });

  it('stores the normalized identifier and returns exactly what was stored', async () => {
    const tx = makeTx();
    const result = await createPrincipalUser(tx as never, {
      identifier: '  Head@School.TEST ',
      schoolId: 's1',
      campusId: null,
    });
    const stored = tx.user.create.mock.calls[0][0].data.identifier;
    expect(stored).toBe('head@school.test');
    expect(result.login.identifier).toBe(stored);
  });

  it('translates a duplicate identifier into a BadRequestException', async () => {
    const tx = makeTx();
    tx.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'x',
      }),
    );
    await expect(
      createPrincipalUser(tx as never, {
        identifier: 'dup@x.test',
        schoolId: 's1',
        campusId: null,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  describe('LoginProvisionDto', () => {
    const check = (identifier: string) =>
      validate(plainToInstance(LoginProvisionDto, { identifier }));

    it('rejects a whitespace-only identifier', async () => {
      expect((await check('   ')).length).toBeGreaterThan(0);
    });
    it('rejects an identifier shorter than 3 after trimming', async () => {
      expect((await check('ab')).length).toBeGreaterThan(0);
      expect((await check('  ab  ')).length).toBeGreaterThan(0);
    });
    it('accepts a 3-character identifier', async () => {
      expect(await check('abc')).toHaveLength(0);
    });
  });
});
