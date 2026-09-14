import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AddressDto } from '../../common/dto/address.dto';

export class CreateStaffEmergencyContactDto {
  @IsString() @MinLength(1) name!: string;
  @IsString() @MinLength(1) relationship!: string;
  @IsString() @MinLength(1) phone!: string;
  @IsOptional() @IsString() alternatePhone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsInt() @Min(1) priority?: number;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @ValidateNested() @Type(() => AddressDto) address?: AddressDto;
}