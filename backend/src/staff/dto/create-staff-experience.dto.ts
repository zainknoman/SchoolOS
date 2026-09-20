import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateStaffExperienceDto {
  @IsString() @MinLength(1) organization!: string;
  @IsString() @MinLength(1) role!: string;
  @IsOptional() @IsDateString() fromDate?: string;
  @IsOptional() @IsDateString() toDate?: string;
  @IsOptional() @IsString() description?: string;
}
