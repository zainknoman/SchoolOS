import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import type { Request } from 'express';
import { StudentProfileService } from './student-profile.service';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
import { UpdateCurrentEnrollmentDto } from './dto/update-current-enrollment.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/admin/students/:studentId')
@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
export class StudentProfileController {
  constructor(private readonly service: StudentProfileService) {}

  @Get('profile')
  getProfile(@Param('studentId') studentId: string) {
    return this.service.getProfile(studentId);
  }

  @Patch('profile')
  updateProfile(
    @Param('studentId') studentId: string,
    @Body() dto: UpdateStudentProfileDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateProfile(studentId, dto, req.user.id);
  }

  @Patch('current-enrollment')
  updateCurrentEnrollment(
    @Param('studentId') studentId: string,
    @Body() dto: UpdateCurrentEnrollmentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateCurrentEnrollment(studentId, dto, req.user.id);
  }
}
