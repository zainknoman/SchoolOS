import { IsOptional, IsString, MinLength } from 'class-validator';

// No enrollment/parent-link changes here — no re-enrollment/transfer workflow exists yet, see
// this plan's Global Constraints.
export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  grNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
