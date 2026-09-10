import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export const NOTIFICATION_CHANNELS = ['PUSH', 'WHATSAPP', 'SMS'] as const;

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsIn(NOTIFICATION_CHANNELS)
  channel?: (typeof NOTIFICATION_CHANNELS)[number];

  @IsOptional()
  @IsBoolean()
  digestEnabled?: boolean;
}
