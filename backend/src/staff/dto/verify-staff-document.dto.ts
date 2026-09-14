import { IsBoolean } from 'class-validator';

export class VerifyStaffDocumentDto {
  @IsBoolean() verified!: boolean;
}