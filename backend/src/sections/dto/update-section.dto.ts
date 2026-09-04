import { IsOptional, IsString, MinLength } from 'class-validator';

// classId is deliberately not updatable — see this plan's Global Constraints.
export class UpdateSectionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  classTeacherId?: string;
}
