import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class GradeBandDto {
  @IsNumber() @Min(0) @Max(100) minPercent!: number;
  @IsString() @MinLength(1) @MaxLength(10) letter!: string;
  @IsOptional() @IsString() @MaxLength(100) remark?: string | null;
  @IsOptional() @IsNumber() @Min(0) @Max(10) gradePoint?: number | null;
}

export class CreateGradingScaleDto {
  /** SUPER_ADMIN only: the school the scale belongs to. */
  @IsOptional() @IsString() schoolId?: string;
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => GradeBandDto)
  bands!: GradeBandDto[];
}

export class UpdateGradingScaleDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) name?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;

  /** Replaces every band when given. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => GradeBandDto)
  bands?: GradeBandDto[];
}

export class ResultPublicationDto {
  @IsString() @MinLength(1) classId!: string;
  @IsString() @MinLength(1) termId!: string;
}
