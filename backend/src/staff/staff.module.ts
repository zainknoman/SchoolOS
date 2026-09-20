import { Module } from '@nestjs/common';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { StaffProfileService } from './staff-profile.service';
import { StaffProfileController } from './staff-profile.controller';

@Module({
  providers: [StaffService, StaffProfileService],
  controllers: [StaffController, StaffProfileController],
})
export class StaffModule {}
