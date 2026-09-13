// backend/src/admissions/admissions.module.ts
import { Module } from '@nestjs/common';
import { ApplicantsService } from './applicants.service';
import { ApplicantsController } from './applicants.controller';
import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';

@Module({
  providers: [ApplicantsService, ApplicationsService],
  controllers: [ApplicantsController, ApplicationsController],
})
export class AdmissionsModule {}
