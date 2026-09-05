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
// as well as the fee voucher and fee receipt PDF routes, all of which are opened directly via
// <a href> or a system browser/PDF viewer rather than through an API client that can set headers.
// Scoped to just these download routes so a bearer token isn't also accepted via query string —
// and therefore leakable through server access logs, browser history, or Referer headers — on
// every other endpoint too.
const DOWNLOAD_ROUTE_PREFIXES = [
  '/api/v1/files/',
  '/api/v1/fee-vouchers/',
  '/api/v1/fee-payments/',
];

export function extractAccessTokenForDownloadRoutes(
  req: Request,
): string | null {
  if (!DOWNLOAD_ROUTE_PREFIXES.some((prefix) => req.path.startsWith(prefix))) {
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
