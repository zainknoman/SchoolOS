import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { BulkTimetableEntryDto } from './bulk-timetable-entry.dto';

// Defines a section's ENTIRE weekly timetable in one call — the grid composer's "Save" posts
// this once, and the service replaces (deletes + recreates) every existing row for the section,
// not just the ones sent. An empty `entries` array is valid and clears the section's timetable.
export class ReplaceSectionTimetableDto {
  @IsArray()
  @ArrayMaxSize(200) // generous cap for a full week — guards against a malformed huge payload
  @ValidateNested({ each: true })
  @Type(() => BulkTimetableEntryDto)
  entries!: BulkTimetableEntryDto[];
}
