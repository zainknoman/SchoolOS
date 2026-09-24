import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { SubjectsService } from './subjects.service';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../common/student-access.service';

export class CreateSubjectDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  /** Required for SUPER_ADMIN; a school admin always manages their own school. */
  @IsOptional()
  @IsString()
  schoolId?: string;
}

export class UpdateSubjectDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListSubjectsQueryDto {
  @IsOptional()
  @IsString()
  schoolId?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeInactive?: boolean;
}

/** BL-02: school-scoped subject management. */
@Controller('api/v1/subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Roles('TEACHER', 'SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN')
  @Get()
  listAll(
    @Req() req: { user: RequestUser },
    @Query() query: ListSubjectsQueryDto,
  ) {
    return this.subjectsService.listAll(req.user, query);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Post()
  create(@Body() dto: CreateSubjectDto, @Req() req: { user: RequestUser }) {
    return this.subjectsService.create(dto, req.user);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSubjectDto,
    @Req() req: { user: RequestUser },
  ) {
    return this.subjectsService.update(id, dto, req.user);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: { user: RequestUser }) {
    await this.subjectsService.delete(id, req.user);
  }
}
