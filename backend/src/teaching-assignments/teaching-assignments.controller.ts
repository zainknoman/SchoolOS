import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { TeachingRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../common/student-access.service';
import { TeachingAssignmentsService } from './teaching-assignments.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

export class ListTeachingAssignmentsQueryDto {
  @IsOptional() @IsString() teacherId?: string;
  @IsOptional() @IsString() academicSessionId?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() sectionId?: string;
  @IsOptional() @IsString() subjectId?: string;
  @IsOptional() @IsEnum(TeachingRole) role?: TeachingRole;
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  current?: boolean;
}

/**
 * BL-25: "who taught X in session Y" — e.g.
 * `GET /api/v1/teaching-assignments?academicSessionId=…&subjectId=…&sectionId=…`.
 */
@Controller('api/v1/teaching-assignments')
@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
export class TeachingAssignmentsController {
  constructor(private readonly service: TeachingAssignmentsService) {}

  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListTeachingAssignmentsQueryDto,
  ) {
    return this.service.list(req.user, query);
  }
}
