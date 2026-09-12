import { Module } from '@nestjs/common';
import { SectionsService } from './sections.service';
import { SectionsController } from './sections.controller';
import { StudentAccessService } from '../common/student-access.service';
import { EnrollmentService } from '../enrollment/enrollment.service';

@Module({
  providers: [SectionsService, StudentAccessService, EnrollmentService],
  controllers: [SectionsController],
})
export class SectionsModule {}
