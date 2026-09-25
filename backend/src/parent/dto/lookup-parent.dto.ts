import { IsOptional, IsString, MinLength } from 'class-validator';

/**
 * BL-23: find an existing guardian by a deterministic key only (login identifier or CNIC) — never
 * by name — so another school can link the same person instead of creating a duplicate.
 */
export class LookupParentDto {
  @IsOptional() @IsString() @MinLength(3) identifier?: string;
  @IsOptional() @IsString() @MinLength(5) cnic?: string;
}
