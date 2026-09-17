import { Module } from '@nestjs/common';
import { StudentsBulkImportService } from './students-bulk-import.service';
import { ParentsBulkImportService } from './parents-bulk-import.service';
import { TeachersBulkImportService } from './teachers-bulk-import.service';
import { StaffBulkImportService } from './staff-bulk-import.service';
import { BulkImportController } from './bulk-import.controller';

@Module({
  providers: [StudentsBulkImportService, ParentsBulkImportService, TeachersBulkImportService, StaffBulkImportService],
  controllers: [BulkImportController],
})
export class BulkImportModule {}
