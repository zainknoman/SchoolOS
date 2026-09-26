import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { LeaveService } from './leave.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import {
  LeaveDecisionDto,
  LeaveRecommendationDto,
} from './dto/leave-workflow.dto';
import {
  StudentAccessService,
  RequestUser,
} from '../common/student-access.service';
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
  async create(
    @Body() dto: CreateLeaveRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.studentAccess.assertCanAccessStudent(req.user, dto.studentId);
    return this.leaveService.create(dto, req.user.id);
  }

  @Get('students/:id/leave-requests')
  async getForStudent(
    @Param('id') studentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.studentAccess.assertCanAccessStudent(req.user, studentId);
    return this.leaveService.listForStudent(studentId, req.user);
  }

  // Staff-only queue — not routed through StudentAccessService, matching Timetable/Attendance's
  // staff-facing list endpoints. BL-29: teachers see their sections' students' requests.
  @Roles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Get('leave-requests')
  listAll(
    @Query('status') status: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.leaveService.listAll(req.user, status);
  }

  /** BL-29: a teacher of the student recommends; never changes the status. */
  @Roles('TEACHER')
  @Post('leave-requests/:id/recommend')
  async recommend(
    @Param('id') id: string,
    @Body() dto: LeaveRecommendationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.assertMayActOn(id, req.user);
    return this.leaveService.recommend(id, req.user.id, dto);
  }

  // BL-29 (KG-27): the decision is confined to the student's school/campus (it was not checked).
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Post('leave-requests/:id/approve')
  async approve(
    @Param('id') id: string,
    @Body() dto: LeaveDecisionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.assertMayActOn(id, req.user);
    return this.leaveService.approve(id, req.user.id, dto?.note);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Post('leave-requests/:id/reject')
  async reject(
    @Param('id') id: string,
    @Body() dto: LeaveDecisionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.assertMayActOn(id, req.user);
    return this.leaveService.reject(id, req.user.id, dto?.note);
  }

  private async assertMayActOn(id: string, user: RequestUser) {
    const studentId = await this.leaveService.studentIdOf(id);
    if (user.role === 'TEACHER') {
      // a teacher of the student's current section
      await this.studentAccess.assertCanAccessStudent(user, studentId);
    } else {
      // an admin of the school the student was last enrolled in (a withdrawn student's pending
      // request can still be rejected)
      await this.leaveService.assertAdminScope(user, studentId);
    }
  }
}
