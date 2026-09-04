import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  PaymentConfirmation,
  PaymentGatewayAdapter,
  PaymentInitiation,
} from './payment-gateway-adapter';

/**
 * No real JazzCash/EasyPaisa merchant account exists yet — this adapter simulates the
 * redirect-and-callback shape a real gateway would use (a hosted checkout URL, then a confirm
 * call standing in for the gateway's webhook) and always confirms 'completed'. Swapping in a real
 * merchant-backed implementation later is a one-file change behind the same PaymentGatewayAdapter
 * interface, matching the PushAdapter/StorageAdapter precedent.
 */
@Injectable()
export class StubPaymentGatewayAdapter implements PaymentGatewayAdapter {
  async initiate(input: { amount: number; reference: string }): Promise<PaymentInitiation> {
    const gatewayReference = `stub_${randomUUID()}`;
    return {
      redirectUrl: `/pay/stub-checkout?ref=${gatewayReference}&amount=${input.amount}`,
      gatewayReference,
    };
  }

  async confirm(): Promise<PaymentConfirmation> {
    return { status: 'completed' };
  }
}
