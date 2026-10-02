import { Body, Controller, Get, Post, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PromotionsService } from './promotions.service';
import { ExecutePromotionDto } from './dto/execute-promotion.dto';
import { UpdatePromotionPolicyDto } from './dto/update-promotion-policy.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../common/student-access.service';
import { ScopeCheck } from '../common/scope-check.decorator';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/promotions')
@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @ScopeCheck('assertSectionInOwnSchool')
  @Get('preview')
  preview(
    @Req() req: AuthenticatedRequest,
    @Query('sourceSectionId') sourceSectionId: string,
  ) {
    return this.promotionsService.preview(req.user, sourceSectionId);
  }

  @ScopeCheck('orgScope.resolve')
  @Get('policy')
  getPolicy(
    @Req() req: AuthenticatedRequest,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.promotionsService.getPolicy(req.user, schoolId);
  }

  @ScopeCheck('orgScope.resolve')
  @Put('policy')
  updatePolicy(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdatePromotionPolicyDto,
  ) {
    return this.promotionsService.updatePolicy(req.user, dto);
  }

  @ScopeCheck('orgScope.resolve')
  @Post('execute')
  execute(@Req() req: AuthenticatedRequest, @Body() dto: ExecutePromotionDto) {
    return this.promotionsService.execute(req.user, dto);
  }
}
