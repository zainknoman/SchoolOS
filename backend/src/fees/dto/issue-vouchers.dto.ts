import { ArrayMinSize, IsArray, IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class IssueVouchersDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  studentIds?: string[];

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsString()
  @MinLength(1)
  month!: string; // "2026-09"

  @IsDateString()
  dueDate!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  feeStructureIds!: string[];
}
