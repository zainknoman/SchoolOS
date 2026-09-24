import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateHolidayDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  campusId?: string;

  /** BL-20: required only for a SUPER_ADMIN's school-wide holiday (no campusId). */
  @IsOptional()
  @IsString()
  schoolId?: string;
}
