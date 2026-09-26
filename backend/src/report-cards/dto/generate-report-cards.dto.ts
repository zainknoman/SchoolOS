import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ReportCardRemarkDto {
  @IsString() @MinLength(1) studentId!: string;
  @IsString() @MaxLength(1000) remark!: string;
}

export class GenerateReportCardsDto {
  @IsString() @MinLength(1) classId!: string;
  @IsString() @MinLength(1) termId!: string;

  /** Only these students (default: everyone enrolled in the class this session). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  studentIds?: string[];

  /** A remark per student; without one the current card's remark is kept. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ReportCardRemarkDto)
  remarks?: ReportCardRemarkDto[];
}
