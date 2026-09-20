import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  PaymentGatewayAdapter,
  PaymentInitiation,
} from './payment-gateway-adapter';

/**
 * No real JazzCash/EasyPaisa merchant account exists yet — this adapter simulates a gateway's
 * hosted-checkout redirect. Local dev/tests simulate the gateway's own webhook call afterward
 * (see PaymentsWebhookController + StubWebhookSigner) rather than this adapter confirming
 * anything itself.
 */
@Injectable()
export class StubPaymentGatewayAdapter implements PaymentGatewayAdapter {
  // eslint-disable-next-line @typescript-eslint/require-await -- the adapter interface is Promise-based
  async initiate(input: {
    amount: number;
    reference: string;
  }): Promise<PaymentInitiation> {
    const gatewayReference = `stub_${randomUUID()}`;
    return {
      redirectUrl: `/pay/stub-checkout?ref=${gatewayReference}&amount=${input.amount}`,
      gatewayReference,
    };
  }
}
