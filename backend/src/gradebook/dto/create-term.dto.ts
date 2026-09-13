import { IsDateString, IsInt, IsString, MinLength } from 'class-validator';

export class CreateTermDto {
  @IsString()
  @MinLength(1)
  academicSessionId!: string;

  @IsString()
  @MinLength(1)
  label!: string;

  @IsInt()
  order!: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
