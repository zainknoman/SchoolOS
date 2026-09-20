import { Module } from '@nestjs/common';
import { HiringCandidatesService } from './hiring-candidates.service';
import { HiringCandidatesController } from './hiring-candidates.controller';
import { HiringApplicationsService } from './hiring-applications.service';
import { HiringApplicationsController } from './hiring-applications.controller';

@Module({
  providers: [HiringCandidatesService, HiringApplicationsService],
  controllers: [HiringCandidatesController, HiringApplicationsController],
})
export class HiringModule {}
