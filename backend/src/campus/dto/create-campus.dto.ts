import { IsString, MinLength } from 'class-validator';

export class CreateCampusDto {
  @IsString()
  @MinLength(1)
  schoolId!: string;

  @IsString()
  @MinLength(1)
  name!: string;
}
