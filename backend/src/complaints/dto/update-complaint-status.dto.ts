import { IsIn } from 'class-validator';

export const COMPLAINT_STATUSES = ['open', 'in_progress', 'resolved'] as const;

export class UpdateComplaintStatusDto {
  @IsIn(COMPLAINT_STATUSES)
  status!: (typeof COMPLAINT_STATUSES)[number];
}
