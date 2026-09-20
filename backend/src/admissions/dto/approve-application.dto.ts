// backend/src/admissions/dto/approve-application.dto.ts
import {
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateParentDto } from '../../parent/dto/create-parent.dto';

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
}
