// backend/src/admissions/dto/create-applicant.dto.ts
import { IsDateString, IsString, MinLength } from 'class-validator';

export class CreateApplicantDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsString()
  @MinLength(1)
  guardianName!: string;

  @IsString()
  @MinLength(1)
  guardianPhone!: string;
}
