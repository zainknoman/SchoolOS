import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateStaffExperienceDto {
  @IsOptional() @IsString() @MinLength(1) organization?: string;
  @IsOptional() @IsString() @MinLength(1) role?: string;
  @IsOptional() @IsDateString() fromDate?: string;
  @IsOptional() @IsDateString() toDate?: string;
  @IsOptional() @IsString() description?: string;
}