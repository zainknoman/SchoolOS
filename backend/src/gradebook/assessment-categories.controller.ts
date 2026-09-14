import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AssessmentCategoriesService } from './assessment-categories.service';
import { CreateAssessmentCategoryDto } from './dto/create-assessment-category.dto';
import { UpdateAssessmentCategoryDto } from './dto/update-assessment-category.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { StudentAccessService, type RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/assessment-categories')
@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
export class AssessmentCategoriesController {
  constructor(
    private readonly service: AssessmentCategoriesService,
    private readonly studentAccess: StudentAccessService,
  ) {}

  @Post()
  create(@Body() dto: CreateAssessmentCategoryDto) {
    return this.service.create(dto);
  }

  @Get()
  async list(
    @Query('classId') classId: string,
    @Query('termId') termId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!classId) {
      throw new BadRequestException('classId is required');
    }
    await this.studentAccess.assertCanAccessClass(req.user, classId);
    return this.service.findMany(classId, termId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAssessmentCategoryDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.service.delete(id);
  }
}
