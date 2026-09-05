import type { Request } from 'express';
import { extractAccessTokenForFilesRoute } from './jwt.strategy';

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

describe('extractAccessTokenForFilesRoute', () => {
  it('extracts ?access_token= on a files download route', () => {
    expect(
      extractAccessTokenForFilesRoute(
        makeRequest('/api/v1/files/abc123', 'tok-1'),
      ),
    ).toBe('tok-1');
  });

  it('returns null on a non-files route even when ?access_token= is present', () => {
    expect(
      extractAccessTokenForFilesRoute(
        makeRequest('/api/v1/me/children', 'tok-1'),
      ),
    ).toBeNull();
  });

  it('returns null on a files route with no ?access_token= present', () => {
    expect(
      extractAccessTokenForFilesRoute(makeRequest('/api/v1/files/abc123')),
    ).toBeNull();
  });
});
