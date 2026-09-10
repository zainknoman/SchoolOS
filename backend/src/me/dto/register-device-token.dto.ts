import { IsIn, IsString, MinLength } from 'class-validator';

export const DEVICE_TOKEN_PLATFORMS = ['android', 'ios'] as const;

export class RegisterDeviceTokenDto {
  @IsString()
  @MinLength(1)
  token!: string;

  @IsIn(DEVICE_TOKEN_PLATFORMS)
  platform!: (typeof DEVICE_TOKEN_PLATFORMS)[number];
}
