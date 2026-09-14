import { IsIn, IsOptional, IsString } from 'class-validator';

export const NON_TERMINAL_HIRING_STATUSES = ['SHORTLISTED', 'INTERVIEWED'] as const;

export class UpdateHiringApplicationDto {
  @IsOptional()
  @IsIn(NON_TERMINAL_HIRING_STATUSES)
  status?: (typeof NON_TERMINAL_HIRING_STATUSES)[number];

  @IsOptional()
  @IsString()
  decisionNotes?: string;
}