import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateHolidayDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  campusId?: string;
}
