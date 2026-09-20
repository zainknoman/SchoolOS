import { Module } from '@nestjs/common';
import { TermsService } from './terms.service';
import { TermsController } from './terms.controller';
import { AssessmentCategoriesService } from './assessment-categories.service';
import { AssessmentCategoriesController } from './assessment-categories.controller';
import { AssessmentsService } from './assessments.service';
import { AssessmentsController } from './assessments.controller';
import { GradesService } from './grades.service';
import { GradesController } from './grades.controller';
import { StudentAccessService } from '../common/student-access.service';
import { EnrollmentService } from '../enrollment/enrollment.service';

@Module({
  providers: [
    TermsService,
    AssessmentCategoriesService,
    AssessmentsService,
    GradesService,
    StudentAccessService,
    EnrollmentService,
  ],
  controllers: [
    TermsController,
    AssessmentCategoriesController,
    AssessmentsController,
    GradesController,
  ],
})
export class GradebookModule {}
