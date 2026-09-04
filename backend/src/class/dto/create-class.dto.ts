import { IsString, MinLength } from 'class-validator';

export class CreateClassDto {
  @IsString()
  @MinLength(1)
  campusId!: string;

  @IsString()
  @MinLength(1)
  academicSessionId!: string;

  @IsString()
  @MinLength(1)
  name!: string;
}
