import { IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class UpdateAssessmentCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weightPercent?: number;
}
