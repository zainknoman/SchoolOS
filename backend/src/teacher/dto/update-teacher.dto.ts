import { IsOptional, IsString, MinLength } from 'class-validator';

// identifier is deliberately not updatable — see this plan's Global Constraints.
export class UpdateTeacherDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
