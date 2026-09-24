import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { MAIL_ADAPTER } from '../notifications/mail-adapter';
import {
  MAX_FAILED_ATTEMPTS,
  GENERIC_AUTH_ERROR,
  ACCOUNT_LOCKED_ERROR,
  RESET_PASSWORD_GENERIC_ERROR,
} from './auth.constants';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    passwordResetToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let mailAdapter: { send: jest.Mock };

  const baseUser = {
    id: 'user-1',
    identifier: 'parent@schoolos.edu.pk',
    role: 'PARENT',
    isLocked: false,
    isPrincipal: false,
    mustChangePassword: false,
    campusId: null as string | null,
    schoolId: null as string | null,
    lockedUntil: null as Date | null,
    failedLoginCount: 0,
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      passwordResetToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest
        .fn()
        .mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    mailAdapter = { send: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('signed-access-token'),
            verify: jest.fn(),
          },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: MAIL_ADAPTER, useValue: mailAdapter },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('logs in successfully with correct credentials and issues tokens', async () => {
    const passwordHash = await argon2.hash('correct-horse');
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash });
    prisma.user.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});

    const result = await service.login(
      'parent@schoolos.edu.pk',
      'correct-horse',
    );

    expect(result.accessToken).toBe('signed-access-token');
    expect(typeof result.refreshToken).toBe('string');
    expect(result.role).toBe('PARENT');
    expect(result.mustChangePassword).toBe(false);
    expect(result.campusId).toBeNull();
    expect(result.schoolId).toBeNull();
    // failed-login counter resets on success
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({ failedLoginCount: 0 }),
      }),
    );
  });

  it('rejects an unknown identifier with a GENERIC error (never reveals which field was wrong)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login('nobody@schoolos.edu.pk', 'whatever'),
    ).rejects.toThrow(GENERIC_AUTH_ERROR);
  });

  it('rejects a wrong password with the SAME generic error as an unknown identifier', async () => {
    const passwordHash = await argon2.hash('correct-horse');
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash });
    prisma.user.update.mockResolvedValue({});

    await expect(
      service.login('parent@schoolos.edu.pk', 'wrong-password'),
    ).rejects.toThrow(GENERIC_AUTH_ERROR);
  });

  it('locks the account after 5 failed attempts and reports a distinct lock error', async () => {
    const passwordHash = await argon2.hash('correct-horse');
    prisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      passwordHash,
      failedLoginCount: MAX_FAILED_ATTEMPTS - 1,
    });
    prisma.user.update.mockResolvedValue({});

    await expect(
      service.login('parent@schoolos.edu.pk', 'wrong-password'),
    ).rejects.toThrow(ACCOUNT_LOCKED_ERROR);

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          failedLoginCount: MAX_FAILED_ATTEMPTS,
          lockedUntil: expect.any(Date),
        }),
      }),
    );
  });

  it('rejects login while the account is still within its lock window, even with the correct password', async () => {
    const passwordHash = await argon2.hash('correct-horse');
    const lockedUntil = new Date(Date.now() + 60_000);
    prisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      passwordHash,
      isLocked: true,
      lockedUntil,
    });

    await expect(
      service.login('parent@schoolos.edu.pk', 'correct-horse'),
    ).rejects.toThrow(ACCOUNT_LOCKED_ERROR);
  });

  it('allows login again once the lock window has passed', async () => {
    const passwordHash = await argon2.hash('correct-horse');
    const lockedUntil = new Date(Date.now() - 60_000); // expired
    prisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      passwordHash,
      isLocked: true,
      lockedUntil,
      failedLoginCount: MAX_FAILED_ATTEMPTS,
    });
    prisma.user.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});

    const result = await service.login(
      'parent@schoolos.edu.pk',
      'correct-horse',
    );
    expect(result.accessToken).toBe('signed-access-token');
  });

  it('never includes the password or its hash anywhere in the returned session', async () => {
    const passwordHash = await argon2.hash('correct-horse');
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash });
    prisma.user.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});

    const result = await service.login(
      'parent@schoolos.edu.pk',
      'correct-horse',
    );

    expect(JSON.stringify(result)).not.toContain(passwordHash);
    expect(JSON.stringify(result)).not.toContain('correct-horse');
  });

  it('rejects a role check for a PARENT token attempting an admin-only action', () => {
    expect(() =>
      service.assertRole('PARENT', ['SCHOOL_ADMIN', 'SUPER_ADMIN']),
    ).toThrow(UnauthorizedException);
  });

  it('allows a role check when the role is in the permitted list', () => {
    expect(() =>
      service.assertRole('TEACHER', ['TEACHER', 'SCHOOL_ADMIN']),
    ).not.toThrow();
  });

  it('reports mustChangePassword and campusId on login', async () => {
    const passwordHash = await argon2.hash('Temp1234!x');
    prisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      passwordHash,
      mustChangePassword: true,
      isPrincipal: true,
      campusId: 'campus-1',
      schoolId: 'school-1',
    });
    prisma.user.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});

    const session = await service.login('head@school.test', 'Temp1234!x');
    expect(session.mustChangePassword).toBe(true);
    expect(session.campusId).toBe('campus-1');
    expect(session.schoolId).toBe('school-1');
  });

  describe('changePassword', () => {
    let passwordHash: string;
    beforeEach(async () => {
      passwordHash = await argon2.hash('Right1234!');
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        id: 'u1',
        passwordHash,
        mustChangePassword: true,
        campusId: 'campus-1',
        schoolId: 'school-1',
      });
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      prisma.refreshToken.create.mockResolvedValue({});
    });

    it('rejects a wrong current password', async () => {
      await expect(
        service.changePassword('u1', 'Wrong1234!', 'NewPass123!'),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a missing user with the generic error', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.changePassword('ghost', 'Right1234!', 'NewPass123!'),
      ).rejects.toThrow(GENERIC_AUTH_ERROR);
    });

    it('rejects reusing the current password', async () => {
      await expect(
        service.changePassword('u1', 'Right1234!', 'Right1234!'),
      ).rejects.toThrow(BadRequestException);
    });

    it('stores a new hash, clears mustChangePassword, revokes refresh tokens and returns a fresh session', async () => {
      const session = await service.changePassword(
        'u1',
        'Right1234!',
        'NewPass123!',
      );
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: expect.objectContaining({ mustChangePassword: false }),
        }),
      );
      expect(prisma.user.update.mock.calls[0][0].data.passwordHash).not.toBe(
        passwordHash,
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.refreshToken.create).toHaveBeenCalled();
      expect(session.mustChangePassword).toBe(false);
      expect(session.campusId).toBe('campus-1');
      expect(session.schoolId).toBe('school-1');
      expect(session.accessToken).toBe('signed-access-token');
      expect(JSON.stringify(session)).not.toContain('NewPass123!');
    });
  });

  describe('refresh', () => {
    const storedToken = {
      id: 'rt-1',
      userId: 'user-1',
      tokenHash: expect.any(String),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null as Date | null,
    };

    it('exchanges a valid, unexpired, unrevoked refresh token for a new session', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(storedToken);
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue({ ...baseUser });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh('some-raw-refresh-token');

      expect(result.accessToken).toBe('signed-access-token');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.role).toBe('PARENT');
      expect(result.mustChangePassword).toBe(false);
      expect(result.campusId).toBeNull();
      expect(result.schoolId).toBeNull();
      // the presented token is revoked as part of the same exchange (rotation-on-use)
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('returns the user schoolId on refresh', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(storedToken);
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        schoolId: 'school-1',
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh('some-raw-refresh-token');

      expect(result.schoolId).toBe('school-1');
    });

    it('rejects an unknown refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh('garbage-token')).rejects.toThrow(
        GENERIC_AUTH_ERROR,
      );
    });

    it('rejects an expired refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...storedToken,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh('expired-token')).rejects.toThrow(
        GENERIC_AUTH_ERROR,
      );
    });

    it('rejects an already-revoked refresh token (rejects reuse)', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...storedToken,
        revokedAt: new Date(),
      });

      await expect(service.refresh('reused-token')).rejects.toThrow(
        GENERIC_AUTH_ERROR,
      );
      expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    it('creates a reset token and emails a reset link for a known identifier', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser });
      prisma.passwordResetToken.create.mockResolvedValue({});
      mailAdapter.send.mockResolvedValue(undefined);

      await service.forgotPassword('parent@schoolos.edu.pk');

      expect(prisma.passwordResetToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            tokenHash: expect.any(String),
            expiresAt: expect.any(Date),
          }),
        }),
      );
      expect(mailAdapter.send).toHaveBeenCalledWith(
        'parent@schoolos.edu.pk',
        expect.stringContaining('Reset your'),
        expect.stringContaining('reset-password?token='),
      );
    });

    it('silently no-ops for an unknown identifier — never reveals whether an account exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.forgotPassword('nobody@schoolos.edu.pk'),
      ).resolves.toBeUndefined();

      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(mailAdapter.send).not.toHaveBeenCalled();
    });

    it('swallows a mail-delivery failure — the caller must never see it (same generic response either way)', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser });
      prisma.passwordResetToken.create.mockResolvedValue({});
      mailAdapter.send.mockRejectedValue(new Error('smtp down'));
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      await expect(
        service.forgotPassword('parent@schoolos.edu.pk'),
      ).resolves.toBeUndefined();
      // Only the error's name/message is logged — never the error object (BL-51).
      expect(consoleError).toHaveBeenCalledWith(
        'Password reset email delivery failed:',
        'Error: smtp down',
      );
      consoleError.mockRestore();
    });
  });

  describe('resetPassword', () => {
    const storedResetToken = {
      id: 'prt-1',
      userId: 'user-1',
      tokenHash: expect.any(String),
      expiresAt: new Date(Date.now() + 60 * 60_000),
      usedAt: null as Date | null,
    };

    it('resets the password, marks the token used, and revokes every active session in one transaction', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(storedResetToken);
      prisma.user.update.mockResolvedValue({});
      prisma.passwordResetToken.update.mockResolvedValue({});
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await service.resetPassword('raw-token', 'NewCorrectHorse9!');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1' } }),
      );
      expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({
        passwordHash: expect.any(String),
        mustChangePassword: false,
      });
      expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({
        where: { id: 'prt-1' },
        data: { usedAt: expect.any(Date) },
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rejects an unknown token with the generic reset error', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword('garbage', 'NewPass9!'),
      ).rejects.toThrow(RESET_PASSWORD_GENERIC_ERROR);
    });

    it('rejects an expired token', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        ...storedResetToken,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        service.resetPassword('expired', 'NewPass9!'),
      ).rejects.toThrow(RESET_PASSWORD_GENERIC_ERROR);
    });

    it('rejects an already-used token (rejects replay)', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        ...storedResetToken,
        usedAt: new Date(),
      });

      await expect(service.resetPassword('used', 'NewPass9!')).rejects.toThrow(
        RESET_PASSWORD_GENERIC_ERROR,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
