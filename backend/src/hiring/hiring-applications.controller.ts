import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { HiringApplicationsService } from './hiring-applications.service';
import { CreateHiringApplicationDto } from './dto/create-hiring-application.dto';
import { UpdateHiringApplicationDto } from './dto/update-hiring-application.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../common/student-access.service';
import { ApproveHiringApplicationDto } from './dto/approve-hiring-application.dto';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/hiring/applications')
@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
export class HiringApplicationsController {
  constructor(private readonly hiringApplicationsService: HiringApplicationsService) {}

  @Post()
  create(@Body() dto: CreateHiringApplicationDto) {
    return this.hiringApplicationsService.create(dto);
  }

  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Query('campusId') campusId?: string,
    @Query('status') status?: string,
  ) {
    return this.hiringApplicationsService.findMany(req.user, campusId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.hiringApplicationsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateHiringApplicationDto) {
    return this.hiringApplicationsService.updateStatus(id, dto);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body('decisionNotes') decisionNotes: string, @Req() req: AuthenticatedRequest) {
    return this.hiringApplicationsService.reject(id, decisionNotes, req.user.id);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() dto: ApproveHiringApplicationDto, @Req() req: AuthenticatedRequest) {
    return this.hiringApplicationsService.approve(id, dto, req.user.id);
  }
}