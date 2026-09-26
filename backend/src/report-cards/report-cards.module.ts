import { Module } from '@nestjs/common';
import { ReportCardsService } from './report-cards.service';
import { ReportCardsController } from './report-cards.controller';
import { FilesModule } from '../files/files.module';
import { StudentAccessService } from '../common/student-access.service';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { GradesService } from '../gradebook/grades.service';
import { GradingScalesService } from '../gradebook/grading-scales.service';
import { GeneratedReportCardsService } from './generated-report-cards.service';
import { GeneratedReportCardsController } from './generated-report-cards.controller';
import { ReportCardPdfService } from './report-card-pdf.service';

@Module({
  imports: [FilesModule],
  providers: [
    ReportCardsService,
    StudentAccessService,
    EnrollmentService,
    GradesService,
    GradingScalesService,
    GeneratedReportCardsService,
    ReportCardPdfService,
  ],
  controllers: [ReportCardsController, GeneratedReportCardsController],
})
export class ReportCardsModule {}
