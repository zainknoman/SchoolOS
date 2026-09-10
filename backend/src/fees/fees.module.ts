import { Module } from '@nestjs/common';
import { FeeStructuresService } from './fee-structures.service';
import { FeeVouchersService } from './fee-vouchers.service';
import { FeePaymentsService } from './fee-payments.service';
import { FeesPdfService } from './fees-pdf.service';
import { FeesController } from './fees.controller';
import { StudentAccessService } from '../common/student-access.service';
import { PAYMENT_GATEWAY_ADAPTER_FACTORY, PaymentGatewayAdapterFactoryImpl } from './payment-gateway-adapter-factory';

@Module({
  providers: [
    FeeStructuresService,
    FeeVouchersService,
    FeePaymentsService,
    FeesPdfService,
    StudentAccessService,
    { provide: PAYMENT_GATEWAY_ADAPTER_FACTORY, useClass: PaymentGatewayAdapterFactoryImpl },
  ],
  controllers: [FeesController],
})
export class FeesModule {}
