import { Module } from '@nestjs/common';
import { CircularsService } from './circulars.service';
import { CircularsController } from './circulars.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [CircularsService],
  controllers: [CircularsController],
})
export class CircularsModule {}
