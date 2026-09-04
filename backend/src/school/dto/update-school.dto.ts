import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateSchoolDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
