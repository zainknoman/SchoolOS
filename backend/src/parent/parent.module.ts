import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ParentService } from './parent.service';
import { ParentController } from './parent.controller';

@Module({
  imports: [AuthModule],
  providers: [ParentService],
  controllers: [ParentController],
  exports: [ParentService],
})
export class ParentModule {}
