import { Body, Controller, Get, Param, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AttendanceRiskService } from './attendance-risk.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  StudentAccessService,
  RequestUser,
} from '../common/student-access.service';
import { OrgScopeService } from '../common/org-scope.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UpdateAttendanceRiskPolicyDto } from './update-attendance-risk-policy.dto';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1')
export class AttendanceRiskController {
  constructor(
    private readonly attendanceRiskService: AttendanceRiskService,
    private readonly studentAccess: StudentAccessService,
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
  ) {}

  @Get('students/:id/attendance-risk')
  async getForStudent(
    @Param('id') studentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.studentAccess.assertCanAccessStudent(req.user, studentId);
    return this.attendanceRiskService.getForStudent(studentId);
  }

  /** BL-28: the school's settings (defaults when none are saved). */
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Get('attendance-risk/settings')
  getSettings(
    @Query('schoolId') schoolId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.attendanceRiskService.getPolicy(
      req.user,
      schoolId || undefined,
    );
  }

  /** BL-28: school-wide admins and SUPER_ADMIN; audited. Applied by the next nightly run. */
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Put('attendance-risk/settings')
  updateSettings(
    @Body() dto: UpdateAttendanceRiskPolicyDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.attendanceRiskService.updatePolicy(req.user, dto);
  }

  @Roles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Get('attendance-risk')
  async getFlagged(@Req() req: AuthenticatedRequest) {
    if (req.user.role === 'SUPER_ADMIN') {
      return this.attendanceRiskService.getFlagged();
    }
    if (req.user.role === 'SCHOOL_ADMIN') {
      const scope = await this.orgScope.resolve(req.user);
      if (scope.denied) {
        return this.attendanceRiskService.getFlagged([]);
      }
      const sections = await this.prisma.section.findMany({
        where: { class: { campus: scope.campusWhere } },
        select: { id: true },
      });
      return this.attendanceRiskService.getFlagged(sections.map((s) => s.id));
    }
    const teacher = await this.prisma.teacher.findUnique({
      where: { userId: req.user.id },
    });
    if (!teacher) {
      return this.attendanceRiskService.getFlagged([]);
    }
    const sections = await this.prisma.section.findMany({
      where: { classTeacherId: teacher.id },
      select: { id: true },
    });
    return this.attendanceRiskService.getFlagged(sections.map((s) => s.id));
  }
}
