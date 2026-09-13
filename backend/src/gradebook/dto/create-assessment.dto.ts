import { IsNumber, IsPositive, IsString, MinLength } from 'class-validator';

export class CreateAssessmentDto {
  @IsString()
  @MinLength(1)
  assessmentCategoryId!: string;

  @IsString()
  @MinLength(1)
  subjectId!: string;

  @IsString()
  @MinLength(1)
  label!: string;

  @IsNumber()
  @IsPositive()
  maxMarks!: number;
}
