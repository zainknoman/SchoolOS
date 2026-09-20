import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
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

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.teacherService.delete(id, req.user.id);
  }
}
