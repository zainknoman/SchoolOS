import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  Equals,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
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

  // BL-05: what the student must meet; required for PROMOTED_WITH_CONDITIONS (checked in the service)
  @IsOptional() @IsString() @MaxLength(1000) conditions?: string;
}

export class ExecutePromotionDto {
  @IsString() @MinLength(1) sourceAcademicSessionId!: string;
  @IsString() @MinLength(1) targetAcademicSessionId!: string;

  // BL-05 (Q5): the admin explicitly confirms the batch; nothing is promoted by default.
  @Equals(true, {
    message:
      'confirmed must be true — promotions need an explicit confirmation',
  })
  confirmed!: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PromotionDecisionInputDto)
  decisions!: PromotionDecisionInputDto[];
}
