import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { EmploymentStatus } from '@prisma/client';

/** Quick-edit fields for the Staff list (the full profile has its own, wider update DTO). */
export class UpdateStaffDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() mobile?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsEnum(EmploymentStatus) employmentStatus?: EmploymentStatus;
}
