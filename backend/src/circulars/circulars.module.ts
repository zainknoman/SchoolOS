import { Module } from '@nestjs/common';
import { CircularsService } from './circulars.service';
import { CircularsController } from './circulars.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { AiDraftingModule } from '../ai-drafting/ai-drafting.module';

@Module({
  imports: [NotificationsModule, AiDraftingModule],
  providers: [CircularsService],
  controllers: [CircularsController],
})
export class CircularsModule {}
