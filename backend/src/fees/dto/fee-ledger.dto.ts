import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ADJUSTMENT_KINDS, type AdjustmentKind } from '../voucher-ledger';

/** BL-08: a one-off line on one voucher. `amount` is positive; reductions are stored negative. */
export class AdjustVoucherDto {
  @IsIn(ADJUSTMENT_KINDS)
  kind!: AdjustmentKind;

  @IsInt()
  @Min(1)
  amount!: number; // paisa

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class ReasonDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

/** BL-08: a standing discount/scholarship — exactly one of percent or amount. */
export class CreateConcessionDto {
  @IsIn(['DISCOUNT', 'SCHOLARSHIP'])
  kind!: 'DISCOUNT' | 'SCHOLARSHIP';

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  percent?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number; // paisa per voucher

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class UpdateFeePolicyDto {
  /** Required for SUPER_ADMIN; others change their own school. */
  @IsOptional()
  @IsString()
  schoolId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  lateFeeAmount?: number; // paisa, 0 = off

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  lateFeeGraceDays?: number;
}

export class SchoolRunDto {
  @IsOptional()
  @IsString()
  schoolId?: string;
}

export class CarryForwardDto extends SchoolRunDto {
  @IsDateString()
  dueDate!: string;
}
