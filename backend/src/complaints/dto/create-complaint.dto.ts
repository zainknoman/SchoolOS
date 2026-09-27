import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  COMPLAINT_CATEGORIES,
  type ComplaintCategoryName,
} from './complaint-workflow.dto';

export class CreateComplaintDto {
  @IsString()
  @MinLength(1)
  studentId!: string;

  /** BL-30: defaults to OTHER. */
  @IsOptional()
  @IsIn(COMPLAINT_CATEGORIES)
  category?: ComplaintCategoryName;

  /** The title. */
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject!: string;

  @IsString()
  @MinLength(1)
  description!: string;
}
