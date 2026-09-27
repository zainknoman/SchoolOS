import { IsOptional, IsString, MinLength } from 'class-validator';

export class RefreshDto {
  // Optional since BL-36: the staff console sends none and uses its HttpOnly session cookie.
  @IsOptional()
  @IsString()
  @MinLength(1)
  refreshToken?: string;
}
