import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { TimetableService } from './timetable.service';
import { CreateTimetableEntryDto } from './dto/create-timetable-entry.dto';
import { UpdateTimetableEntryDto } from './dto/update-timetable-entry.dto';
import { ReplaceSectionTimetableDto } from './dto/replace-section-timetable.dto';
import {
  StudentAccessService,
  RequestUser,
} from '../common/student-access.service';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1')
export class TimetableController {
  constructor(
    private readonly timetableService: TimetableService,
    private readonly studentAccess: StudentAccessService,
  ) {}

  @Get('students/:id/timetable')
  async getForStudent(
    @Param('id') studentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.studentAccess.assertCanAccessStudent(req.user, studentId);
    return this.timetableService.getForStudent(studentId);
  }

  // Staff-only (no StudentAccessService involved) — this is the Timetable editor's read side,
  // listing what's already scheduled for a section so it can be shown/edited, not a parent-facing
  // read.
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Get('sections/:id/timetable')
  getForSection(@Param('id') sectionId: string) {
    return this.timetableService.getForSection(sectionId);
  }

  // The grid composer's bulk save — replaces the section's entire timetable in one call.
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Put('sections/:id/timetable')
  replaceForSection(
    @Param('id') sectionId: string,
    @Body() dto: ReplaceSectionTimetableDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.timetableService.replaceForSection(sectionId, dto.entries, req.user.id);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Post('timetable')
  createEntry(@Body() dto: CreateTimetableEntryDto, @Req() req: AuthenticatedRequest) {
    return this.timetableService.createEntry(dto, req.user.id);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Patch('timetable/:id')
  updateEntry(
    @Param('id') id: string,
    @Body() dto: UpdateTimetableEntryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.timetableService.updateEntry(id, dto, req.user.id);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Delete('timetable/:id')
  deleteEntry(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.timetableService.deleteEntry(id, req.user.id);
  }
}
