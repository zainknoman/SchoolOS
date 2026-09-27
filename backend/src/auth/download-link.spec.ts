import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  extractDownloadLinkToken,
  isDownloadRoute,
  resolveDownloadLinkSecret,
} from './download-link';

function req(
  path: string,
  query: Record<string, unknown>,
  method = 'GET',
): Request {
  return { path, query, method } as unknown as Request;
}

describe('isDownloadRoute (BL-36)', () => {
  it.each([
    '/api/v1/files/0b9e5c1e-1f2a-4c3b-9d8e-7f6a5b4c3d2e',
    '/api/v1/fee-vouchers/abc/pdf',
    '/api/v1/fee-payments/abc/receipt.pdf',
    '/api/v1/report-cards/abc/pdf',
    '/api/v1/report-cards/generated/abc/pdf',
  ])('accepts %s', (path) => {
    expect(isDownloadRoute(path)).toBe(true);
  });

  it.each([
    '/api/v1/me',
    '/api/v1/fee-vouchers/abc/pay',
    '/api/v1/fee-payments/abc/confirm',
    '/api/v1/report-cards/generated/abc',
    '/api/v1/files/..',
    '/api/v1/files/a/../../me',
    'https://evil.example/api/v1/files/abc',
  ])('rejects %s', (path) => {
    expect(isDownloadRoute(path)).toBe(false);
  });
});

describe('extractDownloadLinkToken (BL-36, KG-15)', () => {
  it('reads ?dl= on a GET download route', () => {
    expect(
      extractDownloadLinkToken(req('/api/v1/files/abc', { dl: 't' })),
    ).toBe('t');
  });

  it('never reads ?access_token=', () => {
    expect(
      extractDownloadLinkToken(req('/api/v1/files/abc', { access_token: 't' })),
    ).toBeNull();
  });

  it('ignores ?dl= off a download route and on a non-GET request', () => {
    expect(extractDownloadLinkToken(req('/api/v1/me', { dl: 't' }))).toBeNull();
    expect(
      extractDownloadLinkToken(req('/api/v1/files/abc', { dl: 't' }, 'POST')),
    ).toBeNull();
  });

  it('ignores a repeated ?dl= (an array, not a string)', () => {
    expect(
      extractDownloadLinkToken(req('/api/v1/files/abc', { dl: ['a', 'b'] })),
    ).toBeNull();
  });
});

describe('resolveDownloadLinkSecret', () => {
  it('is derived from, and differs from, the access secret', () => {
    const config = (secret: string) =>
      ({
        get: (k: string) => (k === 'JWT_ACCESS_SECRET' ? secret : 'test'),
      }) as unknown as ConfigService;
    const a = resolveDownloadLinkSecret(config('secret-a'));
    expect(a).not.toBe('secret-a');
    expect(a).toBe(resolveDownloadLinkSecret(config('secret-a')));
    expect(a).not.toBe(resolveDownloadLinkSecret(config('secret-b')));
  });
});
