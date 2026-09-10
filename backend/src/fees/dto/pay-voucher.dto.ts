import { IsIn } from 'class-validator';

export class PayVoucherDto {
  @IsIn(['jazzcash', 'easypaisa'])
  method!: 'jazzcash' | 'easypaisa';
}
