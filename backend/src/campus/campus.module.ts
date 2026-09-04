import { Module } from '@nestjs/common';
import { CampusService } from './campus.service';
import { CampusController } from './campus.controller';

@Module({
  providers: [CampusService],
  controllers: [CampusController],
})
export class CampusModule {}
