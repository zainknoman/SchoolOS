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
import { Gender, StudentStatus } from '@prisma/client';
import { AddressDto } from '../../common/dto/address.dto';

export class UpdateStudentProfileDto {
  @IsOptional() @IsString() @MinLength(1) firstName?: string;
  @IsOptional() @IsString() middleName?: string;
  @IsOptional() @IsString() @MinLength(1) lastName?: string;
  @IsOptional() @IsString() preferredName?: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() placeOfBirth?: string;
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsString() religion?: string;
  @IsOptional() @IsString() bFormNumber?: string;
  @IsOptional() @IsEnum(StudentStatus) status?: StudentStatus;
  @IsOptional() @IsDateString() admissionDate?: string;
  @IsOptional() @IsDateString() leavingDate?: string;
  @IsOptional() @IsString() leavingReason?: string;
  @IsOptional() @IsString() studentMobile?: string;
  @IsOptional() @IsEmail() studentEmail?: string;
  @IsOptional() @IsString() profilePhotoFileId?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  currentAddress?: AddressDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  permanentAddress?: AddressDto;
}
