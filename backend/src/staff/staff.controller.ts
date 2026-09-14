import { Controller, Get, Query } from '@nestjs/common';
import { EmployeeType } from '@prisma/client';
import { StaffService } from './staff.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('api/v1/admin/staff')
@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  list(@Query('employeeType') employeeType?: EmployeeType) {
    return this.staffService.list(employeeType);
  }
}