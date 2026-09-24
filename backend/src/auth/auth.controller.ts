import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from './decorators/public.decorator';
import { AllowPendingPasswordChange } from './decorators/allow-pending-password-change.decorator';
import { Throttle } from '@nestjs/throttler';
import {
  AUTH_LOGIN_THROTTLE_LIMIT,
  THROTTLE_TTL_MS,
} from '../config/throttler.config';
import { FORGOT_PASSWORD_GENERIC_MESSAGE } from './auth.constants';

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
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.identifier, dto.password);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  // Ends this session (BL-21). Public so a client whose access token already expired can still
  // sign out; it only revokes the presented refresh token and reveals nothing about it.
  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  // Ends every session of the caller on every device, including live access tokens (BL-21).
  @AllowPendingPasswordChange()
  @HttpCode(204)
  @Post('logout-all')
  async logoutAll(@Req() req: { user: { id: string } }): Promise<void> {
    await this.authService.logoutAll(req.user.id);
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

  // Authenticated (global JWT guard, no @Public). A wrong-current-password endpoint is an online
  // guessing surface for a stolen access token, so it gets the same throttle as login.
  @Throttle({
    default: {
      limit: AUTH_LOGIN_THROTTLE_LIMIT,
      ttl: THROTTLE_TTL_MS,
    },
  })
  @AllowPendingPasswordChange()
  @Post('change-password')
  async changePassword(
    @Req() req: { user: { id: string } },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      req.user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
