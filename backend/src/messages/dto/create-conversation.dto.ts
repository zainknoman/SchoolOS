import { IsIn, IsString, MinLength, ValidateIf } from 'class-validator';

export const CONVERSATION_RECIPIENT_TYPES = [
  'CLASS_TEACHER',
  'SCHOOL_ADMIN',
  'ACCOUNTS',
  'PRINCIPAL',
] as const;

export class CreateConversationDto {
  @IsIn(CONVERSATION_RECIPIENT_TYPES)
  recipientType!: (typeof CONVERSATION_RECIPIENT_TYPES)[number];

  @ValidateIf((o: CreateConversationDto) => o.recipientType === 'CLASS_TEACHER')
  @IsString()
  @MinLength(1)
  studentId?: string;

  @IsString()
  @MinLength(1)
  body!: string;
}
