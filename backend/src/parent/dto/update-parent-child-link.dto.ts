import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  GUARDIAN_RELATIONSHIPS,
  type GuardianRelationshipName,
} from '../guardian-links';

/** Per-child guardian fields on the StudentParent join row (BL-04). */
export class UpdateParentChildLinkDto {
  /** true takes a free primary slot (max 2 per student, else 409); false releases it. */
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @IsBoolean() isEmergencyContact?: boolean;
  @IsOptional()
  @IsIn(GUARDIAN_RELATIONSHIPS)
  relationshipType?: GuardianRelationshipName;
  /** Free text for an OTHER relationship (e.g. "Uncle"). */
  @IsOptional() @IsString() @MaxLength(60) relationshipNote?: string;
}
