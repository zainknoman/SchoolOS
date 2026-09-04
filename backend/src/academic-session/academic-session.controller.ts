import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AcademicSessionService } from './academic-session.service';
import { CreateAcademicSessionDto } from './dto/create-academic-session.dto';
import { UpdateAcademicSessionDto } from './dto/update-academic-session.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1')
@Roles('SUPER_ADMIN')
export class AcademicSessionController {
  constructor(private readonly academicSessionService: AcademicSessionService) {}

  @Post('academic-sessions')
  create(@Body() dto: CreateAcademicSessionDto, @Req() req: AuthenticatedRequest) {
    return this.academicSessionService.create(dto, req.user.id);
  }

  @Get('academic-sessions')
  list() {
    return this.academicSessionService.list();
  }

  @Patch('academic-sessions/:id')
  update(@Param('id') id: string, @Body() dto: UpdateAcademicSessionDto, @Req() req: AuthenticatedRequest) {
    return this.academicSessionService.update(id, dto, req.user.id);
  }

  @Delete('academic-sessions/:id')
  async delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.academicSessionService.delete(id, req.user.id);
  }
}
