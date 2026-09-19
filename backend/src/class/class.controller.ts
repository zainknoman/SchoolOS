import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ClassService } from './class.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { StudentAccessService, type RequestUser } from '../common/student-access.service';
import { OrgScopeService } from '../common/org-scope.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1')
@Roles('SUPER_ADMIN')
export class ClassController {
  constructor(
    private readonly classService: ClassService,
    private readonly studentAccess: StudentAccessService,
    private readonly orgScope: OrgScopeService,
  ) {}

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Post('classes')
  async create(@Body() dto: CreateClassDto, @Req() req: AuthenticatedRequest) {
    await this.orgScope.assertCampusAccess(req.user, dto.campusId);
    return this.classService.create(dto, req.user.id);
  }

  @Roles('TEACHER', 'SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN')
  @Get('classes')
  list(@Req() req: AuthenticatedRequest) {
    return this.classService.list(req.user);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Patch('classes/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateClassDto, @Req() req: AuthenticatedRequest) {
    await this.studentAccess.assertCanAccessClass(req.user, id);
    return this.classService.update(id, dto, req.user.id);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Delete('classes/:id')
  async delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.studentAccess.assertCanAccessClass(req.user, id);
    await this.classService.delete(id, req.user.id);
  }
}
