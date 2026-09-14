import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { HolidaysService } from './holidays.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Post()
  create(@Body() dto: CreateHolidayDto) {
    return this.holidaysService.create(dto);
  }

  // No @Roles restriction and no StudentAccessService check — holidays aren't student-scoped
  // PII, any authenticated user (parents included) reads the calendar directly. Still scoped to
  // the caller's own school/campus(es) inside the service, though, so it's a tenant boundary, not
  // a completely open read.
  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Query('campusId') campusId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.holidaysService.findMany(req.user, { campusId, from, to });
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateHolidayDto) {
    return this.holidaysService.update(id, dto);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.holidaysService.delete(id);
  }
}
