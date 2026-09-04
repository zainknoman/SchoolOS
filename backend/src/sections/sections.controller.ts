import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SectionsService } from './sections.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/sections')
export class SectionsController {
  constructor(private readonly sectionsService: SectionsService) {}

  @Roles('TEACHER', 'SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN')
  @Get()
  listAll() {
    return this.sectionsService.listAll();
  }

  @Roles('TEACHER', 'SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN')
  @Get(':id/students')
  getStudents(@Param('id') sectionId: string) {
    return this.sectionsService.getStudents(sectionId);
  }

  @Roles('SUPER_ADMIN')
  @Post()
  create(@Body() dto: CreateSectionDto, @Req() req: AuthenticatedRequest) {
    return this.sectionsService.create(dto, req.user.id);
  }

  @Roles('SUPER_ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSectionDto, @Req() req: AuthenticatedRequest) {
    return this.sectionsService.update(id, dto, req.user.id);
  }

  @Roles('SUPER_ADMIN')
  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.sectionsService.delete(id, req.user.id);
  }
}
