import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { EmployeeType } from '@prisma/client';
import { StaffService } from './staff.service';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/admin/staff')
@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  list(@Query('employeeType') employeeType: EmployeeType | undefined, @Req() req: AuthenticatedRequest) {
    return this.staffService.list(req.user, employeeType);
  }
}