import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Put,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { RetentionCategory } from '@prisma/client';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../common/student-access.service';
import { RetentionService } from './retention.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

export class UpdateRetentionPolicyDto {
  /** null = unset (the default until legal review). */
  @ValidateIf((o: UpdateRetentionPolicyDto) => o.periodMonths !== null)
  @IsInt()
  @Min(1)
  periodMonths!: number | null;

  @IsOptional() @IsString() @MaxLength(500) legalBasis?: string | null;
}

/** BL-63 (RD-6): retention settings and the review report — SUPER_ADMIN only, audited. */
@Controller('api/v1/admin/retention-policy')
@Roles('SUPER_ADMIN')
export class RetentionController {
  constructor(private readonly service: RetentionService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get('report')
  report() {
    return this.service.report();
  }

  @Put(':category')
  update(
    @Param('category', new ParseEnumPipe(RetentionCategory))
    category: RetentionCategory,
    @Body() dto: UpdateRetentionPolicyDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.update(category, dto, req.user);
  }
}
