import { Module } from '@nestjs/common';
import { ReportCardsService } from './report-cards.service';
import { ReportCardsController } from './report-cards.controller';
import { FilesModule } from '../files/files.module';
import { StudentAccessService } from '../common/student-access.service';
import { EnrollmentService } from '../enrollment/enrollment.service';

@Module({
  imports: [FilesModule],
  providers: [ReportCardsService, StudentAccessService, EnrollmentService],
  controllers: [ReportCardsController],
})
export class ReportCardsModule {}
