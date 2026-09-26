import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { resolveAccessTokenSecret } from '../jwt-secret';
import { PrismaService } from '../../prisma/prisma.service';
import { SESSION_ENDED_ERROR } from '../auth.constants';

export interface JwtPayload {
  sub: string;
  role: string;
  /** User.tokenVersion at issue time; absent on tokens issued before BL-21 (treated as 0). */
  tv?: number;
}

/** What the strategy puts on `request.user`. */
export interface AuthenticatedUser {
  id: string;
  role: string;
  mustChangePassword: boolean;
  /** BL-32 module grants (only consulted for ACCOUNTS). */
  grants: string[];
}

// The ?access_token= fallback exists only so a plain download link — which can't set an
// Authorization header — still authenticates. That applies to the generic file download route
// (GET /api/v1/files/:id), the fee voucher and fee receipt PDF routes
// (GET /api/v1/fee-vouchers/:id/pdf and GET /api/v1/fee-payments/:id/receipt.pdf), and the
// report card PDF route (GET /api/v1/report-cards/:id/pdf), all of which are opened directly via
// <a href> or a system browser/PDF viewer rather than through an API client that can set headers.
//
// Matched by exact route shape, not by resource-path prefix: /api/v1/fee-vouchers/ and
// /api/v1/fee-payments/ also carry POST mutation endpoints (:id/pay, :id/confirm) that are
// driven by normal API clients capable of setting an Authorization header, so a bearer token
// must not be accepted via query string there — or on any other endpoint — since a query-string
// token is leakable through server access logs, browser history, and Referer headers in a way a
// header is not.
const DOWNLOAD_ROUTE_PATTERNS = [
  /^\/api\/v1\/files\/[^/]+$/,
  /^\/api\/v1\/fee-vouchers\/[^/]+\/pdf$/,
  /^\/api\/v1\/fee-payments\/[^/]+\/receipt\.pdf$/,
  /^\/api\/v1\/report-cards\/[^/]+\/pdf$/,
  // BL-06: a generated report card's PDF
  /^\/api\/v1\/report-cards\/generated\/[^/]+\/pdf$/,
];

export function extractAccessTokenForDownloadRoutes(
  req: Request,
): string | null {
  if (!DOWNLOAD_ROUTE_PATTERNS.some((pattern) => pattern.test(req.path))) {
    return null;
  }
  return ExtractJwt.fromUrlQueryParameter('access_token')(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        extractAccessTokenForDownloadRoutes,
      ]),
      ignoreExpiration: false,
      secretOrKey: resolveAccessTokenSecret(config),
    });
  }

  /**
   * Re-checks the account on EVERY request (BL-21, KG-10): a deleted or disabled (`isLocked`)
   * user, or a token issued before the user's sessions were revoked (`tokenVersion` bumped by
   * logout-all, disable or a password change), is rejected on the next request instead of when
   * the 15-minute token expires. The role comes from the database, so a role change is immediate.
   * The failed-login lockout (`lockedUntil`) deliberately does NOT end live sessions — otherwise
   * anyone could log a user out by guessing wrong passwords.
   * Whatever this returns becomes `request.user` — nothing sensitive.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        isLocked: true,
        tokenVersion: true,
        mustChangePassword: true,
        grants: true,
      },
    });
    if (!user || user.isLocked || (payload.tv ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException(SESSION_ENDED_ERROR);
    }
    return {
      id: user.id,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      grants: user.grants,
    };
  }
}
