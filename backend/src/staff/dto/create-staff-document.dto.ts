import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { DocumentType } from '@prisma/client';

export class CreateStaffDocumentDto {
  @IsEnum(DocumentType) documentType!: DocumentType;
  @IsString() @MinLength(1) fileId!: string;
  @IsOptional() @IsDateString() expiryDate?: string;
  @IsOptional() @IsString() notes?: string;
}