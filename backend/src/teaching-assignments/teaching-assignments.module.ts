import { Module } from '@nestjs/common';
import { TeachingAssignmentsController } from './teaching-assignments.controller';
import { TeachingAssignmentsService } from './teaching-assignments.service';

@Module({
  providers: [TeachingAssignmentsService],
  controllers: [TeachingAssignmentsController],
})
export class TeachingAssignmentsModule {}
