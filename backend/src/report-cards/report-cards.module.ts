import { Module } from '@nestjs/common';
import { ReportCardsService } from './report-cards.service';
import { ReportCardsController } from './report-cards.controller';
import { FilesModule } from '../files/files.module';
import { StudentAccessService } from '../common/student-access.service';

@Module({
  imports: [FilesModule],
  providers: [ReportCardsService, StudentAccessService],
  controllers: [ReportCardsController],
})
export class ReportCardsModule {}
