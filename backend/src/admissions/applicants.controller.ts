// backend/src/admissions/applicants.controller.ts
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApplicantsService } from './applicants.service';
import { CreateApplicantDto } from './dto/create-applicant.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('api/v1/applicants')
@Roles('SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN')
export class ApplicantsController {
  constructor(private readonly applicantsService: ApplicantsService) {}

  @Post()
  create(@Body() dto: CreateApplicantDto) {
    return this.applicantsService.create(dto);
  }

  @Get()
  findByPhone(@Query('guardianPhone') guardianPhone: string) {
    return this.applicantsService.findByPhone(guardianPhone);
  }
}
