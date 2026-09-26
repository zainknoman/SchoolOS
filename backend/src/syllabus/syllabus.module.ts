import { Module } from '@nestjs/common';
import { SyllabusController } from './syllabus.controller';
import { SyllabusService } from './syllabus.service';
import { StudentAccessService } from '../common/student-access.service';
import { EnrollmentService } from '../enrollment/enrollment.service';

@Module({
  providers: [SyllabusService, StudentAccessService, EnrollmentService],
  controllers: [SyllabusController],
})
export class SyllabusModule {}
