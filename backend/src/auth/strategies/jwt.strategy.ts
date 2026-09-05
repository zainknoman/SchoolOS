import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';

export interface JwtPayload {
  sub: string;
  role: string;
}

// The ?access_token= fallback exists only so a plain download link — which can't set an
// Authorization header — still authenticates. That applies to the generic file download route
// (GET /api/v1/files/:id) as well as the fee voucher and fee receipt PDF routes
// (GET /api/v1/fee-vouchers/:id/pdf and GET /api/v1/fee-payments/:id/receipt.pdf), all of which
// are opened directly via <a href> or a system browser/PDF viewer rather than through an API
// client that can set headers.
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
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        extractAccessTokenForDownloadRoutes,
      ]),
      ignoreExpiration: false,
      secretOrKey:
        config.get<string>('JWT_ACCESS_SECRET') ?? 'dev-only-change-me-access',
    });
  }

  // Whatever this returns becomes `request.user` — kept to just {id, role}, nothing sensitive.
  validate(payload: JwtPayload) {
    return { id: payload.sub, role: payload.role };
  }
}
