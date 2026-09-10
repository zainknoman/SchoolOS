import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PUSH_ADAPTER } from './push-adapter';
import { LoggingPushAdapter } from './logging-push.adapter';
import { FcmPushAdapter } from './fcm-push.adapter';
import { AdminFcmSender } from './fcm-sender';
import { resolveFirebaseConfig } from './fcm-config';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [
    NotificationsService,
    {
      provide: PUSH_ADAPTER,
      useFactory: (config: ConfigService, prisma: PrismaService) => {
        const firebaseConfig = resolveFirebaseConfig(config);
        if (!firebaseConfig) return new LoggingPushAdapter();
        return new FcmPushAdapter(new AdminFcmSender(firebaseConfig), prisma);
      },
      inject: [ConfigService, PrismaService],
    },
  ],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
