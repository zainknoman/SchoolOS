import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { StudentAccessService } from '../common/student-access.service';

@Module({
  imports: [NotificationsModule],
  providers: [ConversationsService, EnrollmentService, StudentAccessService],
  controllers: [ConversationsController],
})
export class MessagesModule {}
