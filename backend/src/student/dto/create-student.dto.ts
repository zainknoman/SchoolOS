import {
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
  IsIn,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateParentDto } from '../../parent/dto/create-parent.dto';
import {
  GUARDIAN_RELATIONSHIPS,
  type GuardianRelationshipName,
} from '../../parent/guardian-links';

// Exactly one of parentProfileId / newParent must be provided — enforced in the service, not
// here, matching FeeVouchersService.issue's existing "exactly one of studentIds or sectionId"
// precedent (a cross-field rule, awkward to express as a single class-validator decorator).
export class CreateStudentDto {
  @IsString()
  @MinLength(1)
  grNumber!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  sectionId!: string;

  @IsOptional()
  @IsString()
  parentProfileId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateParentDto)
  newParent?: CreateParentDto;
  /** BL-04 (Q4): the guardian's relationship to this student — required. */
  @IsIn(GUARDIAN_RELATIONSHIPS)
  relationshipType!: GuardianRelationshipName;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  relationshipNote?: string;
}
