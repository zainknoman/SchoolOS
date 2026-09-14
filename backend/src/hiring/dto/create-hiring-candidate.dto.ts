import { IsDateString, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateHiringCandidateDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() cnic?: string;
  @IsString() @MinLength(1) contactPhone!: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsString() resumeFileId?: string;
}