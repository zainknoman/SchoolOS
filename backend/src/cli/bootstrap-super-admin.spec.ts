import * as argon2 from 'argon2';
import {
  bootstrapSuperAdmin,
  MIN_BOOTSTRAP_PASSWORD_LENGTH,
} from './bootstrap-super-admin';

describe('bootstrapSuperAdmin (BL-22)', () => {
  const env = {
    BOOTSTRAP_SUPER_ADMIN_IDENTIFIER: 'owner@school.example.pk',
    BOOTSTRAP_SUPER_ADMIN_PASSWORD: 'Long-Enough-Secret-9',
  };
  function fakePrisma({ superAdmins = 0, identifierTaken = false } = {}) {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      user: {
        count: jest.fn().mockResolvedValue(superAdmins),
        findUnique: jest
          .fn()
          .mockResolvedValue(identifierTaken ? { id: 'x' } : null),
        create: jest.fn().mockResolvedValue({ id: 'new-admin' }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    return { prisma: prisma as never, tx };
  }

  it('creates the first SUPER_ADMIN with mustChangePassword and audits it without the password', async () => {
    const { prisma, tx } = fakePrisma();
    const result = await bootstrapSuperAdmin(prisma, env);

    expect(result).toEqual({
      ok: true,
      userId: 'new-admin',
      identifier: env.BOOTSTRAP_SUPER_ADMIN_IDENTIFIER,
    });
    expect(tx.$executeRaw).toHaveBeenCalled(); // advisory lock taken first
    const data = tx.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      identifier: env.BOOTSTRAP_SUPER_ADMIN_IDENTIFIER,
      role: 'SUPER_ADMIN',
      mustChangePassword: true,
    });
    expect(
      await argon2.verify(
        data.passwordHash,
        env.BOOTSTRAP_SUPER_ADMIN_PASSWORD,
      ),
    ).toBe(true);
    const audit = JSON.stringify(tx.auditLog.create.mock.calls[0][0]);
    expect(audit).toContain('bootstrap.super-admin');
    expect(audit).not.toContain(env.BOOTSTRAP_SUPER_ADMIN_PASSWORD);
  });

  it('refuses once any SUPER_ADMIN exists', async () => {
    const { prisma, tx } = fakePrisma({ superAdmins: 1 });
    const result = await bootstrapSuperAdmin(prisma, env);
    expect(result).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/already exists/),
    });
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('refuses a taken identifier', async () => {
    const { prisma, tx } = fakePrisma({ identifierTaken: true });
    expect(await bootstrapSuperAdmin(prisma, env)).toMatchObject({ ok: false });
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...env, BOOTSTRAP_SUPER_ADMIN_DISABLED: 'true' }, /disabled/],
    [
      { ...env, BOOTSTRAP_SUPER_ADMIN_IDENTIFIER: '  ' },
      /IDENTIFIER is not set/,
    ],
    [
      {
        ...env,
        BOOTSTRAP_SUPER_ADMIN_PASSWORD: 'x'.repeat(
          MIN_BOOTSTRAP_PASSWORD_LENGTH - 1,
        ),
      },
      /at least 12/,
    ],
  ])('refuses before touching the database: %#', async (badEnv, reason) => {
    const { prisma } = fakePrisma();
    const result = await bootstrapSuperAdmin(prisma, badEnv);
    expect(result).toMatchObject({
      ok: false,
      reason: expect.stringMatching(reason),
    });
    expect(
      (prisma as unknown as { $transaction: jest.Mock }).$transaction,
    ).not.toHaveBeenCalled();
  });
});
