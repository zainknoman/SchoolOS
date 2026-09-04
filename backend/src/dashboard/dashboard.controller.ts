import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('api/v1/admin')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Roles('SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN')
  @Get('dashboard-summary')
  getSummary() {
    return this.dashboardService.getSummary();
  }
}
