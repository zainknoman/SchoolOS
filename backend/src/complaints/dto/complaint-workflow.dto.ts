import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { COMPLAINT_STATUSES } from './update-complaint-status.dto';

/** BL-30: complaint categories (Q10). */
export const COMPLAINT_CATEGORIES = [
  'ACADEMIC',
  'BEHAVIOUR',
  'TRANSPORT',
  'FEES',
  'FACILITIES',
  'STAFF',
  'OTHER',
] as const;
export type ComplaintCategoryName = (typeof COMPLAINT_CATEGORIES)[number];

/** Staff: status, owner (null = unassign) and the resolution the parent sees. */
export class UpdateComplaintDto {
  @IsOptional()
  @IsIn(COMPLAINT_STATUSES)
  status?: (typeof COMPLAINT_STATUSES)[number];

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  assignedToId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolution?: string;
}

export class AddComplaintNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;

  /** Staff only; ignored for parents (their comments are always visible to the school). */
  @IsOptional()
  @IsBoolean()
  internal: boolean = true;
}
