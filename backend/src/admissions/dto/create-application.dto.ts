// backend/src/admissions/dto/create-application.dto.ts
import { IsString, MinLength } from 'class-validator';

export class CreateApplicationDto {
  @IsString()
  @MinLength(1)
  applicantId!: string;

  @IsString()
  @MinLength(1)
  desiredClassId!: string;

  @IsString()
  @MinLength(1)
  academicSessionId!: string;
}
