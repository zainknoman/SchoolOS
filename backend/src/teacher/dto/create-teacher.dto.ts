import { IsString, MinLength } from 'class-validator';

export class CreateTeacherDto {
  @IsString()
  @MinLength(1)
  identifier!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  campusId!: string;
}
