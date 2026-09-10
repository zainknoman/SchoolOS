import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { MeService } from './me.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: string };
}

@Controller('api/v1/me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  me(@Req() req: AuthenticatedRequest) {
    return { id: req.user.id, role: req.user.role };
  }

  @Get('children')
  children(@Req() req: AuthenticatedRequest) {
    return this.meService.getChildrenForUser(req.user.id);
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
}
