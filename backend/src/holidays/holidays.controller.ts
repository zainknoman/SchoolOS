import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { HolidaysService } from './holidays.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('api/v1/holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Post()
  create(@Body() dto: CreateHolidayDto) {
    return this.holidaysService.create(dto);
  }

  // No role restriction and no StudentAccessService check — holidays aren't student-scoped PII,
  // any authenticated user (parents included) reads the calendar directly.
  @Get()
  list(
    @Query('campusId') campusId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.holidaysService.findMany({ campusId, from, to });
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
