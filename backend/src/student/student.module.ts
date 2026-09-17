import { Module } from '@nestjs/common';
import { StudentService } from './student.service';
import { StudentController } from './student.controller';
import { StudentProfileService } from './student-profile.service';
import { StudentProfileController } from './student-profile.controller';
import { PromotionsService } from '../promotions/promotions.service';

@Module({
  providers: [StudentService, StudentProfileService, PromotionsService],
  controllers: [StudentController, StudentProfileController],
})
export class StudentModule {}
