import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';
import { OrgStatus } from '@prisma/client';

export class CreateSchoolDto {
  @IsString() @MinLength(1) name!: string;

  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() registrationNumber?: string;
  @IsOptional() @IsUrl() website?: string;
  @IsOptional() @IsString() logoFileId?: string;
  @IsOptional() @IsString() principalName?: string;
  @IsOptional() @IsString() principalPhone?: string;
  @IsOptional() @IsEmail() principalEmail?: string;
  @IsOptional() @IsDateString() establishedDate?: string;
  @IsOptional() @IsString() schoolType?: string;
  @IsOptional() @IsString() educationBoard?: string;
  @IsOptional() @IsEnum(OrgStatus) status?: OrgStatus;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() alternatePhone?: string;
  @IsOptional() @IsString() addressId?: string;

  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
}
