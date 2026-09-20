import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class MarkEntryDto {
  @IsString()
  @MinLength(1)
  studentId!: string;

  @IsNumber()
  @Min(0)
  obtainedMarks!: number;
}

export class BulkMarksDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MarkEntryDto)
  marks!: MarkEntryDto[];
}
