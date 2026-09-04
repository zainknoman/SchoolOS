import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CampusService } from './campus.service';
import { CreateCampusDto } from './dto/create-campus.dto';
import { UpdateCampusDto } from './dto/update-campus.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1')
@Roles('SUPER_ADMIN')
export class CampusController {
  constructor(private readonly campusService: CampusService) {}

  @Post('campuses')
  create(@Body() dto: CreateCampusDto, @Req() req: AuthenticatedRequest) {
    return this.campusService.create(dto, req.user.id);
  }

  @Get('campuses')
  list() {
    return this.campusService.list();
  }

  @Patch('campuses/:id')
  update(@Param('id') id: string, @Body() dto: UpdateCampusDto, @Req() req: AuthenticatedRequest) {
    return this.campusService.update(id, dto, req.user.id);
  }

  @Delete('campuses/:id')
  async delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.campusService.delete(id, req.user.id);
  }
}
