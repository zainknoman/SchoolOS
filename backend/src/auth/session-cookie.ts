import { ForbiddenException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { isAllowedOrigin } from '../config/cors.config';
import { REFRESH_TOKEN_TTL_DAYS } from './auth.constants';

/**
 * Cookie session for the staff console (BL-36 option B, owner decision 2026-09-28). The refresh
 * token lives in an HttpOnly cookie that page script cannot read, so an XSS bug can no longer
 * steal a 30-day session; the access token stays in the console's memory and is sent as a bearer
 * header exactly as before.
 *
 * A client opts in with `X-SchoolOS-Session: cookie` on login, refresh, logout and
 * change-password. The cookie is read ONLY when that header is present and the request's Origin
 * (when sent) is on the CORS allow-list. The header is not a "simple" header, so a cross-site page
 * cannot send it without a CORS preflight that the allow-list refuses — that, SameSite=Strict and
 * the Origin check are the CSRF defences. Clients without the header (the parent app) keep the
 * refresh token in the request/response body, unchanged.
 */
export const SESSION_COOKIE = '__Secure-schoolos-rt';
export const SESSION_MODE_HEADER = 'x-schoolos-session';
/** Sent only to the auth routes, never to the rest of the API. */
export const SESSION_COOKIE_PATH = '/api/v1/auth';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: SESSION_COOKIE_PATH,
} as const;

export function wantsCookieSession(req: Request): boolean {
  return req.headers[SESSION_MODE_HEADER] === 'cookie';
}

/** Refuses a cookie-mode request from an Origin outside the CORS allow-list. */
export function assertAllowedOrigin(req: Request): void {
  const origin = req.headers.origin;
  if (
    origin &&
    !isAllowedOrigin(origin, process.env.CORS_ORIGINS, process.env.NODE_ENV)
  ) {
    throw new ForbiddenException('Origin not allowed.');
  }
}

/** The session cookie's value, or null. No cookie-parser: this is the only cookie we read. */
export function readSessionCookie(req: Request): string | null {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === SESSION_COOKIE) {
      const value = decodeURIComponent(part.slice(eq + 1).trim());
      return value.length > 0 ? value : null;
    }
  }
  return null;
}

export function setSessionCookie(res: Response, refreshToken: string): void {
  res.cookie(SESSION_COOKIE, refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60_000,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, COOKIE_OPTIONS);
}
