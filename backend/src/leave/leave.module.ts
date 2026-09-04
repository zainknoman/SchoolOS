import { Module } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { LeaveController } from './leave.controller';
import { StudentAccessService } from '../common/student-access.service';
import { EnrollmentService } from '../enrollment/enrollment.service';

@Module({
  providers: [LeaveService, StudentAccessService, EnrollmentService],
  controllers: [LeaveController],
})
export class LeaveModule {}
