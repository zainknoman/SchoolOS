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

  @Roles('SCHOOL_ADMIN', 'ACCOUNTS')
  @Get('operations-summary')
  getOperationsSummary(@Req() req: AuthenticatedRequest) {
    return this.dashboardService.getOperationsSummary(req.user);
  }

  @Roles('SUPER_ADMIN')
  @Get('network-overview')
  getNetworkOverview() {
    return this.dashboardService.getNetworkOverview();
  }

  // Gated on SCHOOL_ADMIN here; the service itself enforces the isPrincipal flag, since a
  // Principal is a SCHOOL_ADMIN user with that flag set, not a distinct Role.
  @Roles('SCHOOL_ADMIN')
  @Get('principal-academics-summary')
  getPrincipalAcademicsSummary(@Req() req: AuthenticatedRequest) {
    return this.dashboardService.getPrincipalAcademicsSummary(req.user);
  }
}
