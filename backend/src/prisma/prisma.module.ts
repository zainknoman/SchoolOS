import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { JobLockService } from './job-lock.service';

@Global()
@Module({
  providers: [PrismaService, JobLockService],
  exports: [PrismaService, JobLockService],
})
export class PrismaModule {}
