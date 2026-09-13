import { IsBoolean } from 'class-validator';

export class VerifyStudentDocumentDto {
  @IsBoolean() verified!: boolean;
}
