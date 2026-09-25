import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  GUARDIAN_RELATIONSHIPS,
  type GuardianRelationshipName,
} from '../guardian-links';

/** BL-23/BL-04: link an existing guardian to one of the caller's students. */
export class LinkParentChildDto {
  @IsString() @MinLength(1) studentId!: string;
  @IsIn(GUARDIAN_RELATIONSHIPS) relationshipType!: GuardianRelationshipName;
  @IsOptional() @IsString() @MaxLength(60) relationshipNote?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @IsBoolean() isEmergencyContact?: boolean;
}
