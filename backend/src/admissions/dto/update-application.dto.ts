// backend/src/admissions/dto/update-application.dto.ts
import { IsIn, IsOptional, IsString } from 'class-validator';

export const NON_TERMINAL_STATUSES = ['UNDER_REVIEW', 'WITHDRAWN'] as const;

export class UpdateApplicationDto {
  @IsOptional()
  @IsIn(NON_TERMINAL_STATUSES)
  status?: (typeof NON_TERMINAL_STATUSES)[number];

  @IsOptional()
  @IsString()
  decisionNotes?: string;
}
