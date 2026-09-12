import { Module } from '@nestjs/common';
import { ComplaintsService } from './complaints.service';
import { ComplaintsController } from './complaints.controller';
import { StudentAccessService } from '../common/student-access.service';
import { EnrollmentService } from '../enrollment/enrollment.service';

@Module({
  providers: [ComplaintsService, StudentAccessService, EnrollmentService],
  controllers: [ComplaintsController],
})
export class ComplaintsModule {}
