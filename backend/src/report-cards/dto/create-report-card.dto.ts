import { IsString, MinLength } from 'class-validator';

export class CreateReportCardDto {
  @IsString()
  @MinLength(1)
  studentId!: string;

  @IsString()
  @MinLength(1)
  academicSessionId!: string;
}
