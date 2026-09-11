import { IsString, MinLength } from 'class-validator';

export class SuggestDraftDto {
  @IsString()
  @MinLength(1)
  context!: string;
}
