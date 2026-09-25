import { IsOptional, IsString, MaxLength } from 'class-validator';

/** BL-07: optional reason recorded when a student or staff member is archived. */
export class ArchiveRecordDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
