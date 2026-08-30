import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

// One row of a grid-composer bulk save. Same shape as CreateTimetableEntryDto minus
// sectionId, which comes from the URL param the whole batch is scoped to.
export class BulkTimetableEntryDto {
  @IsString()
  @MinLength(1)
  subjectId!: string;

  @IsOptional()
  @IsString()
  teacherId?: string;

  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsInt()
  @Min(1)
  period!: number;

  @IsString()
  @MinLength(1)
  startTime!: string;

  @IsString()
  @MinLength(1)
  endTime!: string;

  @IsOptional()
  @IsString()
  room?: string;
}
