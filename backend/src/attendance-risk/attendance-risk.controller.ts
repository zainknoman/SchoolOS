import { Controller, Get, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AttendanceRiskService } from './attendance-risk.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  StudentAccessService,
  RequestUser,
} from '../common/student-access.service';
import { OrgScopeService } from '../common/org-scope.service';
import { Roles } from '../auth/decorators/roles.decorator';

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
