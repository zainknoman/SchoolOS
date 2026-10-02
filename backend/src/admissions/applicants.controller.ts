// backend/src/admissions/applicants.controller.ts
import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import type { RequestUser } from '../common/student-access.service';
import { ApplicantsService } from './applicants.service';
import { CreateApplicantDto } from './dto/create-applicant.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresGrant } from '../auth/decorators/requires-grant.decorator';
import { ScopeCheck } from '../common/scope-check.decorator';

@Controller('api/v1/applicants')
@Roles('SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN')
@RequiresGrant('ADMISSIONS')
export class ApplicantsController {
  constructor(private readonly applicantsService: ApplicantsService) {}

  @ScopeCheck('visibleTo')
  @Post()
  create(@Body() dto: CreateApplicantDto, @Req() req: { user: RequestUser }) {
    return this.applicantsService.create(dto, req.user);
  }

  @ScopeCheck('visibleTo')
  @Get()
  findByPhone(
    @Query('guardianPhone') guardianPhone: string,
    @Req() req: { user: RequestUser },
  ) {
    return this.applicantsService.findByPhone(guardianPhone, req.user);
  }
}
