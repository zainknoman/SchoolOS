import { IsString, MaxLength, MinLength } from 'class-validator';

export class DownloadLinkDto {
  /** A download route path, e.g. `/api/v1/files/<id>` (BL-36). */
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  path!: string;
}
