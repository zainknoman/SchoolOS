import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PUSH_ADAPTER } from './push-adapter';
import { LoggingPushAdapter } from './logging-push.adapter';

@Module({
  providers: [
    NotificationsService,
    { provide: PUSH_ADAPTER, useClass: LoggingPushAdapter },
  ],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
