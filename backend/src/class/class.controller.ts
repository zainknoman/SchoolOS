import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ClassService } from './class.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1')
@Roles('SUPER_ADMIN')
export class ClassController {
  constructor(private readonly classService: ClassService) {}

  @Post('classes')
  create(@Body() dto: CreateClassDto, @Req() req: AuthenticatedRequest) {
    return this.classService.create(dto, req.user.id);
  }

  @Roles('TEACHER', 'SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN')
  @Get('classes')
  list(@Req() req: AuthenticatedRequest) {
    return this.classService.list(req.user);
  }

  @Patch('classes/:id')
  update(@Param('id') id: string, @Body() dto: UpdateClassDto, @Req() req: AuthenticatedRequest) {
    return this.classService.update(id, dto, req.user.id);
  }

  @Delete('classes/:id')
  async delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.classService.delete(id, req.user.id);
  }
}
