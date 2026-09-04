import { Module } from '@nestjs/common';
import { AcademicSessionService } from './academic-session.service';
import { AcademicSessionController } from './academic-session.controller';

@Module({
  providers: [AcademicSessionService],
  controllers: [AcademicSessionController],
})
export class AcademicSessionModule {}
