import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateParentDto {
  @IsString()
  @MinLength(1)
  identifier!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
