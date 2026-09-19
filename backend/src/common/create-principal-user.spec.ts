import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { createPrincipalUser } from './create-principal-user';

describe('createPrincipalUser', () => {
  const makeTx = () => ({ user: { create: jest.fn().mockResolvedValue({ id: 'u1' }) } });

  it('creates a SCHOOL_ADMIN principal who must change their password, and returns a generated password once', async () => {
    const tx = makeTx();
    const result = await createPrincipalUser(tx as never, {
      identifier: 'head@school.test',
      schoolId: 's1',
      campusId: null,
    });

    expect(result.identifier).toBe('head@school.test');
    expect(result.temporaryPassword).toEqual(expect.any(String));
    expect((result.temporaryPassword as string).length).toBeGreaterThanOrEqual(12);
    const data = tx.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      identifier: 'head@school.test',
      role: 'SCHOOL_ADMIN',
      isPrincipal: true,
      mustChangePassword: true,
      schoolId: 's1',
      campusId: null,
    });
    expect(data.passwordHash).not.toContain(result.temporaryPassword);
    expect(await argon2.verify(data.passwordHash, result.temporaryPassword as string)).toBe(true);
  });

  it('uses a caller-supplied password and does not echo it back', async () => {
    const tx = makeTx();
    const result = await createPrincipalUser(tx as never, {
      identifier: 'p@campus.test',
      password: 'Sup3rSecret!',
      schoolId: 's1',
      campusId: 'c1',
    });
    expect(result.temporaryPassword).toBeNull();
    expect(tx.user.create.mock.calls[0][0].data.campusId).toBe('c1');
  });

  it('translates a duplicate identifier into a BadRequestException', async () => {
    const tx = makeTx();
    tx.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }),
    );
    await expect(
      createPrincipalUser(tx as never, { identifier: 'dup@x.test', schoolId: 's1', campusId: null }),
    ).rejects.toThrow(BadRequestException);
  });
});
