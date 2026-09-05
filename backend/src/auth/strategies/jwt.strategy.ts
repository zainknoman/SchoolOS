import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      // Header is tried first; ?access_token= is a fallback so a direct file-download link
      // (which can't set headers) still authenticates.
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter('access_token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET') ?? 'dev-only-change-me-access',
    });
  }

  // Whatever this returns becomes `request.user` — kept to just {id, role}, nothing sensitive.
  validate(payload: JwtPayload) {
    return { id: payload.sub, role: payload.role };
  }
}
