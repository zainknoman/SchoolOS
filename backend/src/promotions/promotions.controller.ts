import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PromotionsService } from './promotions.service';
import { ExecutePromotionDto } from './dto/execute-promotion.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/promotions')
@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get('preview')
  preview(
    @Req() req: AuthenticatedRequest,
    @Query('sourceSectionId') sourceSectionId: string,
  ) {
    return this.promotionsService.preview(req.user, sourceSectionId);
  }

  @Post('execute')
  execute(@Req() req: AuthenticatedRequest, @Body() dto: ExecutePromotionDto) {
    return this.promotionsService.execute(req.user, dto);
  }
}
