import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeIdentifier } from '../common/normalize-identifier';
import { MAIL_ADAPTER } from '../notifications/mail-adapter';
import type { MailAdapter } from '../notifications/mail-adapter';
import {
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MINUTES,
  REFRESH_TOKEN_TTL_DAYS,
  GENERIC_AUTH_ERROR,
  ACCOUNT_LOCKED_ERROR,
  ACCOUNT_DISABLED_ERROR,
  SESSION_ENDED_ERROR,
  PASSWORD_RESET_TOKEN_TTL_HOURS,
  RESET_PASSWORD_GENERIC_ERROR,
} from './auth.constants';

export type SessionResult = {
  accessToken: string;
  refreshToken: string;
  role: string;
  isPrincipal: boolean;
  mustChangePassword: boolean;
  campusId: string | null;
  schoolId: string | null;
  /** BL-32 module grants (ACCOUNTS only) — lets the console hide modules it may not open. */
  grants: string[];
};

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(MAIL_ADAPTER) private readonly mail: MailAdapter,
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
    // Exact match first (staff/admin identifiers are stored as typed); then the canonical form, so
    // a parent can sign in with "+92 300 1234567" or "Ali@Mail.com" however they type it.
    const user =
      (await this.prisma.user.findUnique({ where: { identifier } })) ??
      (await this.prisma.user.findUnique({
        where: { identifier: normalizeIdentifier(identifier) },
      }));

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

    // A disabled account (BL-21) is refused only AFTER the password checks out, so the response
    // never reveals whether an identifier exists.
    if (user.isLocked) {
      throw new UnauthorizedException(ACCOUNT_DISABLED_ERROR);
    }

    // Successful login resets the failure counter and any stale lock.
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });

    return this.issueSession(user);
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
    // A disabled account cannot extend its session (BL-21).
    if (user.isLocked) {
      throw new UnauthorizedException(SESSION_ENDED_ERROR);
    }

    return this.issueSession(user);
  }

  /**
   * Ends ONE session: revokes the presented refresh token. Public on purpose (the access token may
   * already be expired when a user signs out) and always resolves, so it reveals nothing about the
   * token. The short-lived access token is discarded by the client; use logoutAll to kill those.
   */
  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Ends EVERY session of the user, on every device: all refresh tokens are revoked and
   * `tokenVersion` is bumped, so every access token already issued is rejected on its next request
   * (BL-21). Also used by admin revoke/disable (AccountAccessService).
   */
  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.revokeAllSessions(userId);
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'auth.logout-all',
        entity: 'User',
        entityId: userId,
      },
    });
  }

  /**
   * Always resolves normally, whether or not `identifier` matches a real account — the caller
   * can't distinguish the two branches (standard user-enumeration defense).
   */
  async forgotPassword(identifier: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { identifier } });
    if (!user) {
      return;
    }

    const token = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(
          Date.now() + PASSWORD_RESET_TOKEN_TTL_HOURS * 60 * 60_000,
        ),
      },
    });

    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;
    try {
      await this.mail.send(
        user.identifier,
        'Reset your SchoolOS password',
        `Use this link to reset your password (expires in ${PASSWORD_RESET_TOKEN_TTL_HOURS} hour): ${resetLink}`,
      );
    } catch (err) {
      // Best-effort, same as NotificationsService.notify() — a delivery failure must never leak
      // through to the caller (who already sees the same generic response either way). Only the
      // error's name/message is logged, never the error object, which may echo the message (BL-51).
      console.error(
        'Password reset email delivery failed:',
        err instanceof Error ? `${err.name}: ${err.message}` : 'unknown error',
      );
    }
  }

  /**
   * A successful reset ends every existing session for this user (every RefreshToken row is
   * revoked), not just the request that performed the reset.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(token);
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.usedAt || stored.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException(RESET_PASSWORD_GENERIC_ERROR);
    }

    const passwordHash = await argon2.hash(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: {
          passwordHash,
          mustChangePassword: false,
          tokenVersion: { increment: 1 },
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  /**
   * Authenticated password change. Ends every existing session (all active refresh tokens are
   * revoked) and returns a fresh one so the calling client keeps working. Clears the
   * provisioned-account `mustChangePassword` flag.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<SessionResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await argon2.verify(user.passwordHash, currentPassword))) {
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'New password must differ from the current password.',
      );
    }

    const passwordHash = await argon2.hash(newPassword);
    // Bumping tokenVersion ends every other device's access token too; the fresh session below
    // carries the new version, so the calling client keeps working.
    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          mustChangePassword: false,
          tokenVersion: { increment: 1 },
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return this.issueSession(updated);
  }

  private async issueSession(user: {
    id: string;
    role: string;
    isPrincipal: boolean;
    mustChangePassword: boolean;
    campusId: string | null;
    schoolId: string | null;
    tokenVersion: number;
    grants?: string[];
  }): Promise<SessionResult> {
    const {
      id: userId,
      role,
      isPrincipal,
      mustChangePassword,
      campusId,
      schoolId,
    } = user;
    // `tv` lets JwtStrategy reject this token once the user's sessions are revoked (BL-21).
    const accessToken = this.jwt.sign({
      sub: userId,
      role,
      tv: user.tokenVersion,
    });

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

    return {
      accessToken,
      refreshToken,
      role,
      isPrincipal,
      mustChangePassword,
      campusId,
      schoolId,
      grants: user.grants ?? [],
    };
  }
}
