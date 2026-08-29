import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [ConversationsService, EnrollmentService],
  controllers: [ConversationsController],
})
export class MessagesModule {}
