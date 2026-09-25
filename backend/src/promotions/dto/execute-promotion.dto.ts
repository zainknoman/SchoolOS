import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PromotionDecision } from '@prisma/client';

export class PromotionDecisionInputDto {
  @IsString() @MinLength(1) studentId!: string;
  @IsEnum(PromotionDecision) decision!: PromotionDecision;

  @ValidateIf(
    (o: PromotionDecisionInputDto) =>
      o.decision === 'PROMOTED' ||
      o.decision === 'PROMOTED_WITH_CONDITIONS' ||
      o.decision === 'RETAINED',
  )
  @IsString()
  @MinLength(1)
  targetSectionId?: string;

  @IsOptional() @IsString() rollNumber?: string;
  @IsOptional() @IsString() remarks?: string;
}

export class ExecutePromotionDto {
  @IsString() @MinLength(1) sourceAcademicSessionId!: string;
  @IsString() @MinLength(1) targetAcademicSessionId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PromotionDecisionInputDto)
  decisions!: PromotionDecisionInputDto[];
}
