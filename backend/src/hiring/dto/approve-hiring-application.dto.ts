import { IsDateString, IsEmail, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class HiringLoginDto {
  @IsString() @MinLength(1) identifier!: string;
  @IsString() @MinLength(8) password!: string;
}

export class ApproveHiringApplicationDto {
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() cnic?: string;
  @IsOptional() @IsString() mobile?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsDateString() joiningDate?: string;
  // Required when the application's employeeType is TEACHER (enforced in the service, not
  // here, since the rule depends on the application record, not just this DTO's own shape).
  // Ignored for every other employeeType — see this sub-project's scope cut in
  // docs/database/data-model-design.md.
  @IsOptional() @ValidateNested() @Type(() => HiringLoginDto) login?: HiringLoginDto;
}