import { IsUUID } from 'class-validator';

export class CopyStructureDto {
  @IsUUID()
  sourceSessionId!: string;
}
