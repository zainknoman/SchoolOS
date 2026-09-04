import { IsDateString, IsString, MinLength } from 'class-validator';

export class CreateLeaveRequestDto {
  @IsString()
  @MinLength(1)
  studentId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsString()
  @MinLength(1)
  reason!: string;
}
