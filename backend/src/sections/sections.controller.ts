import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { SectionsService } from './sections.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  StudentAccessService,
  type RequestUser,
} from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/sections')
export class SectionsController {
  constructor(
    private readonly sectionsService: SectionsService,
    private readonly studentAccess: StudentAccessService,
  ) {}

  @Roles('TEACHER', 'SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN')
  @Get()
  listAll(@Req() req: AuthenticatedRequest) {
    return this.sectionsService.listAll(req.user);
  }

  @Roles('TEACHER', 'SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN')
  @Get(':id/students')
  async getStudents(
    @Param('id') sectionId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.studentAccess.assertCanAccessSection(req.user, sectionId);
    return this.sectionsService.getStudents(sectionId);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Post()
  async create(
    @Body() dto: CreateSectionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.studentAccess.assertCanAccessClass(req.user, dto.classId);
    return this.sectionsService.create(dto, req.user.id);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSectionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.studentAccess.assertCanAccessSection(req.user, id);
    return this.sectionsService.update(id, dto, req.user.id);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.studentAccess.assertCanAccessSection(req.user, id);
    await this.sectionsService.delete(id, req.user.id);
  }
}
