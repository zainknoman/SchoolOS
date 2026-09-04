import { IsOptional, IsString, MinLength } from 'class-validator';

// schoolId is deliberately not updatable — see this plan's Global Constraints.
export class UpdateCampusDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
