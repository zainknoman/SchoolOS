import { IsOptional, IsString, MinLength } from 'class-validator';

// campusId/academicSessionId are deliberately not updatable — see this plan's Global Constraints.
export class UpdateClassDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
