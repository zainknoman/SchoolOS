// backend/src/admissions/applications.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { ApproveApplicationDto } from './dto/approve-application.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/applications')
@Roles('SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  create(@Body() dto: CreateApplicationDto) {
    return this.applicationsService.create(dto);
  }

  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Query('academicSessionId') academicSessionId?: string,
    @Query('status') status?: string,
  ) {
    return this.applicationsService.findMany(
      req.user,
      academicSessionId,
      status,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.applicationsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateApplicationDto) {
    return this.applicationsService.updateStatus(id, dto);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body('decisionNotes') decisionNotes: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.applicationsService.reject(id, decisionNotes, req.user.id);
  }

  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveApplicationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.applicationsService.approve(id, dto, req.user.id);
  }
}
