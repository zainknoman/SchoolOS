import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ParentService } from './parent.service';
import { CreateParentDto } from './dto/create-parent.dto';
import { UpdateParentDto } from './dto/update-parent.dto';
import { UpdateParentChildLinkDto } from './dto/update-parent-child-link.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/admin/parents')
@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
export class ParentController {
  constructor(private readonly parentService: ParentService) {}

  @Post()
  create(@Body() dto: CreateParentDto, @Req() req: AuthenticatedRequest) {
    return this.parentService.create(dto, req.user.id);
  }

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.parentService.list(req.user);
  }

  @Get(':id')
  profile(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.parentService.getProfile(id, req.user);
  }

  @Patch(':id/children/:studentId')
  updateChildLink(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @Body() dto: UpdateParentChildLinkDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.parentService.updateChildLink(id, studentId, dto, req.user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateParentDto, @Req() req: AuthenticatedRequest) {
    return this.parentService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.parentService.delete(id, req.user.id);
  }
}
