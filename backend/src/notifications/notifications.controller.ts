import { Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { NotificationsService } from './notifications.service';
import { RequestUser } from '../common/student-access.service';
import { ScopeCheck, SELF } from '../common/scope-check.decorator';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.listForUser(req.user.id);
  }

  @ScopeCheck(SELF)
  @Post(':id/read')
  markRead(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.notificationsService.markRead(id, req.user.id);
  }

  @Post('read-all')
  markAllRead(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.markAllRead(req.user.id);
  }
}
