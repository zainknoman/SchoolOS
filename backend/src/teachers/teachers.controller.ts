import { toPageRequest } from '../common/pagination';
import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { TeachersService } from './teachers.service';
import { ListTeachersQueryDto } from './dto/list-teachers-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/teachers')
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  // Admin-only for now — the one consumer today is the Timetable editor, which is itself
  // Admin/Super Admin only (matches POST /timetable's existing @Roles).
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Get()
  listAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListTeachersQueryDto,
  ) {
    return this.teachersService.listAll(
      req.user,
      query.campusId,
      toPageRequest(query),
    );
  }

  @Roles('TEACHER')
  @Get('me/day')
  getMyDay(@Req() req: AuthenticatedRequest) {
    return this.teachersService.getMyDay(req.user);
  }

  @Roles('TEACHER')
  @Get('me/gradebook-overview')
  getGradebookOverview(@Req() req: AuthenticatedRequest) {
    return this.teachersService.getGradebookOverview(req.user);
  }
}
