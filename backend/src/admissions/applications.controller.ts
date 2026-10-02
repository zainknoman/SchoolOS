// backend/src/admissions/applications.controller.ts
import { PageQueryDto, toPageRequest } from '../common/pagination';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RecordScopeGuard, ScopedRecord } from '../common/record-scope.guard';
import type { Request } from 'express';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { ApproveApplicationDto } from './dto/approve-application.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresGrant } from '../auth/decorators/requires-grant.decorator';
import type { RequestUser } from '../common/student-access.service';
import { ScopeCheck } from '../common/scope-check.decorator';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

// KG-16: every route addressed by :id is confined to the desired class's school/campus.
@Controller('api/v1/applications')
@Roles('SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN')
@RequiresGrant('ADMISSIONS')
@UseGuards(RecordScopeGuard)
@ScopedRecord('admissionApplication', 'id')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @ScopeCheck('orgScope.resolve')
  @Post()
  create(@Body() dto: CreateApplicationDto, @Req() req: AuthenticatedRequest) {
    return this.applicationsService.create(dto, req.user);
  }

  @ScopeCheck('orgScope.resolve')
  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Query('academicSessionId') academicSessionId?: string,
    @Query('status') status?: string,
    @Query() page?: PageQueryDto,
  ) {
    return this.applicationsService.findMany(
      req.user,
      academicSessionId,
      status,
      toPageRequest(page),
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
    return this.applicationsService.approve(id, dto, req.user);
  }
}
