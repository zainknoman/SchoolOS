import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateFeeStructureDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsInt()
  @Min(1)
  amount!: number; // paisa

  /** BL-03: required for SUPER_ADMIN; others manage their own school. */
  @IsOptional()
  @IsString()
  schoolId?: string;
}

/** BL-03: edit a structure (name/amount while editable) or move it through its lifecycle. */
export class UpdateFeeStructureDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number;

  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'LOCKED', 'ARCHIVED'])
  status?: 'DRAFT' | 'ACTIVE' | 'LOCKED' | 'ARCHIVED';
}
