import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AttendanceService } from './attendance.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { BulkMarkAttendanceDto } from './dto/bulk-mark-attendance.dto';
import {
  StudentAccessService,
  RequestUser,
} from '../common/student-access.service';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly studentAccess: StudentAccessService,
  ) {}

  @Get('students/:id/attendance')
  async getForStudent(
    @Param('id') studentId: string,
    @Query('month') month: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.studentAccess.assertCanAccessStudent(req.user, studentId);
    const targetMonth = month ?? new Date().toISOString().slice(0, 7);
    return this.attendanceService.getForStudent(studentId, targetMonth);
  }

  // Staff-only (no StudentAccessService involved for PARENT, since @Roles already excludes that
  // role) — the roster-marking screen's pre-fill, now campus/tenant-scoped like every other
  // section-level route.
  @Roles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Get('sections/:id/attendance')
  async getForSection(
    @Param('id') sectionId: string,
    @Query('date') date: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.studentAccess.assertCanAccessSection(req.user, sectionId);
    const targetDate = date ?? new Date().toISOString().slice(0, 10);
    return this.attendanceService.getForSection(sectionId, targetDate);
  }

  @Roles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Post('attendance')
  async markAttendance(
    @Body() dto: MarkAttendanceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.studentAccess.assertCanAccessStudent(req.user, dto.studentId);
    return this.attendanceService.markAttendance(dto, req.user.id);
  }

  @Roles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Post('attendance/bulk')
  async markBulk(@Body() dto: BulkMarkAttendanceDto, @Req() req: AuthenticatedRequest) {
    for (const mark of dto.marks) {
      await this.studentAccess.assertCanAccessStudent(req.user, mark.studentId);
    }
    return this.attendanceService.markBulk(dto, req.user.id);
  }
}
