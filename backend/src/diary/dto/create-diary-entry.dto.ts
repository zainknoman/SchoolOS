import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateDiaryEntryDto {
  @IsString()
  @MinLength(1)
  sectionId!: string;

  @IsString()
  @MinLength(1)
  subjectId!: string;

  @IsDateString()
  date!: string;

  @IsString()
  @MinLength(1)
  text!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fileIds?: string[];
}
