import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { resolveAccessTokenSecret } from '../jwt-secret';
import {
  DOWNLOAD_LINK_TOKEN_TYPE,
  extractDownloadLinkToken,
  resolveDownloadLinkSecret,
} from '../download-link';
import { PrismaService } from '../../prisma/prisma.service';
import { SESSION_ENDED_ERROR } from '../auth.constants';

export interface JwtPayload {
  sub: string;
  role: string;
  /** User.tokenVersion at issue time; absent on tokens issued before BL-21 (treated as 0). */
  tv?: number;
  /** BL-36: `dl` on a download-link token, absent on an access token. */
  typ?: string;
  /** BL-36: the one path a download-link token opens. */
  path?: string;
}

/** What the strategy puts on `request.user`. */
export interface AuthenticatedUser {
  id: string;
  role: string;
  mustChangePassword: boolean;
  /** BL-32 module grants (only consulted for ACCOUNTS). */
  grants: string[];
}

const fromBearerHeader = ExtractJwt.fromAuthHeaderAsBearerToken();

/** Where the token came from: the Authorization header wins over a download link. */
function tokenSource(req: Request): 'header' | 'download-link' {
  return fromBearerHeader(req) ? 'header' : 'download-link';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const accessSecret = resolveAccessTokenSecret(config);
    const downloadLinkSecret = resolveDownloadLinkSecret(config);
    // BL-36 / KG-15: an access token is accepted ONLY from the Authorization header — never from a
    // query string. The one query parameter read is a download link's ?dl= token, verified with
    // its own derived key, so neither kind of token verifies in the other's place.
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        fromBearerHeader,
        extractDownloadLinkToken,
      ]),
      ignoreExpiration: false,
      secretOrKeyProvider: (
        req: Request,
        _rawJwt: string,
        done: (err: Error | null, secret?: string) => void,
      ) =>
        done(
          null,
          tokenSource(req) === 'header' ? accessSecret : downloadLinkSecret,
        ),
      passReqToCallback: true,
    });
  }

  /**
   * Re-checks the account on EVERY request (BL-21, KG-10): a deleted or disabled (`isLocked`)
   * user, or a token issued before the user's sessions were revoked (`tokenVersion` bumped by
   * logout-all, disable or a password change), is rejected on the next request instead of when
   * the 15-minute token expires. The role comes from the database, so a role change is immediate.
   * The failed-login lockout (`lockedUntil`) deliberately does NOT end live sessions — otherwise
   * anyone could log a user out by guessing wrong passwords.
   * A download link (BL-36) gets the same recheck, so revoking sessions also kills its links.
   * Whatever this returns becomes `request.user` — nothing sensitive.
   */
  async validate(
    req: Request,
    payload: JwtPayload,
  ): Promise<AuthenticatedUser> {
    const isLink = payload.typ === DOWNLOAD_LINK_TOKEN_TYPE;
    // Belt and braces on top of the separate keys: a link token only via ?dl= and only for the
    // path it was minted for; an access token only via the header.
    if (
      isLink !== (tokenSource(req) === 'download-link') ||
      (isLink && payload.path !== req.path)
    ) {
      throw new UnauthorizedException(SESSION_ENDED_ERROR);
    }
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
