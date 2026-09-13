import { IsOptional, IsString } from 'class-validator';

export class UpdateCurrentEnrollmentDto {
  @IsOptional() @IsString() rollNumber?: string;
  @IsOptional() @IsString() remarks?: string;
}
