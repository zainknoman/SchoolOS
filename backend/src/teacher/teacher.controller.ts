import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RecordScopeGuard, ScopedRecord } from '../common/record-scope.guard';
import type { Request } from 'express';
import { TeacherService } from './teacher.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/admin/teachers')
@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
@UseGuards(RecordScopeGuard)
@ScopedRecord('teacher', 'id')
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  @Post()
  create(@Body() dto: CreateTeacherDto, @Req() req: AuthenticatedRequest) {
    return this.teacherService.create(dto, req.user);
  }

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.teacherService.list(req.user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTeacherDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.teacherService.update(id, dto, req.user.id);
  }

  /** BL-07: archives (never hard-deletes). */
  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.teacherService.archive(id, req.user.id);
  }

  @Post(':id/erase')
  @Roles('SUPER_ADMIN')
  @HttpCode(204)
  async erase(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.teacherService.erase(id, req.user.id);
  }
}
