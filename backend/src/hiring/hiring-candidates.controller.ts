import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { HiringCandidatesService } from './hiring-candidates.service';
import { CreateHiringCandidateDto } from './dto/create-hiring-candidate.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('api/v1/hiring/candidates')
@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
export class HiringCandidatesController {
  constructor(private readonly hiringCandidatesService: HiringCandidatesService) {}

  @Post()
  create(@Body() dto: CreateHiringCandidateDto) {
    return this.hiringCandidatesService.create(dto);
  }

  @Get()
  findByPhone(@Query('contactPhone') contactPhone: string) {
    return this.hiringCandidatesService.findByPhone(contactPhone);
  }
}