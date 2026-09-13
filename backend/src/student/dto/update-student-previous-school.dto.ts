import { IsDateString, IsEmail, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AddressDto } from '../../common/dto/address.dto';

export class UpdateStudentPreviousSchoolDto {
  @IsString() @MinLength(1) schoolName!: string;
  @IsOptional() @IsString() contactNumber?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() lastClassAttended?: string;
  @IsOptional() @IsDateString() admissionDate?: string;
  @IsOptional() @IsDateString() leavingDate?: string;
  @IsOptional() @IsString() leavingCertificateNumber?: string;
  @IsOptional() @IsDateString() leavingCertificateDate?: string;
  @IsOptional() @IsString() reasonForLeaving?: string;
  @IsOptional() @IsString() academicRemarks?: string;
  @IsOptional() @ValidateNested() @Type(() => AddressDto) address?: AddressDto;
}
