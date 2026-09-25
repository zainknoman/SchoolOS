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

  // Required for CLASS_TEACHER; for the other recipients it picks the school (BL-23) and is required
  // only when the parent has children in more than one school.
  @ValidateIf(
    (o: CreateConversationDto) =>
      o.recipientType === 'CLASS_TEACHER' || o.studentId !== undefined,
  )
  @IsString()
  @MinLength(1)
  studentId?: string;

  @IsString()
  @MinLength(1)
  body!: string;
}
