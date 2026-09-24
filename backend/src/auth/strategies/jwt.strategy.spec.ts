import type { Request } from 'express';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  extractAccessTokenForDownloadRoutes,
  JwtStrategy,
} from './jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';

function makeRequest(path: string, accessToken?: string): Request {
  const query = accessToken ? { access_token: accessToken } : {};
  const url = new URL(
    `http://localhost${path}${accessToken ? `?access_token=${accessToken}` : ''}`,
  );
  return {
    path,
    query,
    url: url.toString(),
    originalUrl: url.toString(),
  } as unknown as Request;
}

describe('extractAccessTokenForDownloadRoutes', () => {
  it('extracts ?access_token= on a files download route', () => {
    expect(
      extractAccessTokenForDownloadRoutes(
        makeRequest('/api/v1/files/abc123', 'tok-1'),
      ),
    ).toBe('tok-1');
  });

  it('extracts ?access_token= on a fee voucher PDF download route', () => {
    expect(
      extractAccessTokenForDownloadRoutes(
        makeRequest('/api/v1/fee-vouchers/abc123/pdf', 'tok-1'),
      ),
    ).toBe('tok-1');
  });

  it('extracts ?access_token= on a fee receipt PDF download route', () => {
    expect(
      extractAccessTokenForDownloadRoutes(
        makeRequest('/api/v1/fee-payments/abc123/receipt.pdf', 'tok-1'),
      ),
    ).toBe('tok-1');
  });

  it('extracts ?access_token= on a report card PDF download route', () => {
    expect(
      extractAccessTokenForDownloadRoutes(
        makeRequest('/api/v1/report-cards/abc123/pdf', 'tok-1'),
      ),
    ).toBe('tok-1');
  });

  it('returns null on a non-download route even when ?access_token= is present', () => {
    expect(
      extractAccessTokenForDownloadRoutes(
        makeRequest('/api/v1/me/children', 'tok-1'),
      ),
    ).toBeNull();
  });

  it('returns null on the fee voucher payment mutation route even when ?access_token= is present', () => {
    expect(
      extractAccessTokenForDownloadRoutes(
        makeRequest('/api/v1/fee-vouchers/voucher-1/pay', 'tok-1'),
      ),
    ).toBeNull();
  });

  it('returns null on the fee payment confirmation route even when ?access_token= is present', () => {
    expect(
      extractAccessTokenForDownloadRoutes(
        makeRequest('/api/v1/fee-payments/payment-1/confirm', 'tok-1'),
      ),
    ).toBeNull();
  });

  it('returns null on a files route with no ?access_token= present', () => {
    expect(
      extractAccessTokenForDownloadRoutes(makeRequest('/api/v1/files/abc123')),
    ).toBeNull();
  });
});

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
    }).validate({
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
      make(row).validate({ sub: 'u1', role: 'SCHOOL_ADMIN', tv }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('accepts a pre-BL-21 token (no tv) while the version is still 0', async () => {
    await expect(
      make({ ...account, tokenVersion: 0 }).validate({
        sub: 'u1',
        role: 'SCHOOL_ADMIN',
      }),
    ).resolves.toMatchObject({ id: 'u1' });
  });

  it('does not end sessions for a failed-login lockout (lockedUntil is not selected)', async () => {
    const strategy = make(account);
    await strategy.validate({ sub: 'u1', role: 'SCHOOL_ADMIN', tv: 2 });
    const prisma = (
      strategy as unknown as { prisma: { user: { findUnique: jest.Mock } } }
    ).prisma;
    expect(prisma.user.findUnique.mock.calls[0][0].select).not.toHaveProperty(
      'lockedUntil',
    );
  });
});
