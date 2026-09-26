import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../common/student-access.service';
import {
  CreateSyllabusDto,
  ListSyllabiQueryDto,
  UpdateSyllabusDto,
} from './dto/syllabus.dto';
import { SyllabusService } from './syllabus.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

/** BL-26 (Q2): yearly syllabus per class + subject; teachers of the class read it. */
@Controller('api/v1/syllabi')
export class SyllabusController {
  constructor(private readonly service: SyllabusService) {}

  @Get()
  @Roles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  list(@Query() query: ListSyllabiQueryDto, @Req() req: AuthenticatedRequest) {
    return this.service.list(req.user, query);
  }

  @Get(':id')
  @Roles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  get(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.get(req.user, id);
  }

  @Post()
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  create(@Body() dto: CreateSyllabusDto, @Req() req: AuthenticatedRequest) {
    return this.service.create(req.user, dto);
  }

  @Put(':id')
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSyllabusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.update(req.user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  async delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.service.delete(req.user, id);
  }
}
