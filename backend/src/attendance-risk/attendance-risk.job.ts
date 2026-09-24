import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AttendanceRiskService } from './attendance-risk.service';
import { ATTENDANCE_RISK_CRON } from './attendance-risk.constants';
import { JobLockService } from '../prisma/job-lock.service';

@Injectable()
export class AttendanceRiskJob {
  private readonly logger = new Logger(AttendanceRiskJob.name);

  constructor(
    private readonly attendanceRiskService: AttendanceRiskService,
    private readonly jobLock: JobLockService,
  ) {}

  @Cron(ATTENDANCE_RISK_CRON)
  async run(): Promise<void> {
    try {
      // BL-39: one instance per run — a concurrent double run would notify twice.
      await this.jobLock.runExclusive('attendance-risk', () =>
        this.attendanceRiskService.recomputeAll(),
      );
    } catch (err) {
      this.logger.error('Attendance-risk recompute failed', err as Error);
    }
  }
}
