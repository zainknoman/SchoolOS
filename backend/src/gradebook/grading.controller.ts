import {
  BadRequestException,
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
  CreateGradingScaleDto,
  ResultPublicationDto,
  UpdateGradingScaleDto,
} from './dto/grading-scale.dto';
import { GradingScalesService } from './grading-scales.service';
import { ResultPublicationsService } from './result-publications.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

/** BL-27 (Q6): per-school grading scales. */
@Controller('api/v1/grading-scales')
export class GradingScalesController {
  constructor(private readonly service: GradingScalesService) {}

  @Get()
  @Roles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  list(@Query('schoolId') schoolId: string, @Req() req: AuthenticatedRequest) {
    return this.service.list(req.user, schoolId || undefined);
  }

  @Post()
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  create(@Body() dto: CreateGradingScaleDto, @Req() req: AuthenticatedRequest) {
    return this.service.create(req.user, dto);
  }

  @Put(':id')
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateGradingScaleDto,
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

/** BL-27 (KI-16): publishing a class's results for a term needs category weights of 100 %. */
@Controller('api/v1/result-publications')
export class ResultPublicationsController {
  constructor(private readonly service: ResultPublicationsService) {}

  @Get()
  @Roles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  status(
    @Query('classId') classId: string,
    @Query('termId') termId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!classId || !termId) {
      throw new BadRequestException('classId and termId are required');
    }
    return this.service.status(req.user, classId, termId);
  }

  @Post()
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  publish(@Body() dto: ResultPublicationDto, @Req() req: AuthenticatedRequest) {
    return this.service.publish(req.user, dto.classId, dto.termId);
  }

  @Delete()
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  unpublish(
    @Query('classId') classId: string,
    @Query('termId') termId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!classId || !termId) {
      throw new BadRequestException('classId and termId are required');
    }
    return this.service.unpublish(req.user, classId, termId);
  }
}
