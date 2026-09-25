import { PageQueryDto, toPageRequest } from '../common/pagination';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RecordScopeGuard, ScopedRecord } from '../common/record-scope.guard';
import { ArchiveRecordDto } from '../common/dto/archive-record.dto';
import type { Request } from 'express';
import { EmployeeType } from '@prisma/client';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/admin/staff')
@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
@UseGuards(RecordScopeGuard)
@ScopedRecord('staff', 'id')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  list(
    @Query('employeeType') employeeType: EmployeeType | undefined,
    @Req() req: AuthenticatedRequest,
    @Query() page: PageQueryDto,
    @Query('archived') archived?: string,
  ) {
    return this.staffService.list(
      req.user,
      employeeType,
      toPageRequest(page),
      archived === 'true',
    );
  }

  @Post()
  create(@Body() dto: CreateStaffDto, @Req() req: AuthenticatedRequest) {
    return this.staffService.create(dto, req.user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.staffService.update(id, dto, req.user);
  }

  /** BL-07: archives (never hard-deletes); kept for the existing clients. */
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Query('reason') reason?: string,
  ) {
    await this.staffService.archive(id, req.user, reason);
  }

  @Post(':id/archive')
  archive(
    @Param('id') id: string,
    @Body() dto: ArchiveRecordDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.staffService.archive(id, req.user, dto.reason);
  }

  @Post(':id/unarchive')
  @HttpCode(204)
  async unarchive(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.staffService.unarchive(id, req.user);
  }

  @Post(':id/erase')
  @Roles('SUPER_ADMIN')
  @HttpCode(204)
  async erase(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.staffService.erase(id, req.user);
  }
}
