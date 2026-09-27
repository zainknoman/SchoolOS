import type { Request } from 'express';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';

const headerRequest = {
  path: '/api/v1/me',
  headers: { authorization: 'Bearer x' },
} as unknown as Request;

function linkRequest(path: string): Request {
  return {
    path,
    headers: {},
    method: 'GET',
    query: { dl: 'x' },
  } as unknown as Request;
}

describe('JwtStrategy.validate (BL-21: per-request account recheck)', () => {
  const account = {
    id: 'u1',
    role: 'SCHOOL_ADMIN',
    isLocked: false,
    tokenVersion: 2,
    mustChangePassword: false,
  };
  const make = (row: unknown) => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(row) } };
    const config = {
      get: (k: string) =>
        k === 'JWT_ACCESS_SECRET' ? 'unit-test-secret' : 'test',
    } as unknown as ConfigService;
    return new JwtStrategy(config, prisma as unknown as PrismaService);
  };

  it('returns the user with the role and mustChangePassword read from the database', async () => {
    const user = await make({
      ...account,
      role: 'TEACHER',
      mustChangePassword: true,
    }).validate(headerRequest, {
      sub: 'u1',
      role: 'SCHOOL_ADMIN',
      tv: 2,
    });
    expect(user).toEqual({
      id: 'u1',
      role: 'TEACHER',
      mustChangePassword: true,
    });
  });

  it.each([
    ['a deleted user', null, 2],
    ['a disabled user', { ...account, isLocked: true }, 2],
    ['a token issued before sessions were revoked', account, 1],
    ['a pre-BL-21 token (no tv) after a revocation', account, undefined],
  ])('rejects %s', async (_label, row, tv) => {
    await expect(
      make(row).validate(headerRequest, {
        sub: 'u1',
        role: 'SCHOOL_ADMIN',
        tv,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('accepts a pre-BL-21 token (no tv) while the version is still 0', async () => {
    await expect(
      make({ ...account, tokenVersion: 0 }).validate(headerRequest, {
        sub: 'u1',
        role: 'SCHOOL_ADMIN',
      }),
    ).resolves.toMatchObject({ id: 'u1' });
  });

  it('does not end sessions for a failed-login lockout (lockedUntil is not selected)', async () => {
    const strategy = make(account);
    await strategy.validate(headerRequest, {
      sub: 'u1',
      role: 'SCHOOL_ADMIN',
      tv: 2,
    });
    const prisma = (
      strategy as unknown as { prisma: { user: { findUnique: jest.Mock } } }
    ).prisma;
    expect(prisma.user.findUnique.mock.calls[0][0].select).not.toHaveProperty(
      'lockedUntil',
    );
  });
});

describe('JwtStrategy.validate (BL-36: download links)', () => {
  const account = {
    id: 'u1',
    role: 'PARENT',
    isLocked: false,
    tokenVersion: 0,
    mustChangePassword: false,
    grants: [],
  };
  const strategy = () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(account) },
    };
    const config = {
      get: (k: string) =>
        k === 'JWT_ACCESS_SECRET' ? 'unit-test-secret' : 'test',
    } as unknown as ConfigService;
    return new JwtStrategy(config, prisma as unknown as PrismaService);
  };
  const link = {
    sub: 'u1',
    role: '',
    tv: 0,
    typ: 'dl',
    path: '/api/v1/files/f1',
  };

  it('accepts a link token on the path it was minted for', async () => {
    await expect(
      strategy().validate(linkRequest('/api/v1/files/f1'), link),
    ).resolves.toMatchObject({ id: 'u1' });
  });

  it('rejects a link token on another path', async () => {
    await expect(
      strategy().validate(linkRequest('/api/v1/files/f2'), link),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a link token presented as a bearer header', async () => {
    await expect(strategy().validate(headerRequest, link)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an access token presented as ?dl=', async () => {
    await expect(
      strategy().validate(linkRequest('/api/v1/files/f1'), {
        sub: 'u1',
        role: 'PARENT',
        tv: 0,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
