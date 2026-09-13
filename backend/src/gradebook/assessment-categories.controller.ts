import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AssessmentCategoriesService } from './assessment-categories.service';
import { CreateAssessmentCategoryDto } from './dto/create-assessment-category.dto';
import { UpdateAssessmentCategoryDto } from './dto/update-assessment-category.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('api/v1/assessment-categories')
@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
export class AssessmentCategoriesController {
  constructor(private readonly service: AssessmentCategoriesService) {}

  @Post()
  create(@Body() dto: CreateAssessmentCategoryDto) {
    return this.service.create(dto);
  }

  @Get()
  list(@Query('classId') classId: string, @Query('termId') termId: string) {
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
