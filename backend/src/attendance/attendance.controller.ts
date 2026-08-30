import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AttendanceService } from './attendance.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
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

  // Staff-only (no StudentAccessService involved) — the roster-marking screen's pre-fill, not a
  // parent-facing read. Defaults to today so the common case ("what did I already mark today?")
  // needs no query param.
  @Roles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Get('sections/:id/attendance')
  getForSection(@Param('id') sectionId: string, @Query('date') date?: string) {
    const targetDate = date ?? new Date().toISOString().slice(0, 10);
    return this.attendanceService.getForSection(sectionId, targetDate);
  }

  // Deliberately NOT guarded by StudentAccessService's parent-allow path — @Roles restricts this
  // to staff outright, so a PARENT token is rejected before ever reaching the service.
  @Roles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Post('attendance')
  markAttendance(
    @Body() dto: MarkAttendanceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.attendanceService.markAttendance(dto, req.user.id);
  }
}
