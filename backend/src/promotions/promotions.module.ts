import { Module } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { PromotionsController } from './promotions.controller';
import { PromotionIndicatorsService } from './promotion-indicators';

@Module({
  providers: [PromotionsService, PromotionIndicatorsService],
  controllers: [PromotionsController],
  exports: [PromotionsService],
})
export class PromotionsModule {}
