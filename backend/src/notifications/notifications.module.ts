import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PUSH_ADAPTER } from './push-adapter';
import { LoggingPushAdapter } from './logging-push.adapter';
import { FcmPushAdapter } from './fcm-push.adapter';
import { AdminFcmSender } from './fcm-sender';
import { resolveFirebaseConfig } from './fcm-config';
import { WhatsAppAdapter } from './whatsapp.adapter';
import { HttpWhatsAppSender } from './whatsapp-sender';
import { resolveWhatsAppConfig } from './whatsapp-config';
import { SmsAdapter } from './sms.adapter';
import { HttpSmsSender } from './sms-sender';
import { resolveSmsConfig } from './sms-config';
import { WHATSAPP_ADAPTER, SMS_ADAPTER } from './channel-registry';
import { DigestDispatchJob } from './digest-dispatch.job';
import { PrismaService } from '../prisma/prisma.service';
import { MAIL_ADAPTER } from './mail-adapter';
import { LoggingMailAdapter } from './logging-mail.adapter';
import { SmtpMailAdapter } from './smtp-mail.adapter';
import { resolveSmtpConfig } from './smtp-config';

@Module({
  providers: [
    NotificationsService,
    DigestDispatchJob,
    {
      provide: MAIL_ADAPTER,
      useFactory: (config: ConfigService) => {
        const smtpConfig = resolveSmtpConfig(config);
        if (!smtpConfig) return new LoggingMailAdapter();
        return new SmtpMailAdapter(smtpConfig);
      },
      inject: [ConfigService],
    },
    {
      provide: PUSH_ADAPTER,
      useFactory: (config: ConfigService, prisma: PrismaService) => {
        const firebaseConfig = resolveFirebaseConfig(config);
        if (!firebaseConfig) return new LoggingPushAdapter();
        return new FcmPushAdapter(new AdminFcmSender(firebaseConfig), prisma);
      },
      inject: [ConfigService, PrismaService],
    },
    {
      provide: WHATSAPP_ADAPTER,
      useFactory: (config: ConfigService, prisma: PrismaService) => {
        const whatsAppConfig = resolveWhatsAppConfig(config);
        if (!whatsAppConfig) return new LoggingPushAdapter();
        return new WhatsAppAdapter(
          new HttpWhatsAppSender(whatsAppConfig),
          prisma,
        );
      },
      inject: [ConfigService, PrismaService],
    },
    {
      provide: SMS_ADAPTER,
      useFactory: (config: ConfigService, prisma: PrismaService) => {
        const smsConfig = resolveSmsConfig(config);
        if (!smsConfig) return new LoggingPushAdapter();
        return new SmsAdapter(new HttpSmsSender(smsConfig), prisma);
      },
      inject: [ConfigService, PrismaService],
    },
  ],
  controllers: [NotificationsController],
  exports: [NotificationsService, MAIL_ADAPTER],
})
export class NotificationsModule {}
