import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Gender, EmploymentStatus } from '@prisma/client';
import { AddressDto } from '../../common/dto/address.dto';

export class UpdateStaffProfileDto {
  @IsOptional() @IsString() @MinLength(1) firstName?: string;
  @IsOptional() @IsString() middleName?: string;
  @IsOptional() @IsString() @MinLength(1) lastName?: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() cnic?: string;
  @IsOptional() @IsString() mobile?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() profilePhotoFileId?: string;
  @IsOptional() @IsDateString() joiningDate?: string;
  @IsOptional() @IsEnum(EmploymentStatus) employmentStatus?: EmploymentStatus;
  @IsOptional() @IsDateString() leavingDate?: string;
  @IsOptional() @IsString() leavingReason?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  currentAddress?: AddressDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  permanentAddress?: AddressDto;
}
