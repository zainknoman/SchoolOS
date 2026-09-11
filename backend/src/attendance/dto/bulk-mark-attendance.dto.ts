import { ArrayMinSize, IsArray, IsDateString, IsIn, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ATTENDANCE_STATUSES } from './mark-attendance.dto';

class AttendanceMarkDto {
  @IsString()
  @MinLength(1)
  studentId!: string;

  @IsIn(ATTENDANCE_STATUSES)
  status!: (typeof ATTENDANCE_STATUSES)[number];
}

export class BulkMarkAttendanceDto {
  @IsDateString()
  date!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AttendanceMarkDto)
  marks!: AttendanceMarkDto[];
}
