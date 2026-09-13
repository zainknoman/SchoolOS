import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BloodGroup } from '@prisma/client';

export class UpdateStudentMedicalInfoDto {
  @IsOptional() @IsEnum(BloodGroup) bloodGroup?: BloodGroup;
  @IsOptional() @IsString() allergies?: string;
  @IsOptional() @IsString() medicalConditions?: string;
  @IsOptional() @IsString() specialEducationalNeeds?: string;
  @IsOptional() @IsString() medicationNotes?: string;
  @IsOptional() @IsString() emergencyMedicalNotes?: string;
}
