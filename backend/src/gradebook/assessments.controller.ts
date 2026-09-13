import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AssessmentsService } from './assessments.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { BulkMarksDto } from './dto/bulk-marks.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { StudentAccessService, type RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/assessments')
@Roles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
export class AssessmentsController {
  constructor(
    private readonly assessmentsService: AssessmentsService,
    private readonly studentAccess: StudentAccessService,
  ) {}

  @Post()
  async create(@Body() dto: CreateAssessmentDto, @Req() req: AuthenticatedRequest) {
    const classId = await this.assessmentsService.classIdForCategory(dto.assessmentCategoryId);
    await this.studentAccess.assertCanAccessClass(req.user, classId);
    return this.assessmentsService.create(dto);
  }

  @Get()
  list(@Query('assessmentCategoryId') assessmentCategoryId: string) {
    return this.assessmentsService.findMany(assessmentCategoryId);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateAssessmentDto, @Req() req: AuthenticatedRequest) {
    const classId = await this.assessmentsService.classIdForAssessment(id);
    await this.studentAccess.assertCanAccessClass(req.user, classId);
    return this.assessmentsService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const classId = await this.assessmentsService.classIdForAssessment(id);
    await this.studentAccess.assertCanAccessClass(req.user, classId);
    await this.assessmentsService.delete(id);
  }

  @Post(':id/marks')
  async saveMarks(@Param('id') id: string, @Body() dto: BulkMarksDto, @Req() req: AuthenticatedRequest) {
    const classId = await this.assessmentsService.classIdForAssessment(id);
    await this.studentAccess.assertCanAccessClass(req.user, classId);
    return this.assessmentsService.saveMarksBulk(id, dto, req.user.id);
  }
}
