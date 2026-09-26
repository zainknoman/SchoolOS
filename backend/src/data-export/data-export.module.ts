import { Module } from '@nestjs/common';
import { DataExportController } from './data-export.controller';
import { DataExportService } from './data-export.service';

@Module({
  providers: [DataExportService],
  controllers: [DataExportController],
})
export class DataExportModule {}
