import { Module } from '@nestjs/common';
import { StudentService } from './student.service';
import { StudentController } from './student.controller';
import { StudentProfileService } from './student-profile.service';
import { StudentProfileController } from './student-profile.controller';

@Module({
  providers: [StudentService, StudentProfileService],
  controllers: [StudentController, StudentProfileController],
})
export class StudentModule {}
