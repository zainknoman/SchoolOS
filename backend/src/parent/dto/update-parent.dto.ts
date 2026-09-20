import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Gender } from '@prisma/client';
import { AddressDto } from '../../common/dto/address.dto';

// identifier is deliberately not updatable — see this plan's Global Constraints.
export class UpdateParentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  // --- Parent Profile fields ---
  @IsOptional() @IsString() cnic?: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() alternatePhone?: string;
  @IsOptional() @IsString() whatsappNumber?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() occupation?: string;
  @IsOptional() @IsString() employerName?: string;
  @IsOptional() @IsString() designation?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  currentAddress?: AddressDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  permanentAddress?: AddressDto;
}
