import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import type { RequestUser } from '../common/student-access.service';
import { HiringCandidatesService } from './hiring-candidates.service';
import { CreateHiringCandidateDto } from './dto/create-hiring-candidate.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { ScopeCheck } from '../common/scope-check.decorator';

@Controller('api/v1/hiring/candidates')
@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
export class HiringCandidatesController {
  constructor(
    private readonly hiringCandidatesService: HiringCandidatesService,
  ) {}

  @ScopeCheck('visibleTo')
  @Post()
  create(
    @Body() dto: CreateHiringCandidateDto,
    @Req() req: { user: RequestUser },
  ) {
    return this.hiringCandidatesService.create(dto, req.user);
  }

  @ScopeCheck('visibleTo')
  @Get()
  findByPhone(
    @Query('contactPhone') contactPhone: string,
    @Req() req: { user: RequestUser },
  ) {
    return this.hiringCandidatesService.findByPhone(contactPhone, req.user);
  }
}
