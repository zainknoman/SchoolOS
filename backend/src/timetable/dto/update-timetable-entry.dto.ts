import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

// sectionId is deliberately not updatable — moving an entry to a different section is a
// delete-and-recreate, not an edit, so the editor never needs to send it.
export class UpdateTimetableEntryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  subjectId?: string;

  @IsOptional()
  @IsString()
  teacherId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  period?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  startTime?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  endTime?: string;

  @IsOptional()
  @IsString()
  room?: string;
}
