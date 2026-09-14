import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { DashboardService } from './dashboard.service';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/admin')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Roles('SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN')
  @Get('dashboard-summary')
  getSummary(@Req() req: AuthenticatedRequest) {
    return this.dashboardService.getSummary(req.user);
  }
}
