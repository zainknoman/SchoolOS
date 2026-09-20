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
import { EmployeeType } from '@prisma/client';

class StaffLoginDto {
  @IsString() @MinLength(1) identifier!: string;
  @IsString() @MinLength(8) password!: string;
}

export class CreateStaffDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(EmployeeType)
  employeeType!: EmployeeType;

  @IsString()
  @MinLength(1)
  campusId!: string;

  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() cnic?: string;
  @IsOptional() @IsString() mobile?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsDateString() joiningDate?: string;

  // Required when employeeType is TEACHER (enforced in the service, since the rule depends on
  // this DTO's own employeeType field, not just this field's shape). Ignored for every other
  // employeeType — mirrors ApproveHiringApplicationDto's login field.
  @IsOptional()
  @ValidateNested()
  @Type(() => StaffLoginDto)
  login?: StaffLoginDto;
}
