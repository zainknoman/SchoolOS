import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

/** BL-05: a school's promotion thresholds and which of them block a plain PROMOTED decision. */
export class UpdatePromotionPolicyDto {
  /** Required for SUPER_ADMIN; a school admin may omit it (their own school). */
  @IsOptional() @IsString() @MinLength(1) schoolId?: string;
  @IsInt() @Min(0) @Max(100) minAttendancePercent!: number;
  @IsInt() @Min(0) @Max(100) minResultPercent!: number;
  @IsBoolean() blockOnAttendance!: boolean;
  @IsBoolean() blockOnResults!: boolean;
  @IsBoolean() blockOnFees!: boolean;
}
