import { Controller, Get } from '@nestjs/common';
import { TeachersService } from './teachers.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('api/v1/teachers')
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  // Admin-only for now — the one consumer today is the Timetable editor, which is itself
  // Admin/Super Admin only (matches POST /timetable's existing @Roles).
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Get()
  listAll() {
    return this.teachersService.listAll();
  }
}
