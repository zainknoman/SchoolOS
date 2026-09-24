import { IsBoolean, IsDateString, IsString, MinLength } from 'class-validator';

export class CreateAcademicSessionDto {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsBoolean()
  isActive!: boolean;

  /** BL-01: the school whose calendar this session belongs to. */
  @IsString()
  @MinLength(1)
  schoolId!: string;
}
