import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { OrgStatus } from '@prisma/client';

export class CreateCampusDto {
  @IsString() @MinLength(1) schoolId!: string;
  @IsString() @MinLength(1) name!: string;

  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() campusType?: string;
  @IsOptional() @IsString() logoFileId?: string;
  @IsOptional() @IsString() principalName?: string;
  @IsOptional() @IsString() principalPhone?: string;
  @IsOptional() @IsEmail() principalEmail?: string;
  @IsOptional() @IsDateString() openingDate?: string;
  @IsOptional() @IsInt() capacity?: number;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsEnum(OrgStatus) status?: OrgStatus;
  @IsOptional() @IsArray() @IsString({ each: true }) departments?: string[];
  @IsOptional() @IsString() alternatePhone?: string;
  @IsOptional() @IsString() addressId?: string;

  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
}
