import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

/** BL-28 (Q8): a school's attendance-risk settings. */
export class UpdateAttendanceRiskPolicyDto {
  /** Required for SUPER_ADMIN; a school admin may omit it (their own school). */
  @IsOptional() @IsString() @MinLength(1) schoolId?: string;
  @IsInt() @Min(7) @Max(180) windowDays!: number;
  @IsInt() @Min(1) @Max(100) thresholdPercent!: number;
  @IsInt() @Min(1) @Max(180) minTrackedDays!: number;
  @IsBoolean() notifyParents!: boolean;
}
