import { Module } from '@nestjs/common';
import { AttendanceRiskService } from './attendance-risk.service';
import { AttendanceRiskController } from './attendance-risk.controller';
import { AttendanceRiskJob } from './attendance-risk.job';
import { HolidaysModule } from '../holidays/holidays.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StudentAccessService } from '../common/student-access.service';

@Module({
  imports: [HolidaysModule, NotificationsModule],
  providers: [AttendanceRiskService, AttendanceRiskJob, StudentAccessService],
  controllers: [AttendanceRiskController],
})
export class AttendanceRiskModule {}
