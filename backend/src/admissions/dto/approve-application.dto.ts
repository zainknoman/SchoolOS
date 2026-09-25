// backend/src/admissions/dto/approve-application.dto.ts
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

export class ApproveApplicationDto {
  @IsString()
  @MinLength(1)
  grNumber!: string;

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
