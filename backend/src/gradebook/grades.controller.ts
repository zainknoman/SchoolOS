import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { GradesService } from './grades.service';
import { StudentAccessService, type RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/students')
export class GradesController {
  constructor(
    private readonly gradesService: GradesService,
    private readonly studentAccess: StudentAccessService,
  ) {}

  @Get(':id/grades')
  async forStudent(
    @Param('id') studentId: string,
    @Query('termId') termId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.studentAccess.assertCanAccessStudent(req.user, studentId);
    return this.gradesService.forStudent(studentId, termId);
  }
}
