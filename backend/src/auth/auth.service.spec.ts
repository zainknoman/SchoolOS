import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  MAX_FAILED_ATTEMPTS,
  GENERIC_AUTH_ERROR,
  ACCOUNT_LOCKED_ERROR,
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
    };
  };

  const baseUser = {
    id: 'user-1',
    identifier: 'parent@seeds.edu.pk',
    role: 'PARENT',
    isLocked: false,
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
      },
    };

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
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('logs in successfully with correct credentials and issues tokens', async () => {
    const passwordHash = await argon2.hash('correct-horse');
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash });
    prisma.user.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});

    const result = await service.login('parent@seeds.edu.pk', 'correct-horse');

    expect(result.accessToken).toBe('signed-access-token');
    expect(typeof result.refreshToken).toBe('string');
    expect(result.role).toBe('PARENT');
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
      service.login('nobody@seeds.edu.pk', 'whatever'),
    ).rejects.toThrow(GENERIC_AUTH_ERROR);
  });

  it('rejects a wrong password with the SAME generic error as an unknown identifier', async () => {
    const passwordHash = await argon2.hash('correct-horse');
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash });
    prisma.user.update.mockResolvedValue({});

    await expect(
      service.login('parent@seeds.edu.pk', 'wrong-password'),
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
      service.login('parent@seeds.edu.pk', 'wrong-password'),
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
      service.login('parent@seeds.edu.pk', 'correct-horse'),
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

    const result = await service.login('parent@seeds.edu.pk', 'correct-horse');
    expect(result.accessToken).toBe('signed-access-token');
  });

  it('never includes the password or its hash anywhere in the returned session', async () => {
    const passwordHash = await argon2.hash('correct-horse');
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash });
    prisma.user.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});

    const result = await service.login('parent@seeds.edu.pk', 'correct-horse');

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
      // the presented token is revoked as part of the same exchange (rotation-on-use)
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rejects an unknown refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh('garbage-token')).rejects.toThrow(GENERIC_AUTH_ERROR);
    });

    it('rejects an expired refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...storedToken,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh('expired-token')).rejects.toThrow(GENERIC_AUTH_ERROR);
    });

    it('rejects an already-revoked refresh token (rejects reuse)', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...storedToken,
        revokedAt: new Date(),
      });

      await expect(service.refresh('reused-token')).rejects.toThrow(GENERIC_AUTH_ERROR);
      expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    });
  });
});
