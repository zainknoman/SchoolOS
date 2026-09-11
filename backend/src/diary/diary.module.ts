import { Module } from '@nestjs/common';
import { DiaryService } from './diary.service';
import { DiaryController } from './diary.controller';
import { StudentAccessService } from '../common/student-access.service';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AiDraftingModule } from '../ai-drafting/ai-drafting.module';

@Module({
  imports: [NotificationsModule, AiDraftingModule],
  providers: [DiaryService, StudentAccessService, EnrollmentService],
  controllers: [DiaryController],
})
export class DiaryModule {}
