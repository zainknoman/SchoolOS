import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SchoolService } from './school.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1')
@Roles('SUPER_ADMIN')
export class SchoolController {
  constructor(private readonly schoolService: SchoolService) {}

  @Post('schools')
  create(@Body() dto: CreateSchoolDto, @Req() req: AuthenticatedRequest) {
    return this.schoolService.create(dto, req.user.id);
  }

  @Get('schools')
  list() {
    return this.schoolService.list();
  }

  @Patch('schools/:id')
  update(@Param('id') id: string, @Body() dto: UpdateSchoolDto, @Req() req: AuthenticatedRequest) {
    return this.schoolService.update(id, dto, req.user.id);
  }

  @Delete('schools/:id')
  async delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.schoolService.delete(id, req.user.id);
  }
}
