import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { TermsService } from './terms.service';
import type { RequestUser } from '../common/student-access.service';
import { CreateTermDto } from './dto/create-term.dto';
import { UpdateTermDto } from './dto/update-term.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { ScopeCheck } from '../common/scope-check.decorator';

@Controller('api/v1/terms')
export class TermsController {
  constructor(private readonly termsService: TermsService) {}

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @ScopeCheck('assertSessionInScope')
  @Post()
  create(@Body() dto: CreateTermDto, @Req() req: { user: RequestUser }) {
    return this.termsService.create(dto, req.user);
  }

  // No StudentAccessService check — terms are not per-student PII, same reasoning as Holiday's
  // read scope (any authenticated role, including PARENT/TEACHER, can read the term list).
  @ScopeCheck('assertSessionInScope')
  @Get()
  list(
    @Query('academicSessionId') academicSessionId: string,
    @Req() req: { user: RequestUser },
  ) {
    return this.termsService.findMany(academicSessionId, req.user);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @ScopeCheck('assertSessionInScope')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTermDto,
    @Req() req: { user: RequestUser },
  ) {
    return this.termsService.update(id, dto, req.user);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @ScopeCheck('assertSessionInScope')
  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: { user: RequestUser }) {
    await this.termsService.delete(id, req.user);
  }
}
