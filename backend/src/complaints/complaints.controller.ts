import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ComplaintsService } from './complaints.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { UpdateComplaintStatusDto } from './dto/update-complaint-status.dto';
import { StudentAccessService, RequestUser } from '../common/student-access.service';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/complaints')
export class ComplaintsController {
  constructor(
    private readonly complaintsService: ComplaintsService,
    private readonly studentAccess: StudentAccessService,
  ) {}

  @Roles('TEACHER', 'SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN')
  @Post()
  async create(@Body() dto: CreateComplaintDto, @Req() req: AuthenticatedRequest) {
    await this.studentAccess.assertCanAccessStudent(req.user, dto.studentId);
    return this.complaintsService.create(dto, req.user.id);
  }

  // Staff see any student's complaints directly; a parent request is scoped via
  // StudentAccessService the same way every other student-linked read is.
  @Get()
  async findForStudent(@Query('studentId') studentId: string, @Req() req: AuthenticatedRequest) {
    if (!studentId) {
      throw new BadRequestException('studentId is required');
    }
    await this.studentAccess.assertCanAccessStudent(req.user, studentId);
    return this.complaintsService.findForStudent(studentId);
  }

  @Roles('TEACHER', 'SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN')
  @Patch(':id')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateComplaintStatusDto) {
    return this.complaintsService.updateStatus(id, dto.status);
  }
}
