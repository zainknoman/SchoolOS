import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentGatewayAdapter } from './payment-gateway-adapter';
import { StubPaymentGatewayAdapter } from './stub-payment-gateway.adapter';
import { JazzCashAdapter, JazzCashWebhookSigner } from './gateways/jazzcash.adapter';
import { EasyPaisaAdapter, EasyPaisaWebhookSigner } from './gateways/easypaisa.adapter';
import { StubWebhookSigner } from './gateways/stub-webhook.signer';
import { PaymentWebhookSigner } from './gateways/webhook-signer';
import { resolveJazzCashConfig, resolveEasyPaisaConfig, resolveStubWebhookSecret } from './gateways/gateway-config';

export const PAYMENT_GATEWAY_ADAPTER_FACTORY = 'PAYMENT_GATEWAY_ADAPTER_FACTORY';

export type PaymentMethod = 'jazzcash' | 'easypaisa';

export interface PaymentGatewayAdapterFactory {
  getAdapter(method: PaymentMethod): PaymentGatewayAdapter;
}

export interface PaymentWebhookSignerRegistry {
  getSigner(gateway: string): PaymentWebhookSigner | undefined;
}

/**
 * One class implements both interfaces — a payment's outbound gateway and its inbound webhook
 * verifier always come from the same provider config, so there is no value in splitting them
 * into two separately-injected services.
 */
@Injectable()
export class PaymentGatewayAdapterFactoryImpl implements PaymentGatewayAdapterFactory, PaymentWebhookSignerRegistry {
  constructor(private readonly config: ConfigService) {}

  getAdapter(method: PaymentMethod): PaymentGatewayAdapter {
    if (method === 'jazzcash') {
      const jazzCashConfig = resolveJazzCashConfig(this.config);
      return jazzCashConfig ? new JazzCashAdapter(jazzCashConfig) : new StubPaymentGatewayAdapter();
    }
    const easyPaisaConfig = resolveEasyPaisaConfig(this.config);
    return easyPaisaConfig ? new EasyPaisaAdapter(easyPaisaConfig) : new StubPaymentGatewayAdapter();
  }

  getSigner(gateway: string): PaymentWebhookSigner | undefined {
    if (gateway === 'stub') {
      return new StubWebhookSigner(resolveStubWebhookSecret(this.config));
    }
    if (gateway === 'jazzcash') {
      const jazzCashConfig = resolveJazzCashConfig(this.config);
      return jazzCashConfig ? new JazzCashWebhookSigner(jazzCashConfig.integritySalt) : undefined;
    }
    if (gateway === 'easypaisa') {
      const easyPaisaConfig = resolveEasyPaisaConfig(this.config);
      return easyPaisaConfig ? new EasyPaisaWebhookSigner(easyPaisaConfig.hashKey) : undefined;
    }
    return undefined;
  }
}
