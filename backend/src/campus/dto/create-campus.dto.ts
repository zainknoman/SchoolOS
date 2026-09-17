import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCampusDto {
  @IsString()
  @MinLength(1)
  schoolId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
}
