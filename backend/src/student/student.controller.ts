import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { StudentService } from './student.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/admin/students')
@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Post()
  create(@Body() dto: CreateStudentDto, @Req() req: AuthenticatedRequest) {
    return this.studentService.create(dto, req.user.id);
  }

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.studentService.list(req.user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto, @Req() req: AuthenticatedRequest) {
    return this.studentService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.studentService.delete(id, req.user.id);
  }
}
