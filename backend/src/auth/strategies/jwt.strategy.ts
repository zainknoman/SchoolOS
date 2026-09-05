import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';

export interface JwtPayload {
  sub: string;
  role: string;
}

// The ?access_token= fallback exists only so a direct file-download link (which can't set an
// Authorization header) still authenticates. Scoped to the files route so a bearer token isn't
// also accepted via query string — and therefore leakable through server access logs, browser
// history, or Referer headers — on every other endpoint too.
export function extractAccessTokenForFilesRoute(req: Request): string | null {
  if (!req.path.startsWith('/api/v1/files/')) {
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
        extractAccessTokenForFilesRoute,
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
