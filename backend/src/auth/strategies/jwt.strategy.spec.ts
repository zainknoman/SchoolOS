import type { Request } from 'express';
import { extractAccessTokenForDownloadRoutes } from './jwt.strategy';

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

  it('returns null on a non-download route even when ?access_token= is present', () => {
    expect(
      extractAccessTokenForDownloadRoutes(
        makeRequest('/api/v1/me/children', 'tok-1'),
      ),
    ).toBeNull();
  });

  it('returns null on a files route with no ?access_token= present', () => {
    expect(
      extractAccessTokenForDownloadRoutes(makeRequest('/api/v1/files/abc123')),
    ).toBeNull();
  });
});
