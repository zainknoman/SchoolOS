import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, type SessionResult } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DownloadLinkDto } from './dto/download-link.dto';
import { Public } from './decorators/public.decorator';
import { AllowPendingPasswordChange } from './decorators/allow-pending-password-change.decorator';
import { Throttle } from '@nestjs/throttler';
import {
  AUTH_LOGIN_THROTTLE_LIMIT,
  THROTTLE_TTL_MS,
} from '../config/throttler.config';
import {
  FORGOT_PASSWORD_GENERIC_MESSAGE,
  GENERIC_AUTH_ERROR,
} from './auth.constants';
import {
  assertAllowedOrigin,
  clearSessionCookie,
  readSessionCookie,
  setSessionCookie,
  wantsCookieSession,
} from './session-cookie';
import { ScopeCheck, SELF } from '../common/scope-check.decorator';

/** The session as the client receives it: without the refresh token in cookie mode. */
type DeliveredSession = Omit<SessionResult, 'refreshToken'> & {
  refreshToken?: string;
};

/**
 * BL-36 option B: in cookie mode the refresh token goes into the HttpOnly cookie and is left out
 * of the body; otherwise (the parent app) the body carries it as before.
 */
function deliverSession(
  req: Request,
  res: Response,
  session: SessionResult,
): DeliveredSession {
  if (!wantsCookieSession(req)) return session;
  setSessionCookie(res, session.refreshToken);
  const body: DeliveredSession = { ...session };
  delete body.refreshToken;
  return body;
}

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({
    default: {
      limit: AUTH_LOGIN_THROTTLE_LIMIT,
      ttl: THROTTLE_TTL_MS,
    },
  })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (wantsCookieSession(req)) assertAllowedOrigin(req);
    const session = await this.authService.login(dto.identifier, dto.password);
    return deliverSession(req, res, session);
  }

  // Body token (parent app), or — in cookie mode — the HttpOnly cookie. A cookie-mode call may
  // also send a body token once: that moves a pre-BL-36 console session into the cookie.
  @Public()
  @Post('refresh')
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieMode = wantsCookieSession(req);
    if (cookieMode) assertAllowedOrigin(req);
    const token =
      dto.refreshToken ?? (cookieMode ? readSessionCookie(req) : null);
    if (!token) {
      if (cookieMode) throw new UnauthorizedException(GENERIC_AUTH_ERROR);
      throw new BadRequestException('refreshToken is required.');
    }
    try {
      return deliverSession(req, res, await this.authService.refresh(token));
    } catch (err) {
      // A dead cookie is removed so the console stops presenting it.
      if (cookieMode) clearSessionCookie(res);
      throw err;
    }
  }

  // Ends this session (BL-21). Public so a client whose access token already expired can still
  // sign out; it only revokes the presented refresh token and reveals nothing about it.
  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const cookieMode = wantsCookieSession(req);
    if (cookieMode) assertAllowedOrigin(req);
    const token =
      dto.refreshToken ?? (cookieMode ? readSessionCookie(req) : null);
    if (!token && !cookieMode) {
      throw new BadRequestException('refreshToken is required.');
    }
    if (token) await this.authService.logout(token);
    if (cookieMode) clearSessionCookie(res);
  }

  // Ends every session of the caller on every device, including live access tokens (BL-21).
  @AllowPendingPasswordChange()
  @HttpCode(204)
  @Post('logout-all')
  async logoutAll(@Req() req: { user: { id: string } }): Promise<void> {
    await this.authService.logoutAll(req.user.id);
  }

  // BL-36 / KG-15: a short-lived link to one download route, for a client that opens it without
  // an Authorization header (the parent app's system browser). Bearer-authenticated.
  @ScopeCheck(SELF)
  @Post('download-link')
  async downloadLink(
    @Req() req: { user: { id: string } },
    @Body() dto: DownloadLinkDto,
  ) {
    return this.authService.createDownloadLink(req.user.id, dto.path);
  }

  // Unauthenticated and enumerable, same as login — throttled at least as strictly.
  @Public()
  @Throttle({
    default: {
      limit: AUTH_LOGIN_THROTTLE_LIMIT,
      ttl: THROTTLE_TTL_MS,
    },
  })
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.identifier);
    return { message: FORGOT_PASSWORD_GENERIC_MESSAGE };
  }

  @Public()
  @Throttle({
    default: {
      limit: AUTH_LOGIN_THROTTLE_LIMIT,
      ttl: THROTTLE_TTL_MS,
    },
  })
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Your password has been reset. Please log in again.' };
  }

  // BL-35: the parent app's own reset flow (separate token audience and link).
  @Public()
  @Throttle({
    default: {
      limit: AUTH_LOGIN_THROTTLE_LIMIT,
      ttl: THROTTLE_TTL_MS,
    },
  })
  @Post('parent/forgot-password')
  async forgotParentPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotParentPassword(dto.identifier);
    return { message: FORGOT_PASSWORD_GENERIC_MESSAGE };
  }

  @Public()
  @Throttle({
    default: {
      limit: AUTH_LOGIN_THROTTLE_LIMIT,
      ttl: THROTTLE_TTL_MS,
    },
  })
  @Post('parent/reset-password')
  async resetParentPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetParentPassword(dto.token, dto.newPassword);
    return { message: 'Your password has been reset. Please log in again.' };
  }

  // Authenticated (global JWT guard, no @Public). A wrong-current-password endpoint is an online
  // guessing surface for a stolen access token, so it gets the same throttle as login.
  @Throttle({
    default: {
      limit: AUTH_LOGIN_THROTTLE_LIMIT,
      ttl: THROTTLE_TTL_MS,
    },
  })
  @AllowPendingPasswordChange()
  @ScopeCheck(SELF)
  @Post('change-password')
  async changePassword(
    @Req() req: Request & { user: { id: string } },
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (wantsCookieSession(req)) assertAllowedOrigin(req);
    const session = await this.authService.changePassword(
      req.user.id,
      dto.currentPassword,
      dto.newPassword,
    );
    return deliverSession(req, res, session);
  }
}
