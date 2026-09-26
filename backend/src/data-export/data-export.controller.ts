import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../common/student-access.service';
import {
  DataExportService,
  EXPORT_DATASETS,
  type ExportDataset,
} from './data-export.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

export class DataExportQueryDto {
  @IsOptional() @IsString() @MaxLength(64) schoolId?: string;
  @IsOptional() @IsString() @MaxLength(64) campusId?: string;
  @IsOptional() @IsString() @MaxLength(64) academicSessionId?: string;
  @IsOptional() @IsString() @MaxLength(10) from?: string;
  @IsOptional() @IsString() @MaxLength(10) to?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeSensitive?: boolean;
}

/** BL-41 (Q7, Q22): audited CSV export of one school's records. */
@Controller('api/v1/admin/exports')
@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
export class DataExportController {
  constructor(private readonly service: DataExportService) {}

  @Get()
  datasets() {
    return { datasets: EXPORT_DATASETS };
  }

  @Get(':dataset')
  async export(
    @Param('dataset') dataset: string,
    @Query() query: DataExportQueryDto,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    if (!(EXPORT_DATASETS as readonly string[]).includes(dataset)) {
      throw new BadRequestException(`Unknown export dataset "${dataset}"`);
    }
    const result = await this.service.export(
      dataset as ExportDataset,
      query,
      req.user,
      req.ip,
    );
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Cache-Control': 'no-store',
      'X-Row-Count': String(result.rowCount),
    });
    res.send(result.csv);
  }
}
