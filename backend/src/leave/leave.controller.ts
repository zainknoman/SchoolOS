import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { LeaveService } from './leave.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { StudentAccessService, RequestUser } from '../common/student-access.service';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1')
export class LeaveController {
  constructor(
    private readonly leaveService: LeaveService,
    private readonly studentAccess: StudentAccessService,
  ) {}

  @Roles('PARENT')
  @Post('leave-requests')
  async create(@Body() dto: CreateLeaveRequestDto, @Req() req: AuthenticatedRequest) {
    await this.studentAccess.assertCanAccessStudent(req.user, dto.studentId);
    return this.leaveService.create(dto, req.user.id);
  }

  @Get('students/:id/leave-requests')
  async getForStudent(@Param('id') studentId: string, @Req() req: AuthenticatedRequest) {
    await this.studentAccess.assertCanAccessStudent(req.user, studentId);
    return this.leaveService.listForStudent(studentId);
  }

  // Staff-only queue — not routed through StudentAccessService, matching Timetable/Attendance's
  // staff-facing list endpoints.
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Get('leave-requests')
  listAll(@Query('status') status?: string) {
    return this.leaveService.listAll(status);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Post('leave-requests/:id/approve')
  approve(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.leaveService.approve(id, req.user.id);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Post('leave-requests/:id/reject')
  reject(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.leaveService.reject(id, req.user.id);
  }
}
