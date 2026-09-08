import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MINUTES,
  REFRESH_TOKEN_TTL_DAYS,
  GENERIC_AUTH_ERROR,
  ACCOUNT_LOCKED_ERROR,
} from './auth.constants';

export type SessionResult = {
  accessToken: string;
  refreshToken: string;
  role: string;
};

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Server is the only source of truth on roles — a caller passing a role token that isn't in
   * `allowed` is rejected here, never by a frontend hiding a button.
   */
  assertRole(role: string, allowed: string[]): void {
    if (!allowed.includes(role)) {
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }
  }

  async login(identifier: string, password: string): Promise<SessionResult> {
    const user = await this.prisma.user.findUnique({ where: { identifier } });

    // Unknown identifier and wrong password return the exact same error — never reveal which
    // field was wrong (FEAT-002 acceptance criteria).
    if (!user) {
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException(ACCOUNT_LOCKED_ERROR);
    }

    const passwordOk = await argon2.verify(user.passwordHash, password);

    if (!passwordOk) {
      const failedLoginCount = user.failedLoginCount + 1;
      const isLockingNow = failedLoginCount >= MAX_FAILED_ATTEMPTS;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: isLockingNow
            ? MAX_FAILED_ATTEMPTS
            : failedLoginCount,
          lockedUntil: isLockingNow
            ? new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60_000)
            : user.lockedUntil,
        },
      });

      throw new UnauthorizedException(
        isLockingNow ? ACCOUNT_LOCKED_ERROR : GENERIC_AUTH_ERROR,
      );
    }

    // Successful login resets the failure counter and any stale lock.
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });

    return this.issueSession(user.id, user.role);
  }

  async refresh(refreshToken: string): Promise<SessionResult> {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    // Rotation-on-use: revoke the presented token immediately, so a replayed copy of it (e.g.
    // from a stolen log or a slow network retry racing a legitimate refresh) is rejected by the
    // check above the next time anyone tries to use it — even though the legitimate caller
    // already received a fresh pair below.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
    });
    if (!user) {
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    return this.issueSession(user.id, user.role);
  }

  private async issueSession(
    userId: string,
    role: string,
  ): Promise<SessionResult> {
    const accessToken = this.jwt.sign({ sub: userId, role });

    const refreshToken = randomBytes(32).toString('hex');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(
          Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60_000,
        ),
      },
    });

    return { accessToken, refreshToken, role };
  }
}
