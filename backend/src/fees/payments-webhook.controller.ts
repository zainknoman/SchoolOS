import { Body, Controller, HttpCode, Inject, NotFoundException, Param, Post, UnauthorizedException, Headers } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { FeePaymentsService } from './fee-payments.service';
import { PAYMENT_GATEWAY_ADAPTER_FACTORY } from './payment-gateway-adapter-factory';
import type { PaymentWebhookSignerRegistry } from './payment-gateway-adapter-factory';

/**
 * Server-to-server only — a real gateway calls this directly, not through a browser/app session,
 * so it can never require a JWT. Signature verification (per-gateway, see
 * PaymentGatewayAdapterFactoryImpl.getSigner) is what stands in for authentication here.
 */
@Controller('api/v1/payments')
export class PaymentsWebhookController {
  constructor(
    @Inject(PAYMENT_GATEWAY_ADAPTER_FACTORY) private readonly signers: PaymentWebhookSignerRegistry,
    private readonly feePayments: FeePaymentsService,
  ) {}

  @Public()
  @Post('webhook/:gateway')
  @HttpCode(200)
  async webhook(
    @Param('gateway') gateway: string,
    @Body() body: Record<string, string>,
    @Headers() headers: Record<string, string | undefined>,
  ) {
    const signer = this.signers.getSigner(gateway);
    if (!signer) {
      throw new NotFoundException(`Unknown or unconfigured payment gateway "${gateway}"`);
    }
    const result = signer.verifyAndParse(body, headers);
    if (!result.valid || !result.reference || !result.status) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    await this.feePayments.confirmFromWebhook(result.reference, result.status);
    return { received: true };
  }
}
