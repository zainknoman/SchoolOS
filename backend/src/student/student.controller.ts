import { PageQueryDto, toPageRequest } from '../common/pagination';
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
  Query,
  UseGuards,
} from '@nestjs/common';
import { RecordScopeGuard, ScopedRecord } from '../common/record-scope.guard';
import { ArchiveRecordDto } from '../common/dto/archive-record.dto';
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
@UseGuards(RecordScopeGuard)
@ScopedRecord('student', 'id')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Post()
  create(@Body() dto: CreateStudentDto, @Req() req: AuthenticatedRequest) {
    return this.studentService.create(dto, req.user.id);
  }

  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Query() page: PageQueryDto,
    @Query('archived') archived?: string,
  ) {
    return this.studentService.list(
      req.user,
      toPageRequest(page),
      archived === 'true',
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.studentService.update(id, dto, req.user.id);
  }

  /** BL-07: archives (never hard-deletes); kept for the existing clients. */
  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Query('reason') reason?: string,
  ) {
    await this.studentService.archive(id, req.user.id, reason);
  }

  @Post(':id/archive')
  archive(
    @Param('id') id: string,
    @Body() dto: ArchiveRecordDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.studentService.archive(id, req.user.id, dto.reason);
  }

  @Post(':id/unarchive')
  @HttpCode(204)
  async unarchive(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.studentService.unarchive(id, req.user.id);
  }

  @Post(':id/erase')
  @Roles('SUPER_ADMIN')
  @HttpCode(204)
  async erase(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.studentService.erase(id, req.user.id);
  }
}
