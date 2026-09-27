import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import {
  assertAllowedOrigin,
  readSessionCookie,
  SESSION_COOKIE,
  wantsCookieSession,
} from './session-cookie';
import { buildCorsOptions, isAllowedOrigin } from '../config/cors.config';

function req(headers: Record<string, string>): Request {
  return { headers } as unknown as Request;
}

describe('session cookie (BL-36 option B)', () => {
  it('reads only the session cookie', () => {
    expect(
      readSessionCookie(req({ cookie: `a=1; ${SESSION_COOKIE}=tok%2Bx; b=2` })),
    ).toBe('tok+x');
    expect(readSessionCookie(req({ cookie: 'a=1' }))).toBeNull();
    expect(readSessionCookie(req({ cookie: `${SESSION_COOKIE}=` }))).toBeNull();
    expect(readSessionCookie(req({}))).toBeNull();
  });

  it('cookie mode needs the exact header value', () => {
    expect(wantsCookieSession(req({ 'x-schoolos-session': 'cookie' }))).toBe(
      true,
    );
    expect(wantsCookieSession(req({ 'x-schoolos-session': 'yes' }))).toBe(
      false,
    );
    expect(wantsCookieSession(req({}))).toBe(false);
  });

  it('refuses a foreign Origin and allows an allowed or absent one', () => {
    const saved = { ...process.env };
    process.env.CORS_ORIGINS = 'https://console.example.pk';
    process.env.NODE_ENV = 'production';
    try {
      expect(() =>
        assertAllowedOrigin(req({ origin: 'https://evil.example' })),
      ).toThrow(ForbiddenException);
      expect(() =>
        assertAllowedOrigin(req({ origin: 'https://console.example.pk' })),
      ).not.toThrow();
      expect(() => assertAllowedOrigin(req({}))).not.toThrow();
    } finally {
      process.env = saved;
    }
  });
});

describe('isAllowedOrigin / buildCorsOptions', () => {
  it('uses the allow-list, plus localhost only in development/test', () => {
    const list = 'https://console.example.pk';
    expect(
      isAllowedOrigin('https://console.example.pk', list, 'production'),
    ).toBe(true);
    expect(isAllowedOrigin('http://localhost:5173', list, 'production')).toBe(
      false,
    );
    expect(isAllowedOrigin('http://localhost:5173', list, 'development')).toBe(
      true,
    );
  });

  it('allows credentials with an exact origin allow-list', () => {
    const options = buildCorsOptions({
      CORS_ORIGINS: 'https://console.example.pk',
      NODE_ENV: 'production',
    });
    expect(options.credentials).toBe(true);
    expect(options.origin).toEqual(['https://console.example.pk']);
  });
});
