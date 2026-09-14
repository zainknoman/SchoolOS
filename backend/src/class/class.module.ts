import { Module } from '@nestjs/common';
import { ClassService } from './class.service';
import { ClassController } from './class.controller';
import { StudentAccessService } from '../common/student-access.service';
import { EnrollmentService } from '../enrollment/enrollment.service';

@Module({
  providers: [ClassService, StudentAccessService, EnrollmentService],
  controllers: [ClassController],
})
export class ClassModule {}
