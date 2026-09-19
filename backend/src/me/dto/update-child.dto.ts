import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AddressDto } from '../../common/dto/address.dto';

export class ChildEmergencyContactDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsString() @MinLength(1) @MaxLength(60) relationship!: string;
  @IsString() @MinLength(3) @MaxLength(30) phone!: string;
  @IsOptional() @IsString() @MaxLength(30) alternatePhone?: string;
}

/**
 * The only fields a parent may change about their own child. Identity and school-record fields
 * (name, date of birth, B-Form, GR number, class/section, status) are deliberately absent — the
 * global ValidationPipe whitelist strips anything not declared here.
 */
export class UpdateChildDto {
  @IsOptional() @IsString() @MaxLength(30) studentMobile?: string;
  @IsOptional() @IsEmail() studentEmail?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  currentAddress?: AddressDto;

  @IsOptional() @IsString() @MaxLength(500) allergies?: string;
  @IsOptional() @IsString() @MaxLength(500) medicalConditions?: string;
  @IsOptional() @IsString() @MaxLength(500) medicationNotes?: string;

  /** Full replacement list — the parent sends every contact they want to keep. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ChildEmergencyContactDto)
  emergencyContacts?: ChildEmergencyContactDto[];
}
