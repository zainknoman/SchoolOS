import { Module } from '@nestjs/common';
import { ComplaintsService } from './complaints.service';
import { ComplaintsController } from './complaints.controller';
import { StudentAccessService } from '../common/student-access.service';

@Module({
  providers: [ComplaintsService, StudentAccessService],
  controllers: [ComplaintsController],
})
export class ComplaintsModule {}
