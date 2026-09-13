import { IsNumber, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateAssessmentCategoryDto {
  @IsString()
  @MinLength(1)
  classId!: string;

  @IsString()
  @MinLength(1)
  termId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  weightPercent!: number;
}
