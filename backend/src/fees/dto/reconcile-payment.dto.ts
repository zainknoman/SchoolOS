import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ReconcilePaymentDto {
  @IsInt()
  @Min(1)
  amount!: number; // paisa

  @IsIn(['cash', 'bank_transfer'])
  method!: 'cash' | 'bank_transfer';

  @IsOptional()
  @IsString()
  note?: string;
}
