import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class CreateFeeStructureDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsInt()
  @Min(1)
  amount!: number; // paisa
}
