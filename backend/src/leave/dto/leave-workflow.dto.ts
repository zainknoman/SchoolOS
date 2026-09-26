import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/** BL-29: a teacher's recommendation on a pending leave request. */
export class LeaveRecommendationDto {
  @IsBoolean() approve!: boolean;
  @IsOptional() @IsString() @MaxLength(1000) note?: string | null;
}

/** BL-29: the admin's decision note (optional; parents see it). */
export class LeaveDecisionDto {
  @IsOptional() @IsString() @MaxLength(1000) note?: string | null;
}
