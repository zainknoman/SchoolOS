import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AttendanceRiskService } from './attendance-risk.service';
import { ATTENDANCE_RISK_CRON } from './attendance-risk.constants';

@Injectable()
export class AttendanceRiskJob {
  private readonly logger = new Logger(AttendanceRiskJob.name);

  constructor(private readonly attendanceRiskService: AttendanceRiskService) {}

  @Cron(ATTENDANCE_RISK_CRON)
  async run(): Promise<void> {
    try {
      await this.attendanceRiskService.recomputeAll();
    } catch (err) {
      this.logger.error('Attendance-risk recompute failed', err as Error);
    }
  }
}
