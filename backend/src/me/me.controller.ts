import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { UpdateChildDto } from './dto/update-child.dto';
import type { Request } from 'express';
import { MeService } from './me.service';
import { AllowPendingPasswordChange } from '../auth/decorators/allow-pending-password-change.decorator';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: string };
}

@Controller('api/v1/me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  // Identity only — reachable while a password change is pending (BL-21).
  @AllowPendingPasswordChange()
  @Get()
  me(@Req() req: AuthenticatedRequest) {
    return { id: req.user.id, role: req.user.role };
  }

  @Get('children')
  children(@Req() req: AuthenticatedRequest) {
    return this.meService.getChildrenForUser(req.user.id);
  }

  @Get('children/:studentId')
  childDetail(
    @Param('studentId') studentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.meService.getChildDetail(req.user.id, studentId);
  }

  @Patch('children/:studentId')
  updateChild(
    @Param('studentId') studentId: string,
    @Body() dto: UpdateChildDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.meService.updateChild(req.user.id, studentId, dto);
  }

  @Post('device-tokens')
  registerDeviceToken(
    @Body() dto: RegisterDeviceTokenDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.meService.registerDeviceToken(
      req.user.id,
      dto.token,
      dto.platform,
    );
  }

  @Patch('notification-preferences')
  updateNotificationPreferences(
    @Body() dto: UpdateNotificationPreferencesDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.meService.updateNotificationPreferences(req.user.id, dto);
  }
}
