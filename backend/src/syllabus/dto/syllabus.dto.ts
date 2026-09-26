import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class SyllabusUnitDto {
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(4000) topics?: string | null;
  @IsOptional() @IsString() termId?: string | null;
  @IsOptional() @IsDateString() plannedStart?: string | null;
  @IsOptional() @IsDateString() plannedEnd?: string | null;
}

export class CreateSyllabusDto {
  @IsString() @MinLength(1) classId!: string;
  @IsString() @MinLength(1) subjectId!: string;
  @IsOptional() @IsString() @MaxLength(4000) overview?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SyllabusUnitDto)
  units?: SyllabusUnitDto[];
}

/** Replaces the overview and the whole unit list (units are saved in the order given). */
export class UpdateSyllabusDto {
  @ValidateIf((o: UpdateSyllabusDto) => o.overview !== null)
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  overview?: string | null;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SyllabusUnitDto)
  units!: SyllabusUnitDto[];
}

export class ListSyllabiQueryDto {
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() academicSessionId?: string;
}
